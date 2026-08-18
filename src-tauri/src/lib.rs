pub mod debug_log;
mod platform_status;
mod polling;
mod tray;

/// Custom NSPanel subclass that accepts keyboard input and suppresses NSBeep.
///
/// The default NSPanel requires a title bar or resize bar to become key window.
/// Our tray popup has neither, so we override `canBecomeKeyWindow` to return true.
/// `noResponderFor:` is overridden to suppress the system beep for unhandled keys.
#[cfg(target_os = "macos")]
mod panel {
    use objc2::define_class;
    use objc2::runtime::NSObjectProtocol;
    use objc2_app_kit::NSPanel;

    pub struct BeaconPanelIvars;

    define_class!(
        #[unsafe(super = NSPanel)]
        #[name = "BeaconPanel"]
        #[ivars = BeaconPanelIvars]

        pub struct BeaconPanel;

        unsafe impl NSObjectProtocol for BeaconPanel {}

        impl BeaconPanel {
            #[unsafe(method(canBecomeKeyWindow))]
            fn can_become_key_window(&self) -> bool {
                true
            }

            #[unsafe(method(noResponderFor:))]
            fn no_responder_for(&self, _selector: objc2::runtime::Sel) {
                // Intentionally empty — prevents NSBeep() for unhandled key events
            }
        }
    );
}

const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/beacon-tray.png");

/// Create a tray icon with one of three indicator modes.
///
/// - `"none"`:  all non-transparent pixels are white (template-friendly).
/// - `"waves"`: wave arcs are tinted with `rgb`; center dot stays white.
/// - `"dot"`:   all pixels white, then a colored circle is drawn at the
///   bottom-right corner (~22 % of icon width).
///
/// Coloring is only applied when `active` is true (i.e. unread count > 0).
#[cfg(target_os = "macos")]
fn create_tray_icon(mode: &str, active: bool, rgb: [u8; 3]) -> (Vec<u8>, u32, u32) {
    use image::{GenericImageView, RgbaImage};

    let base = image::load_from_memory(TRAY_ICON_BYTES).expect("failed to decode tray icon");
    let (w, h) = base.dimensions();
    let mut canvas = RgbaImage::from(base.to_rgba8());

    let cx = w as f32 / 2.0;
    let cy = h as f32 / 2.0;
    let dot_radius_sq: f32 = 7.0 * 7.0;

    // Step 1: set all non-transparent pixels to white
    for (_x, _y, pixel) in canvas.enumerate_pixels_mut() {
        if pixel.0[3] == 0 {
            continue;
        }
        pixel.0[0] = 255;
        pixel.0[1] = 255;
        pixel.0[2] = 255;
    }

    if active {
        match mode {
            "waves" => {
                // Tint everything EXCEPT the center dot
                for (x, y, pixel) in canvas.enumerate_pixels_mut() {
                    if pixel.0[3] == 0 {
                        continue;
                    }
                    let dx = x as f32 - cx;
                    let dy = y as f32 - cy;
                    if (dx * dx + dy * dy) > dot_radius_sq {
                        pixel.0[0] = rgb[0];
                        pixel.0[1] = rgb[1];
                        pixel.0[2] = rgb[2];
                    }
                }
            }
            "dot" => {
                // Draw a filled circle at the bottom-right corner
                let radius = w as f32 * 0.22;
                let r_sq = radius * radius;
                let dot_cx = w as f32 - radius - 1.0;
                let dot_cy = h as f32 - radius - 1.0;

                for y in 0..h {
                    for x in 0..w {
                        let dx = x as f32 - dot_cx;
                        let dy = y as f32 - dot_cy;
                        let dist_sq = dx * dx + dy * dy;
                        if dist_sq <= r_sq {
                            // Anti-alias the edge: blend over 1.5 px
                            let dist = dist_sq.sqrt();
                            let alpha = ((radius - dist) / 1.5).clamp(0.0, 1.0);
                            let pixel = canvas.get_pixel_mut(x, y);
                            pixel.0[0] =
                                (rgb[0] as f32 * alpha + pixel.0[0] as f32 * (1.0 - alpha)) as u8;
                            pixel.0[1] =
                                (rgb[1] as f32 * alpha + pixel.0[1] as f32 * (1.0 - alpha)) as u8;
                            pixel.0[2] =
                                (rgb[2] as f32 * alpha + pixel.0[2] as f32 * (1.0 - alpha)) as u8;
                            if pixel.0[3] == 0 {
                                pixel.0[3] = (255.0 * alpha) as u8;
                            }
                        }
                    }
                }
            }
            _ => {} // "none" — already all white
        }
    }

    (canvas.into_raw(), w, h)
}

