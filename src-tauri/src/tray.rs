use std::sync::Mutex;
use std::time::Instant;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager, PhysicalPosition,
};

pub const TRAY_ID: &str = "beacon-tray";

/// Tray icon position + physical size.
type TrayRect = (PhysicalPosition<i32>, (u32, u32));

/// Last known tray icon position + size, used to position the window on activation.
pub static LAST_TRAY_RECT: Mutex<Option<TrayRect>> = Mutex::new(None);

/// Timestamp of the last show_and_focus call. Used to suppress auto-hide monitors
/// that fire spuriously when opening the panel above a fullscreen app (macOS may
/// briefly report a space change in that scenario).
pub static LAST_SHOWN_AT: Mutex<Option<Instant>> = Mutex::new(None);

/// Grace period after showing the panel during which auto-hide is suppressed.
const SHOW_GRACE_MS: u128 = 600;

/// Position a window centered below the tray icon using the stored tray rect.
pub fn position_window_at_tray(window: &tauri::WebviewWindow) {
    let rect = LAST_TRAY_RECT.lock().unwrap();
    if let Some((pos, size)) = *rect {
        let window_width = window.outer_size().map(|s| s.width as i32).unwrap_or(420);
        let icon_center_x = pos.x + (size.0 as i32 / 2);
        let x = icon_center_x - (window_width / 2);
        let y = pos.y + size.1 as i32 + 4;
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

/// Returns `true` if the panel was shown recently enough that auto-hide should
/// be suppressed (prevents space-change notifications from closing it immediately).
pub fn is_within_show_grace() -> bool {
    LAST_SHOWN_AT
        .lock()
        .unwrap()
        .is_some_and(|t| t.elapsed().as_millis() < SHOW_GRACE_MS)
}

/// Re-apply all NSPanel properties that can drift after macOS system events
/// (sleep/wake, display reconfiguration, space changes).
///
/// Properties addressed:
/// - `hidesOnDeactivate`: NSPanel defaults to `true`; with Accessory activation
///   policy the app is mostly "inactive" and the panel silently auto-hides.
/// - `floatingPanel` + `level`: WindowServer can reset these after display changes.
/// - `collectionBehavior`: Space membership can be lost on reconfiguration.
/// - `_setPreventsActivation`: The WindowServer tag (kCGSPreventsActivationTagBit)
///   can desynchronize from AppKit's internal state after style-mask changes
///   triggered internally by AppKit (FB16484811).
#[cfg(target_os = "macos")]
fn ensure_panel_config(window: &tauri::WebviewWindow) {
    use objc2_app_kit::{NSPanel, NSPopUpMenuWindowLevel, NSWindowCollectionBehavior};
    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let panel = &*(ns_window as *const NSPanel);
            panel.setHidesOnDeactivate(false);
            panel.setFloatingPanel(true);
            panel.setLevel(NSPopUpMenuWindowLevel);
            panel.setCollectionBehavior(
                NSWindowCollectionBehavior::CanJoinAllSpaces
                    | NSWindowCollectionBehavior::Stationary
                    | NSWindowCollectionBehavior::FullScreenAuxiliary
                    | NSWindowCollectionBehavior::IgnoresCycle,
            );
            // Re-sync the prevents-activation tag with WindowServer.
            let _: () = objc2::msg_send![panel, _setPreventsActivation: true];
        }
    }
}

/// Public entry point for system-event observers (sleep/wake, display changes)
/// that need to re-apply panel configuration from outside this module.
#[cfg(target_os = "macos")]
pub fn reconfigure_panel(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        ensure_panel_config(&window);
    }
}

