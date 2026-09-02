use std::fs;
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
    let _ = fs::create_dir_all(&dir);
    secure(&dir.join("settings.json"));
}

fn secure(path: &Path) {
    let created = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .is_ok();

    if !created {
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
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
    fn secure_creates_missing_file_with_0600() {
        let path = temp_path("missing");
        let _ = fs::remove_file(&path);

        secure(&path);

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
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
