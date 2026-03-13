mod tray;


const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/beacon-tray.png");


/// Create a white tray icon with an optional red dot overlay.
#[cfg(target_os = "macos")]
fn create_tray_icon(with_dot: bool) -> (Vec<u8>, u32, u32) {
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
        let dot_color = [255u8, 120, 110, 255];

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
                    let blended = blend_pixel(existing, image::Rgba([dot_color[0], dot_color[1], dot_color[2], a]));
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

#[tauri::command]
async fn update_badge(app: tauri::AppHandle, count: u32, mode: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(tray::TRAY_ID) {
        let tooltip = if count > 0 {
            format!("Beacon — {} unread", count)
        } else {
            "Beacon — No notifications".to_string()
        };
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;

        #[cfg(target_os = "macos")]
        {
            match mode.as_str() {
                "dot" if count > 0 => {
                    let (rgba, w, h) = create_tray_icon(true);
                    let icon = tauri::image::Image::new_owned(rgba, w, h);
                    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
                    tray.set_icon_as_template(false).map_err(|e| e.to_string())?;
                    tray.set_title(Some("")).map_err(|e| e.to_string())?;
                }
                "count" if count > 0 => {
                    let (rgba, w, h) = create_tray_icon(false);
                    let icon = tauri::image::Image::new_owned(rgba, w, h);
                    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
                    tray.set_icon_as_template(false).map_err(|e| e.to_string())?;
                    tray.set_title(Some(&count.to_string())).map_err(|e| e.to_string())?;
                }
                _ => {
                    let (rgba, w, h) = create_tray_icon(false);
                    let icon = tauri::image::Image::new_owned(rgba, w, h);
                    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
                    tray.set_icon_as_template(false).map_err(|e| e.to_string())?;
                    tray.set_title(Some("")).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    Ok(())
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
            tray::create_tray(app)?;

            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                // Make window appear on all Spaces and above fullscreen apps
                if let Some(window) = app.get_webview_window("main") {
                    use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior, NSFloatingWindowLevel};
                    if let Ok(ns_window) = window.ns_window() {
                        let ns_window = unsafe { &*(ns_window as *const NSWindow) };
                        // canJoinAllSpaces: appear on every Space
                        // stationary: don't move with Space switches
                        // fullScreenAuxiliary: appear above fullscreen apps
                        ns_window.setCollectionBehavior(
                            NSWindowCollectionBehavior::CanJoinAllSpaces
                                | NSWindowCollectionBehavior::Stationary
                                | NSWindowCollectionBehavior::FullScreenAuxiliary,
                        );
                        // Floating panel level — above normal windows
                        ns_window.setLevel(NSFloatingWindowLevel);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![update_badge, quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
