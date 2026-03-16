mod polling;
mod tray;

const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/beacon-tray.png");

/// Create a white tray icon with an optional colored dot overlay.
#[cfg(target_os = "macos")]
fn create_tray_icon(with_dot: bool, dot_rgb: [u8; 3]) -> (Vec<u8>, u32, u32) {
    use image::{GenericImageView, RgbaImage};

    let base = image::load_from_memory(TRAY_ICON_BYTES).expect("failed to decode tray icon");
    let (w, h) = base.dimensions();
    let mut canvas = RgbaImage::from(base.to_rgba8());

    // macOS menu bar always has a dark background, so the icon must always be white
    for pixel in canvas.pixels_mut() {
        if pixel.0[3] > 0 {
            pixel.0[0] = 255;
            pixel.0[1] = 255;
            pixel.0[2] = 255;
        }
    }

    if with_dot {
        let radius: f32 = (w as f32 * 0.22).max(3.0);
        let cx = w as f32 - radius - 1.0;
        let cy = h as f32 - radius - 1.0;
        let dot_color = [dot_rgb[0], dot_rgb[1], dot_rgb[2], 255u8];

        let r2 = radius * radius;
        let search = (radius + 1.5) as i32;
        for dy in -search..=search {
            for dx in -search..=search {
                let px = cx + dx as f32;
                let py = cy + dy as f32;
                if px < 0.0 || py < 0.0 || px >= w as f32 || py >= h as f32 {
                    continue;
                }
                let dist2 = (dx as f32) * (dx as f32) + (dy as f32) * (dy as f32);
                if dist2 <= r2 {
                    canvas.put_pixel(px as u32, py as u32, image::Rgba(dot_color));
                } else if dist2 <= (radius + 1.0) * (radius + 1.0) {
                    let alpha = ((radius + 1.0) * (radius + 1.0) - dist2)
                        / ((radius + 1.0) * (radius + 1.0) - r2);
                    let a = (alpha * 255.0).clamp(0.0, 255.0) as u8;
                    let existing = *canvas.get_pixel(px as u32, py as u32);
                    let blended = blend_pixel(
                        existing,
                        image::Rgba([dot_color[0], dot_color[1], dot_color[2], a]),
                    );
                    canvas.put_pixel(px as u32, py as u32, blended);
                }
            }
        }
    }

    (canvas.into_raw(), w, h)
}

fn blend_pixel(base: image::Rgba<u8>, overlay: image::Rgba<u8>) -> image::Rgba<u8> {
    let oa = overlay.0[3] as f32 / 255.0;
    let ba = base.0[3] as f32 / 255.0;
    let out_a = oa + ba * (1.0 - oa);
    if out_a == 0.0 {
        return image::Rgba([0, 0, 0, 0]);
    }
    let r = (overlay.0[0] as f32 * oa + base.0[0] as f32 * ba * (1.0 - oa)) / out_a;
    let g = (overlay.0[1] as f32 * oa + base.0[1] as f32 * ba * (1.0 - oa)) / out_a;
    let b = (overlay.0[2] as f32 * oa + base.0[2] as f32 * ba * (1.0 - oa)) / out_a;
    image::Rgba([r as u8, g as u8, b as u8, (out_a * 255.0) as u8])
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
                _ => [94u8, 129, 172], // blue (default)
            };

            let with_dot = mode == "dot" && count > 0;
            let title = if mode == "count" && count > 0 {
                count.to_string()
            } else {
                String::new()
            };

            let (rgba, w, h) = create_tray_icon(with_dot, rgb);
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

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            use tauri::Manager;
            app.manage(std::sync::Arc::new(polling::Poller::new()));
            tray::create_tray(app)?;

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
                            // Swap the ObjC class from NSWindow to NSPanel at runtime
                            let obj = &*(ns_window as *const AnyObject);
                            let panel_class =
                                AnyClass::get(c"NSPanel").expect("NSPanel class not found");
                            AnyObject::set_class(obj, panel_class);

                            let panel = &*(ns_window as *const NSPanel);

                            // NonactivatingPanel: clicking the panel doesn't steal
                            // focus from fullscreen apps or cause space switches
                            let mut mask = panel.styleMask();
                            mask |= NSWindowStyleMask::NonactivatingPanel;
                            panel.setStyleMask(mask);

                            panel.setFloatingPanel(true);

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
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_badge,
            quit_app,
            polling::start_polling,
            polling::stop_polling,
            polling::trigger_poll,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
