use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::Manager;

static EXPORT_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Resolve the export file path from the Tauri app-data directory.
/// Must be called once during `setup`.
pub fn init(app: &tauri::App) {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    let _ = fs::create_dir_all(&dir);
    let _ = EXPORT_PATH.set(dir.join("data.json"));
}

fn export_path() -> Option<&'static PathBuf> {
    EXPORT_PATH.get()
}

/// Write `contents` atomically: a temp file in the same directory is written
/// first, then renamed over `path`, so a reader never observes a partial
/// file. Permissions are set to `0600` before the rename, since the payload
/// can contain notification/ticket titles.
fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, contents)?;
    fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))?;
    fs::rename(&tmp_path, path)
}

fn remove_if_exists(path: &Path) -> std::io::Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn write_export_data(payload: String) -> Result<(), String> {
    let path = export_path().ok_or("export not initialised")?;
    write_atomic(path, &payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_export_data() -> Result<(), String> {
    let path = export_path().ok_or("export not initialised")?;
    remove_if_exists(path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "beacon-export-test-{}-{name}.json",
            std::process::id()
        ))
    }

    #[test]
    fn write_atomic_creates_file_with_expected_content_and_permissions() {
        let path = temp_path("write");
        write_atomic(&path, "{\"a\":1}").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "{\"a\":1}");
        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn write_atomic_leaves_no_tmp_file_behind() {
        let path = temp_path("tmp-cleanup");
        write_atomic(&path, "{}").unwrap();
        assert!(!path.with_extension("json.tmp").exists());
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn write_atomic_overwrites_an_existing_file() {
        let path = temp_path("overwrite");
        write_atomic(&path, "{\"a\":1}").unwrap();
        write_atomic(&path, "{\"a\":2}").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "{\"a\":2}");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn remove_if_exists_deletes_an_existing_file() {
        let path = temp_path("delete");
        fs::write(&path, "x").unwrap();
        remove_if_exists(&path).unwrap();
        assert!(!path.exists());
    }

    #[test]
    fn remove_if_exists_is_a_noop_when_the_file_is_missing() {
        let path = temp_path("missing");
        assert!(remove_if_exists(&path).is_ok());
    }
}