/// Show + position the main window (used by notification activation and global shortcut).
///
/// Reliability strategy (addresses multiple macOS edge cases):
/// 1. If AppKit thinks the panel is visible but it's actually stuck (ghost state),
///    cycle through `orderOut` to fully reset WindowServer's tracking.
/// 2. Re-apply all panel properties that may have drifted since last show.
/// 3. Show via Tauri (triggers `orderWindow:relativeTo:` which restarts the
///    WKWebView compositor — unlike `orderFrontRegardless` alone).
/// 4. `orderFrontRegardless` as final insurance to bypass activation checks.
fn show_and_focus(window: &tauri::WebviewWindow) {
    *LAST_SHOWN_AT.lock().unwrap() = Some(Instant::now());
    position_window_at_tray(window);

    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSPanel;
        if let Ok(ns_window) = window.ns_window() {
            unsafe {
                let panel = &*(ns_window as *const NSPanel);

                // If the panel is in a stale "visible" state (AppKit says visible
                // but WindowServer lost track of it), cycle through orderOut to
                // fully reset. This ensures the subsequent show() triggers a
                // proper orderWindow:relativeTo: which restarts the WKWebView
                // compositor — orderFrontRegardless alone does NOT do this
                // (Electron #45427).
                if panel.isVisible() {
                    let null: *const objc2::runtime::AnyObject = std::ptr::null();
                    let _: () = objc2::msg_send![panel, orderOut: null];
                }
            }
        }

        ensure_panel_config(window);
    }

    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "macos")]
    if let Ok(ns_window) = window.ns_window() {
        use objc2_app_kit::NSPanel;
        unsafe {
            let panel = &*(ns_window as *const NSPanel);

            // Final fallback: order front regardless of activation state.
            panel.orderFrontRegardless();

            // Make the WKWebView the first responder so keyboard events
            // reach JavaScript. The content view itself is a container;
            // the actual WKWebView is its first subview.
            if let Some(content) = panel.contentView() {
                use objc2::runtime::AnyObject;
                let subviews = content.subviews();
                let target: &AnyObject = if !subviews.is_empty() {
                    let first: *const AnyObject =
                        objc2::msg_send![&*subviews, objectAtIndex: 0usize];
                    &*first
                } else {
                    let ptr: *const AnyObject = &*content as *const _ as *const AnyObject;
                    &*ptr
                };
                let _: bool = objc2::msg_send![panel, makeFirstResponder: target];
            }
        }
    }
}

/// Check whether the panel is truly visible and functional on screen.
///
/// Tauri's `is_visible()` can return `true` even when the panel is in a ghost
/// state (e.g. after sleep/wake or display reconfiguration). We cross-check
/// with AppKit's own `isVisible()` and verify the window level hasn't been
/// reset — a level below `NSPopUpMenuWindowLevel` means the panel is rendered
/// behind other windows and effectively invisible.
///
/// Note: we deliberately do NOT check `isOnActiveSpace()` because it is
/// unreliable for windows with `CanJoinAllSpaces` collection behavior — macOS
/// can return `false` after space reconfigurations even though the window
/// should be on every space.
fn is_panel_showing(window: &tauri::WebviewWindow) -> bool {
    if !window.is_visible().unwrap_or(false) {
        return false;
    }

    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSPanel, NSPopUpMenuWindowLevel};
        if let Ok(ns_window) = window.ns_window() {
            unsafe {
                let panel = &*(ns_window as *const NSPanel);
                if !panel.isVisible() {
                    return false;
                }
                // If the window level was reset below popup-menu level (e.g.
                // after a display reconfiguration), the panel is hidden behind
                // other windows and effectively invisible to the user.
                if panel.level() < NSPopUpMenuWindowLevel {
                    return false;
                }
            }
        }
    }

    true
}

/// Toggle the main window: hide if visible, show if hidden.
pub fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if is_panel_showing(&window) {
            let _ = window.hide();
        } else {
            show_and_focus(&window);
        }
    }
}

/// Show the main window without toggling (always shows).
pub fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        show_and_focus(&window);
    }
}

pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let quit = MenuItemBuilder::with_id("quit", "Quit Beacon").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&settings)
        .separator()
        .item(&quit)
        .build()?;

    let icon = Image::from_bytes(include_bytes!("../icons/beacon-tray.png"))
        .expect("failed to load tray icon");

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Beacon")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                let app = tray.app_handle();
                // Update tray rect before toggling so position_window_at_tray works.
                // Use is_panel_showing (not is_visible) so the rect is also updated
                // when the panel is in a ghost-visible state — otherwise show_and_focus
                // would re-show at a stale position.
                if let Some(window) = app.get_webview_window("main") {
                    if !is_panel_showing(&window) {
                        let scale = window.scale_factor().unwrap_or(1.0);
                        let pos = rect.position.to_physical::<i32>(scale);
                        let size = rect.size.to_physical::<u32>(scale);
                        *LAST_TRAY_RECT.lock().unwrap() = Some((pos, (size.width, size.height)));
                    }
                }
                toggle_main_window(app);
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "settings" => {
                let app_clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::open_settings_window(app_clone).await;
                });
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
