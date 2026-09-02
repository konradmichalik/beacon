use std::fs;
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::Path;

use tauri::Manager;

/// Ensure `settings.json` is only readable by the current user.
///
/// The store plugin opens the file with `fs::write`, which truncates an
/// existing file in place rather than deleting and recreating it, so a mode
/// set here survives every subsequent save. Only a brand new file (or one
/// still at the pre-fix default mode from an earlier version) needs
/// touching; must run before the frontend's first `Store.load()` call.
pub fn init(app: &tauri::App) {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    if let Err(e) = fs::create_dir_all(&dir) {
        crate::debug_log::error(
            "settings",
            &format!("failed to create app data dir, permissions not enforced: {e}"),
        );
        return;
    }
    secure(&dir.join("settings.json"));
}

// Best-effort: this hardens a local single-user app's settings file, it does
// not gate access to anything. A failure here (read-only filesystem, odd
// permission state) is logged rather than aborting startup — refusing to
// launch the whole app over an unenforceable chmod would be a worse outcome
// for the user than settings.json staying at its previous mode for one more
// launch, since `secure` retries every time `init` runs.
fn secure(path: &Path) {
    let created = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path);

    match created {
        // A brand new file starts as valid, empty JSON rather than zero
        // bytes. The store plugin's own load() tolerates either (it swallows
        // deserialize errors the same way it swallows a missing file), but
        // writing `{}` doesn't lean on that undocumented behavior.
        Ok(mut file) => {
            if let Err(e) = file.write_all(b"{}") {
                crate::debug_log::error(
                    "settings",
                    &format!("failed to initialize settings.json content: {e}"),
                );
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            if let Err(e) = fs::set_permissions(path, fs::Permissions::from_mode(0o600)) {
                crate::debug_log::error("settings", &format!("failed to chmod settings.json: {e}"));
            }
        }
        Err(e) => {
            crate::debug_log::error(
                "settings",
                &format!("failed to create settings.json with 0600: {e}"),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "beacon-settings-perms-test-{}-{name}.json",
            std::process::id()
        ))
    }

    #[test]
    fn secure_creates_missing_file_with_0600_and_valid_json() {
        let path = temp_path("missing");
        let _ = fs::remove_file(&path);

        secure(&path);

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert_eq!(fs::read_to_string(&path).unwrap(), "{}");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn secure_tightens_an_existing_file_left_at_a_wider_mode() {
        let path = temp_path("existing");
        fs::write(&path, "{}").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

        secure(&path);

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert_eq!(fs::read_to_string(&path).unwrap(), "{}");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn secure_leaves_content_untouched() {
        let path = temp_path("content");
        fs::write(&path, "{\"a\":1}").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();

        secure(&path);

        assert_eq!(fs::read_to_string(&path).unwrap(), "{\"a\":1}");
        let _ = fs::remove_file(&path);
    }
}
