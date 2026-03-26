use std::sync::Mutex;
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

/// Show + position the main window (used by notification activation and global shortcut).
fn show_and_focus(window: &tauri::WebviewWindow) {
    position_window_at_tray(window);
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSPanel, NSPopUpMenuWindowLevel};
        if let Ok(ns_window) = window.ns_window() {
            unsafe {
                let panel = &*(ns_window as *const NSPanel);
                panel.setFloatingPanel(true);
                panel.setLevel(NSPopUpMenuWindowLevel);

                // Make the webview content view the first responder so
                // keyboard events reach JavaScript instead of triggering NSBeep.
                if let Some(view) = panel.contentView() {
                    let _: bool = objc2::msg_send![panel, makeFirstResponder: &*view];
                }
            }
        }
    }
}

/// Toggle the main window: hide if visible, show if hidden.
pub fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
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
                // Update tray rect before toggling so position_window_at_tray works
                if let Some(window) = app.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(false) {
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