/// `(count, badge_mode, indicator_mode, indicator_color)` last rendered to the
/// tray.
type TrayState = (u32, String, String, String);

/// An identical update can skip the icon re-render and the main-thread tray
/// mutations entirely, so the last-rendered state is cached here.
fn last_tray_state() -> &'static std::sync::Mutex<Option<TrayState>> {
    static STATE: std::sync::OnceLock<std::sync::Mutex<Option<TrayState>>> =
        std::sync::OnceLock::new();
    STATE.get_or_init(|| std::sync::Mutex::new(None))
}

pub(crate) fn update_tray_icon(
    app: &tauri::AppHandle,
    count: u32,
    mode: &str,
    indicator_mode: &str,
    indicator_color: &str,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(tray::TRAY_ID) {
        // Skip when nothing that affects the tray has changed since the last
        // render (both the poll loop and the frontend `update_badge` command
        // reach this, often with the same values).
        let tray_key = (
            count,
            mode.to_string(),
            indicator_mode.to_string(),
            indicator_color.to_string(),
        );
        if last_tray_state().lock().unwrap().as_ref() == Some(&tray_key) {
            return Ok(());
        }

        let tooltip = if count > 0 {
            format!("Beacon — {} unread", count)
        } else {
            "Beacon — No notifications".to_string()
        };
        tray.set_tooltip(Some(&tooltip))
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "macos")]
        {
            let rgb = match indicator_color {
                "red" => [255u8, 120, 110],
                "yellow" => [235u8, 203, 139],
                "green" => [163u8, 190, 140],
                _ => [94u8, 129, 172], // blue (default)
            };

            let active = indicator_mode != "none" && count > 0;
            let title = if mode == "count" && count > 0 {
                count.to_string()
            } else {
                String::new()
            };

            let (rgba, w, h) = create_tray_icon(indicator_mode, active, rgb);
            let as_template = indicator_mode == "none" || !active;

            // Set icon + template flag atomically on the main thread via the
            // inner tray-icon API. Tauri's separate `set_icon` /
            // `set_icon_as_template` calls each post their own main-thread
            // task and `set_icon` hardcodes `icon_is_template = false`, so a
            // render pass can interleave between them with template=false and
            // cache a non-template rendering — leaving the icon stuck white
            // on light wallpapers (tauri-apps/tauri#9332).
            tray.with_inner_tray_icon(move |inner| -> Result<(), String> {
                let icon = tray_icon::Icon::from_rgba(rgba, w, h).map_err(|e| e.to_string())?;
                inner
                    .set_icon_with_as_template(Some(icon), as_template)
                    .map_err(|e| e.to_string())
            })
            .map_err(|e| e.to_string())??;

            tray.set_title(Some(&title)).map_err(|e| e.to_string())?;
        }

        *last_tray_state().lock().unwrap() = Some(tray_key);
    }
    Ok(())
}

#[tauri::command]
fn update_badge(
    app: tauri::AppHandle,
    count: u32,
    mode: String,
    indicator_mode: String,
    indicator_color: String,
) -> Result<(), String> {
    update_tray_icon(&app, count, &mode, &indicator_mode, &indicator_color)
}

/// Check whether a macOS Focus mode (Do Not Disturb) is currently active.
/// Uses the private DoNotDisturbServer framework via XPC to query the current state.
#[cfg(target_os = "macos")]
fn is_focus_mode_active() -> bool {
    use block2::RcBlock;
    use objc2::runtime::{AnyClass, AnyObject, Bool};
    use objc2_foundation::NSString;
    use std::sync::{Arc, Condvar, Mutex};

    unsafe {
        // Load private framework
        let path =
            NSString::from_str("/System/Library/PrivateFrameworks/DoNotDisturbServer.framework");
        let bundle: *const AnyObject =
            objc2::msg_send![objc2::class!(NSBundle), bundleWithPath: &*path];
        if bundle.is_null() {
            return false;
        }
        let loaded: Bool = objc2::msg_send![bundle, load];
        if !loaded.as_bool() {
            return false;
        }

        // Create DNDStateService instance
        let cls = match AnyClass::get(c"DNDStateService") {
            Some(c) => c,
            None => return false,
        };
        let alloc: *mut AnyObject = objc2::msg_send![cls, alloc];
        if alloc.is_null() {
            return false;
        }
        let client_id = NSString::from_str("com.beacon.focus-check");
        let service: *mut AnyObject =
            objc2::msg_send![alloc, _initWithClientIdentifier: &*client_id];
        if service.is_null() {
            return false;
        }

        // Query current state via completion handler
        let pair = Arc::new((Mutex::new(None::<bool>), Condvar::new()));
        let pair_clone = Arc::clone(&pair);

        let handler = RcBlock::new(move |state: *const AnyObject, _error: *const AnyObject| {
            let active = if state.is_null() {
                false
            } else {
                let val: Bool = objc2::msg_send![state, isActive];
                val.as_bool()
            };
            let (lock, cvar) = &*pair_clone;
            *lock.lock().unwrap() = Some(active);
            cvar.notify_one();
        });

        let _: () = objc2::msg_send![service, queryCurrentStateWithCompletionHandler: &*handler];

        // Wait up to 1 second for the XPC response
        let (lock, cvar) = &*pair;
        let guard = lock.lock().unwrap();
        let result = cvar
            .wait_timeout_while(guard, std::time::Duration::from_secs(1), |val| {
                val.is_none()
            })
            .unwrap();
        let active = result.0.unwrap_or(false);

        // Release the service object to prevent memory leak
        let _: () = objc2::msg_send![service, release];

        active
    }
}

