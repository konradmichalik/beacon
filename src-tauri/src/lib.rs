pub mod debug_log;
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

/// Create a white tray icon, optionally coloring the center dot.
///
/// The beacon icon has a filled circle at its center (pixels within ~7 px of
/// the midpoint).  When `color_dot` is true the center dot pixels are tinted
/// with `dot_rgb` instead of white, giving a colored indicator without drawing
/// an extra overlay.
#[cfg(target_os = "macos")]
fn create_tray_icon(color_dot: bool, dot_rgb: [u8; 3]) -> (Vec<u8>, u32, u32) {
    use image::{GenericImageView, RgbaImage};

    let base = image::load_from_memory(TRAY_ICON_BYTES).expect("failed to decode tray icon");
    let (w, h) = base.dimensions();
    let mut canvas = RgbaImage::from(base.to_rgba8());

    let cx = w as f32 / 2.0;
    let cy = h as f32 / 2.0;
    // The center dot extends to ~6 px from the midpoint; 7 px captures the
    // anti-aliased fringe while staying well inside the gap before the first arc.
    let dot_radius_sq: f32 = 7.0 * 7.0;

    for (x, y, pixel) in canvas.enumerate_pixels_mut() {
        if pixel.0[3] == 0 {
            continue;
        }
        let dx = x as f32 - cx;
        let dy = y as f32 - cy;
        let is_center_dot = (dx * dx + dy * dy) <= dot_radius_sq;

        if color_dot && is_center_dot {
            pixel.0[0] = dot_rgb[0];
            pixel.0[1] = dot_rgb[1];
            pixel.0[2] = dot_rgb[2];
        } else {
            pixel.0[0] = 255;
            pixel.0[1] = 255;
            pixel.0[2] = 255;
        }
    }

    (canvas.into_raw(), w, h)
}

pub(crate) fn update_tray_icon(
    app: &tauri::AppHandle,
    count: u32,
    mode: &str,
    dot_color: &str,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(tray::TRAY_ID) {
        let tooltip = if count > 0 {
            format!("Beacon — {} unread", count)
        } else {
            "Beacon — No notifications".to_string()
        };
        tray.set_tooltip(Some(&tooltip))
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "macos")]
        {
            let rgb = match dot_color {
                "red" => [255u8, 120, 110],
                "yellow" => [235u8, 203, 139],
                "green" => [163u8, 190, 140],
                _ => [94u8, 129, 172], // blue (default)
            };

            let color_dot = dot_color != "none" && count > 0;
            let title = if mode == "count" && count > 0 {
                count.to_string()
            } else {
                String::new()
            };

            let (rgba, w, h) = create_tray_icon(color_dot, rgb);
            let icon = tauri::image::Image::new_owned(rgba, w, h);
            tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
            tray.set_icon_as_template(false)
                .map_err(|e| e.to_string())?;
            tray.set_title(Some(&title)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn update_badge(
    app: tauri::AppHandle,
    count: u32,
    mode: String,
    dot_color: String,
) -> Result<(), String> {
    update_tray_icon(&app, count, &mode, &dot_color)
}

/// Check whether a macOS Focus mode (Do Not Disturb) is currently active.
/// Reads the system assertions database; returns `true` when any focus session is running.
#[cfg(target_os = "macos")]
fn is_focus_mode_active() -> bool {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return false,
    };
    let path = std::path::PathBuf::from(home).join("Library/DoNotDisturb/DB/Assertions.json");
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return false,
    };
    json.get("data")
        .and_then(|d| d.as_array())
        .is_some_and(|arr| {
            arr.iter().any(|entry| {
                entry
                    .get("storeAssertionRecords")
                    .and_then(|r| r.as_array())
                    .is_some_and(|records| !records.is_empty())
            })
        })
}

#[tauri::command]
fn play_sound(app: tauri::AppHandle, sound: String) -> Result<(), String> {
    if sound == "none" {
        return Ok(());
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
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    // If settings window already exists, just focus it
    if let Some(win) = app.get_webview_window("settings") {
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("?window=settings".into()),
    )
    .title("Beacon Settings")
    .inner_size(420.0, 480.0)
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
            app.manage(std::sync::Arc::new(polling::Poller::new()));
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
                    use objc2_app_kit::{
                        NSPanel, NSPopUpMenuWindowLevel, NSWindowCollectionBehavior,
                        NSWindowStyleMask,
                    };

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

                            // Resynchronize the prevents-activation state with WindowServer.
                            // macOS fails to call this when the style mask changes post-init,
                            // causing key events to be dropped (FB16484811).
                            let _: () = objc2::msg_send![panel, _setPreventsActivation: true];

                            panel.setFloatingPanel(true);
                            panel.setBecomesKeyOnlyIfNeeded(false);

                            panel.setCollectionBehavior(
                                NSWindowCollectionBehavior::CanJoinAllSpaces
                                    | NSWindowCollectionBehavior::Stationary
                                    | NSWindowCollectionBehavior::FullScreenAuxiliary
                                    | NSWindowCollectionBehavior::IgnoresCycle,
                            );

                            panel.setLevel(NSPopUpMenuWindowLevel);
                        }
                    }

                    // Shared hide-if-visible logic for both monitors
                    let make_hide_block = |app_handle: tauri::AppHandle| {
                        block2::RcBlock::new(move |_: std::ptr::NonNull<AnyObject>| {
                            if let Some(w) = app_handle.get_webview_window("main") {
                                if w.is_visible().unwrap_or(false) {
                                    let _ = w.hide();
                                }
                            }
                        })
                    };

                    // Auto-hide: global event monitor for clicks outside the panel
                    let click_block = make_hide_block(app.handle().clone());
                    unsafe {
                        // NSEventMask: LeftMouseDown (1<<1) | RightMouseDown (1<<3)
                        let mask: u64 = (1 << 1) | (1 << 3);
                        let _: *const AnyObject = objc2::msg_send![
                            AnyClass::get(c"NSEvent").unwrap(),
                            addGlobalMonitorForEventsMatchingMask: mask,
                            handler: &*click_block
                        ];
                    }

                    // Auto-hide: workspace notification for space/desktop changes
                    let space_block = make_hide_block(app.handle().clone());
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
