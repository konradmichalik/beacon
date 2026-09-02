use std::fs;
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;

use tauri::Manager;

static EXPORT_PATH: OnceLock<PathBuf> = OnceLock::new();
static TMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

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

/// Write `contents` atomically: a uniquely-named temp file in the same
/// directory is written first, then renamed over `path`, so a reader never
/// observes a partial file. The temp path is unique per call (pid + a
/// monotonic counter) and created exclusively, so concurrent writers can
/// never clobber each other's temp file. Permissions are `0600` from
/// creation, with no window where the file is briefly world-readable, since
/// the payload can contain notification/ticket titles.
fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    let seq = TMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let tmp_path = path.with_extension(format!("json.tmp.{}.{seq}", std::process::id()));

    let result = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&tmp_path)
        .and_then(|mut file| {
            file.write_all(contents.as_bytes())
                .and_then(|()| file.sync_all())
        });

    if let Err(e) = result {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }

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
    match write_atomic(path, &payload) {
        Ok(()) => {
            crate::debug_log::info("export", "wrote data.json");
            Ok(())
        }
        Err(e) => {
            crate::debug_log::error("export", &format!("failed to write data.json: {e}"));
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn delete_export_data() -> Result<(), String> {
    let path = export_path().ok_or("export not initialised")?;
    match remove_if_exists(path) {
        Ok(()) => {
            crate::debug_log::info("export", "deleted data.json");
            Ok(())
        }
        Err(e) => {
            crate::debug_log::error("export", &format!("failed to delete data.json: {e}"));
            Err(e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

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
        assert_eq!(sibling_tmp_files(&path).len(), 0);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn concurrent_writes_never_corrupt_or_leak_tmp_files() {
        let path = temp_path("concurrent");
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
        let handles: Vec<_> = (0..8)
            .map(|i| {
                let path = path.clone();
                let barrier = std::sync::Arc::clone(&barrier);
                std::thread::spawn(move || {
                    barrier.wait();
                    write_atomic(&path, &format!("{{\"writer\":{i}}}")).unwrap();
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }

        // Every writer used its own temp file, so none should be left behind
        // regardless of interleaving.
        assert_eq!(sibling_tmp_files(&path).len(), 0);

        // The final file is always one complete writer's payload, never a
        // mix of two writes.
        let content = fs::read_to_string(&path).unwrap();
        assert!(
            (0..8).any(|i| content == format!("{{\"writer\":{i}}}")),
            "unexpected content: {content}"
        );
        let _ = fs::remove_file(&path);
    }

    fn sibling_tmp_files(path: &Path) -> Vec<PathBuf> {
        let dir = path.parent().unwrap();
        let prefix = path.file_name().unwrap().to_string_lossy().into_owned();
        fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| n.starts_with(&format!("{prefix}.tmp")))
            })
            .collect()
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
