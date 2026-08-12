use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use tauri::Manager;
use time::OffsetDateTime;

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static ENABLED: AtomicBool = AtomicBool::new(false);

const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024; // 5 MB

/// Initialise the log path from the Tauri app-data directory.
/// Must be called once during `setup`.
pub fn init(app: &tauri::App) {
    let dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("debug.log");
    let _ = LOG_PATH.set(path);
}

/// Enable or disable debug logging at runtime.
pub fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}

pub fn is_enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

fn log_path() -> Option<&'static PathBuf> {
    LOG_PATH.get()
}

fn rotate_if_needed(path: &PathBuf) {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_LOG_SIZE {
            let backup = path.with_extension("log.old");
            let _ = fs::rename(path, backup);
        }
    }
}

fn timestamp() -> String {
    let now = OffsetDateTime::now_utc();
    now.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "???".into())
}

/// Append a single log line. No-op when logging is disabled.
pub fn write(level: &str, source: &str, message: &str) {
    write_inner(level, source, message, false);
}

/// Append a log line unconditionally, even when debug logging is disabled.
/// Reserved for panic hooks and critical crash context.
pub fn write_always(level: &str, source: &str, message: &str) {
    write_inner(level, source, message, true);
}

fn write_inner(level: &str, source: &str, message: &str, force: bool) {
    if !force && !is_enabled() {
        return;
    }
    let Some(path) = log_path() else { return };
    rotate_if_needed(path);

    let line = format!("[{}] [{}] [{}] {}\n", timestamp(), level, source, message);

    let file = OpenOptions::new().create(true).append(true).open(path);
    if let Ok(mut f) = file {
        let _ = f.write_all(line.as_bytes());
    }
}

pub fn info(source: &str, msg: &str) {
    write("INFO", source, msg);
}

pub fn warn(source: &str, msg: &str) {
    write("WARN", source, msg);
}

pub fn error(source: &str, msg: &str) {
    write("ERROR", source, msg);
}

// ── Tauri commands (called from frontend) ───────────────────────

#[tauri::command]
pub fn write_log(level: String, source: String, message: String) {
    write(&level, &source, &message);
}

#[tauri::command]
pub fn clear_log() -> Result<(), String> {
    let Some(path) = log_path() else {
        return Err("log not initialised".into());
    };
    fs::write(path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_log_in_finder() -> Result<(), String> {
    let Some(path) = log_path() else {
        return Err("log not initialised".into());
    };
    // Ensure the file exists before revealing
    if !path.exists() {
        let _ = fs::write(path, "");
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        return Err("reveal in file manager is only supported on macOS".into());
    }
    Ok(())
}