/// A sound name is safe to interpolate into a file path only if it contains no
/// path separators or traversal sequences. Restrict it to a simple identifier.
fn is_valid_sound_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[tauri::command]
fn play_sound(app: tauri::AppHandle, sound: String) -> Result<(), String> {
    if sound == "none" {
        return Ok(());
    }

    // The name is used to build a filesystem path; reject anything that could
    // escape the bundled sounds directory.
    if !is_valid_sound_name(&sound) {
        return Err(format!("Invalid sound name: {sound}"));
    }

    #[cfg(target_os = "macos")]
    {
        if is_focus_mode_active() {
            return Ok(());
        }

        use tauri::Manager;

        let resource_path = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("sounds")
            .join(format!("{}.mp3", sound));

        if !resource_path.exists() {
            return Err(format!("Sound file not found: {}", sound));
        }

        use objc2::AnyThread;
        use objc2_app_kit::NSSound;
        use objc2_foundation::NSString;

        let path = NSString::from_str(&resource_path.to_string_lossy());
        if let Some(ns_sound) =
            NSSound::initWithContentsOfFile_byReference(NSSound::alloc(), &path, true)
        {
            let _: bool = ns_sound.play();
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, sound);
    }

    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle, tab: Option<String>) -> Result<(), String> {
    use tauri::Manager;

    // If settings window already exists, just focus it. Deep-linking to a tab
    // only applies to a freshly opened window; switching the tab of an
    // already-open window is a rarer case not worth an extra IPC round trip.
    if let Some(win) = app.get_webview_window("settings") {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = match tab {
        Some(tab) => format!("?window=settings&tab={tab}"),
        None => "?window=settings".to_string(),
    };

    tauri::WebviewWindowBuilder::new(&app, "settings", tauri::WebviewUrl::App(url.into()))
        .title("Beacon Settings")
        .inner_size(480.0, 480.0)
        .resizable(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn open_login_items_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.LoginItems-Settings.extension")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

const GLOBAL_SHORTCUT: &str = "CmdOrCtrl+Shift+B";

#[tauri::command]
fn register_global_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let shortcut: tauri_plugin_global_shortcut::Shortcut =
        GLOBAL_SHORTCUT.parse().map_err(|e| format!("{e:?}"))?;
    app.global_shortcut()
        .register(shortcut)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn unregister_global_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let shortcut: tauri_plugin_global_shortcut::Shortcut =
        GLOBAL_SHORTCUT.parse().map_err(|e| format!("{e:?}"))?;
    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        tray::toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            use tauri::Manager;
            debug_log::init(app);

            // Install a panic hook that writes to the debug log before abort.
            // With `panic = "abort"` the process dies immediately after the hook,
            // so this is our only chance to capture crash context.
            std::panic::set_hook(Box::new(|info| {
                let msg = format!("{info}");
                debug_log::write_always("PANIC", "runtime", &msg);
                eprintln!("PANIC: {msg}");
            }));

            app.manage(std::sync::Arc::new(polling::Poller::new()));
            platform_status::spawn_loop(app.handle().clone());
            tray::create_tray(app)?;

            // Register global shortcut (CmdOrCtrl+Shift+B) to toggle the main window.
            // The frontend will unregister it on init if the user has disabled it.
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let shortcut: tauri_plugin_global_shortcut::Shortcut =
                    GLOBAL_SHORTCUT.parse().expect("invalid shortcut");
                if let Err(e) = app.global_shortcut().register(shortcut) {
                    eprintln!("Failed to register global shortcut: {e}");
                }
            }

            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                // Convert NSWindow → NSPanel so the popover appears above fullscreen apps.
                // NSPanel has special macOS treatment for auxiliary/floating windows.
                if let Some(window) = app.get_webview_window("main") {
                    use objc2::runtime::{AnyClass, AnyObject};
                    use objc2_app_kit::{NSPanel, NSWindowStyleMask};

                    if let Ok(ns_window) = window.ns_window() {
                        unsafe {
                            // Swap the ObjC class from NSWindow to BeaconPanel at runtime.
                            // BeaconPanel overrides canBecomeKeyWindow (→ true) and
                            // noResponderFor: (→ no-op) to enable keyboard input and
                            // suppress NSBeep for unhandled keys.
                            let obj = &*(ns_window as *const AnyObject);
                            use objc2::ClassType;
                            let panel_class = panel::BeaconPanel::class();
                            AnyObject::set_class(obj, panel_class);

                            let panel = &*(ns_window as *const NSPanel);

                            let mut mask = panel.styleMask();
                            mask |= NSWindowStyleMask::NonactivatingPanel;
                            panel.setStyleMask(mask);

                            // One-time setup: allow the panel to become key
                            // without requiring the user to click it first.
                            panel.setBecomesKeyOnlyIfNeeded(false);
                        }
                    }

                    // Apply all driftable panel properties (level, floating,
                    // collection behavior, hidesOnDeactivate, _setPreventsActivation).
                    tray::reconfigure_panel(app.handle());

                    // Auto-hide: global event monitor for clicks outside the panel.
                    // Uses is_panel_showing() instead of is_visible() to avoid
                    // hiding a panel that's already in a ghost state — calling
                    // hide() on a ghost panel can further desync Tauri's internal
                    // visibility tracking from AppKit's actual state.
                    //
                    // The show grace period is honoured here for the same reason as
                    // in the space-change observer below: the mouse-down that opens
                    // the panel from the tray icon can still be in flight when the
                    // panel becomes visible, and under load macOS may deliver it (or
                    // a duplicate) afterwards. Without the guard that stray event
                    // hides the panel immediately, so the click appears to do nothing.
                    let click_app_handle = app.handle().clone();
                    let click_block =
                        block2::RcBlock::new(move |_: std::ptr::NonNull<AnyObject>| {
                            if tray::is_within_show_grace() {
                                return;
                            }
                            if let Some(w) = click_app_handle.get_webview_window("main") {
                                if tray::is_panel_showing(&w) {
                                    let _ = w.hide();
                                }
                            }
                        });
                    unsafe {
                        // NSEventMask: LeftMouseDown (1<<1) | RightMouseDown (1<<3)
                        let mask: u64 = (1 << 1) | (1 << 3);
                        let _: *const AnyObject = objc2::msg_send![
                            AnyClass::get(c"NSEvent").unwrap(),
                            addGlobalMonitorForEventsMatchingMask: mask,
                            handler: &*click_block
                        ];
                    }

                    // Auto-hide: workspace notification for space/desktop changes.
                    // Uses a grace period to avoid hiding the panel when it was just
                    // shown above a fullscreen app (macOS fires a spurious space-change
                    // notification in that scenario).
                    let space_app_handle = app.handle().clone();
                    let space_block =
                        block2::RcBlock::new(move |_: std::ptr::NonNull<AnyObject>| {
                            if tray::is_within_show_grace() {
                                return;
                            }
                            if let Some(w) = space_app_handle.get_webview_window("main") {
                                if tray::is_panel_showing(&w) {
                                    let _ = w.hide();
                                }
                            }
                        });
                    unsafe {
                        let workspace: *const AnyObject = objc2::msg_send![
                            AnyClass::get(c"NSWorkspace").unwrap(),
                            sharedWorkspace
                        ];
                        let center: *const AnyObject =
                            objc2::msg_send![workspace, notificationCenter];
                        let name = objc2_foundation::NSString::from_str(
                            "NSWorkspaceActiveSpaceDidChangeNotification",
                        );
                        let null: *const AnyObject = std::ptr::null();
                        let _: *const AnyObject = objc2::msg_send![
                            center,
                            addObserverForName: &*name,
                            object: null,
                            queue: null,
                            usingBlock: &*space_block
                        ];
                    }

                    // Show window when app is activated (e.g. native notification click).
                    // With ActivationPolicy::Accessory + NonactivatingPanel the app is
                    // only activated through notification clicks, never via tray interaction.
                    let activation_block = {
                        let app_handle = app.handle().clone();
                        block2::RcBlock::new(move |_: std::ptr::NonNull<AnyObject>| {
                            tray::show_main_window(&app_handle);
                        })
                    };
                    unsafe {
                        let center: *const AnyObject = objc2::msg_send![
                            AnyClass::get(c"NSNotificationCenter").unwrap(),
                            defaultCenter
                        ];
                        let name = objc2_foundation::NSString::from_str(
                            "NSApplicationDidBecomeActiveNotification",
                        );
                        let null: *const AnyObject = std::ptr::null();
                        let _: *const AnyObject = objc2::msg_send![
                            center,
                            addObserverForName: &*name,
                            object: null,
                            queue: null,
                            usingBlock: &*activation_block
                        ];
                    }

                    // Re-apply panel configuration after system events that can
                    // cause WindowServer to reset window properties (level,
                    // collection behavior, prevents-activation tag).
                    let make_reconfig_block = |app_handle: tauri::AppHandle| {
                        block2::RcBlock::new(move |_: std::ptr::NonNull<AnyObject>| {
                            tray::reconfigure_panel(&app_handle);
                        })
                    };

                    // Sleep/wake: WindowServer can lose track of floating panel
                    // properties after the display hardware is reinitialized.
                    let wake_block = make_reconfig_block(app.handle().clone());
                    unsafe {
                        let workspace: *const AnyObject = objc2::msg_send![
                            AnyClass::get(c"NSWorkspace").unwrap(),
                            sharedWorkspace
                        ];
                        let center: *const AnyObject =
                            objc2::msg_send![workspace, notificationCenter];
                        let name =
                            objc2_foundation::NSString::from_str("NSWorkspaceDidWakeNotification");
                        let null: *const AnyObject = std::ptr::null();
                        let _: *const AnyObject = objc2::msg_send![
                            center,
                            addObserverForName: &*name,
                            object: null,
                            queue: null,
                            usingBlock: &*wake_block
                        ];
                    }

                    // Display reconfiguration (monitor connect/disconnect, lid
                    // close/open): can reset window level and space membership.
                    let screen_block = make_reconfig_block(app.handle().clone());
                    unsafe {
                        let center: *const AnyObject = objc2::msg_send![
                            AnyClass::get(c"NSNotificationCenter").unwrap(),
                            defaultCenter
                        ];
                        let name = objc2_foundation::NSString::from_str(
                            "NSApplicationDidChangeScreenParametersNotification",
                        );
                        let null: *const AnyObject = std::ptr::null();
                        let _: *const AnyObject = objc2::msg_send![
                            center,
                            addObserverForName: &*name,
                            object: null,
                            queue: null,
                            usingBlock: &*screen_block
                        ];
                    }

                    // Periodic health-check: re-apply panel configuration every
                    // 60 seconds to recover from silent WindowServer state drift
                    // that doesn't trigger any notification (e.g. WindowServer
                    // internal restarts, GPU resets, or undocumented resets).
                    //
                    // IMPORTANT: AppKit is not thread-safe — all NSPanel property
                    // mutations must happen on the main thread. We sleep on a
                    // background thread but dispatch the actual work to main.
                    let health_app_handle = app.handle().clone();
                    std::thread::spawn(move || loop {
                        std::thread::sleep(std::time::Duration::from_secs(60));
                        let handle = health_app_handle.clone();
                        let _ = health_app_handle.run_on_main_thread(move || {
                            tray::reconfigure_panel(&handle);
                        });
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_badge,
            play_sound,
            quit_app,
            open_settings_window,
            open_login_items_settings,
            register_global_shortcut,
            unregister_global_shortcut,
            polling::start_polling,
            polling::stop_polling,
            polling::trigger_poll,
            debug_log::write_log,
            debug_log::clear_log,
            debug_log::reveal_log_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_valid_sound_name;

    #[test]
    fn accepts_plain_sound_names() {
        assert!(is_valid_sound_name("ping"));
        assert!(is_valid_sound_name("soft-chime"));
        assert!(is_valid_sound_name("alert_2"));
    }

    #[test]
    fn rejects_path_traversal_and_separators() {
        assert!(!is_valid_sound_name("../../../etc/passwd"));
        assert!(!is_valid_sound_name("foo/bar"));
        assert!(!is_valid_sound_name("foo.bar"));
        assert!(!is_valid_sound_name(".."));
        assert!(!is_valid_sound_name(""));
    }
}
