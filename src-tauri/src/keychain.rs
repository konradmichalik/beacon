use security_framework::base::Error as SecError;
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};
use security_framework_sys::base::{errSecItemNotFound, errSecParam};
use serde_json::Value;
use tauri_plugin_store::StoreExt;

/// Only these two forge identifiers may reach the Keychain. Without this
/// allowlist a compromised or XSS'd webview could pass an attacker-chosen
/// service string and read or overwrite unrelated Keychain items.
fn service_id(forge: &str) -> Option<&'static str> {
    match forge {
        "github" => Some("com.beacon.notifications.github"),
        "gitlab" => Some("com.beacon.notifications.gitlab"),
        _ => None,
    }
}

/// Store `token` in the Keychain, creating or overwriting the item for
/// `service`/`account`.
fn set(service: &str, account: &str, token: &str) -> Result<(), SecError> {
    set_generic_password(service, account, token.as_bytes())
}

/// Read the token for `service`/`account`. A missing item is `Ok(None)`; any
/// other failure (denied prompt, locked keychain) is `Err`, so callers can
/// tell "never connected" apart from "temporarily unavailable".
fn get(service: &str, account: &str) -> Result<Option<String>, SecError> {
    match get_generic_password(service, account) {
        Ok(bytes) => String::from_utf8(bytes)
            .map(Some)
            .map_err(|_| SecError::from_code(errSecParam)),
        Err(e) if e.code() == errSecItemNotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Remove the Keychain item for `service`/`account`. A missing item counts
/// as success, matching the idempotent-delete semantics used elsewhere in
/// the app (see `export::remove_if_exists`).
fn delete(service: &str, account: &str) -> Result<(), SecError> {
    match delete_generic_password(service, account) {
        Ok(()) => Ok(()),
        Err(e) if e.code() == errSecItemNotFound => Ok(()),
        Err(e) => Err(e),
    }
}

// ── Tauri commands (frontend-facing) ────────────────────────────

#[tauri::command]
pub fn keychain_set_token(forge: String, account: String, token: String) -> Result<(), String> {
    let service = service_id(&forge).ok_or_else(|| format!("unknown forge: {forge}"))?;
    set(service, &account, &token).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn keychain_get_token(forge: String, account: String) -> Result<Option<String>, String> {
    let service = service_id(&forge).ok_or_else(|| format!("unknown forge: {forge}"))?;
    get(service, &account).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn keychain_delete_token(forge: String, account: String) -> Result<(), String> {
    let service = service_id(&forge).ok_or_else(|| format!("unknown forge: {forge}"))?;
    delete(service, &account).map_err(|e| e.to_string())
}

// ── Backend read path (polling) ─────────────────────────────────

/// Resolves a token for an already-migrated config. Blocking: a Keychain
/// read can show a modal authorization prompt (a denied item, or every
/// launch of an unsigned/ad-hoc dev build), so callers on the async poll
/// loop must run this via `tauri::async_runtime::spawn_blocking` rather than
/// calling it inline.
pub(crate) fn get_token(forge: &str, account: &str) -> Result<Option<String>, String> {
    let service = service_id(forge).ok_or_else(|| format!("unknown forge: {forge}"))?;
    get(service, account).map_err(|e| e.to_string())
}

// ── Startup migration ────────────────────────────────────────────

/// Move a plaintext token still embedded in `settings.json` (written by a
/// version predating the Keychain migration) into the Keychain, and rewrite
/// the stored config without it. Runs once per launch, in `setup()`, before
/// any webview loads — a frontend-side migration would race between the
/// settings and main webviews, which both call `initializeConnections()`.
///
/// Idempotent: the trigger is "a `token` key is present in the blob". After
/// a successful migration there is none, so later launches are a no-op.
pub fn init(app: &tauri::App) {
    migrate(app, "github-config", "github", |_| {
        Some("github.com".to_string())
    });
    migrate(app, "gitlab-config", "gitlab", |config| {
        config
            .get("baseUrl")
            .and_then(Value::as_str)
            .and_then(host_from_url)
    });
}

fn migrate(app: &tauri::App, key: &str, forge: &str, host_of: impl Fn(&Value) -> Option<String>) {
    let Some(service) = service_id(forge) else {
        return;
    };
    let Ok(store) = app.store("settings.json") else {
        return;
    };
    let Some(config) = store.get(key) else {
        return;
    };
    let Some((account, token, rewritten)) = strip_token(&config, &host_of) else {
        return;
    };

    // Never remove the token from settings.json unless the Keychain write
    // actually succeeded — losing a credential is worse than leaving the
    // interim plaintext copy around for one more launch.
    if let Err(e) = set(service, &account, &token) {
        crate::debug_log::error(
            "keychain",
            &format!("migration: failed to store {forge} token in Keychain: {e}"),
        );
        return;
    }

    store.set(key, rewritten);
    if let Err(e) = store.save() {
        crate::debug_log::error(
            "keychain",
            &format!("migration: failed to save settings.json after migrating {forge}: {e}"),
        );
    }
}

/// Pure transform: given the raw JSON blob stored under `github-config` or
/// `gitlab-config`, returns `(keychainAccount, token, rewritten-config)` when
/// a non-empty plaintext token is present, or `None` when there is nothing
/// to migrate (already migrated, or malformed).
fn strip_token(
    config: &Value,
    host_of: &impl Fn(&Value) -> Option<String>,
) -> Option<(String, String, Value)> {
    let obj = config.as_object()?;
    let token = obj.get("token")?.as_str()?;
    if token.is_empty() {
        return None;
    }

    let username = obj
        .get("username")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let host = host_of(config).unwrap_or_else(|| "unknown".to_string());
    let account = format!("{username}@{host}");

    let mut rewritten = obj.clone();
    rewritten.remove("token");
    rewritten.insert(
        "keychainAccount".to_string(),
        Value::String(account.clone()),
    );

    Some((account, token.to_string(), Value::Object(rewritten)))
}

fn host_from_url(base_url: &str) -> Option<String> {
    url::Url::parse(base_url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn github_host(_: &Value) -> Option<String> {
        Some("github.com".to_string())
    }

    fn gitlab_host(config: &Value) -> Option<String> {
        config
            .get("baseUrl")
            .and_then(Value::as_str)
            .and_then(host_from_url)
    }

    #[test]
    fn service_id_allows_only_the_two_known_forges() {
        assert_eq!(
            service_id("github"),
            Some("com.beacon.notifications.github")
        );
        assert_eq!(
            service_id("gitlab"),
            Some("com.beacon.notifications.gitlab")
        );
        assert_eq!(service_id(""), None);
        assert_eq!(service_id("Github"), None);
        assert_eq!(service_id("../other"), None);
        assert_eq!(service_id("com.apple.something"), None);
    }

    #[test]
    fn strip_token_extracts_account_and_token_and_removes_token() {
        let config = json!({ "type": "pat", "username": "octocat", "token": "ghp_abc123" });
        let (account, token, rewritten) = strip_token(&config, &github_host).unwrap();
        assert_eq!(account, "octocat@github.com");
        assert_eq!(token, "ghp_abc123");
        assert!(rewritten.as_object().unwrap().get("token").is_none());
        assert_eq!(rewritten["keychainAccount"], "octocat@github.com");
        assert_eq!(rewritten["username"], "octocat");
    }

    #[test]
    fn strip_token_derives_host_from_self_hosted_gitlab_base_url() {
        let config = json!({
            "type": "pat",
            "username": "kmichalik",
            "baseUrl": "https://gitlab.example.com/api/v4",
            "token": "glpat-xyz"
        });
        let (account, token, _) = strip_token(&config, &gitlab_host).unwrap();
        assert_eq!(account, "kmichalik@gitlab.example.com");
        assert_eq!(token, "glpat-xyz");
    }

    #[test]
    fn strip_token_is_none_when_already_migrated() {
        let config = json!({ "type": "pat", "username": "octocat", "keychainAccount": "octocat@github.com" });
        assert!(strip_token(&config, &github_host).is_none());
    }

    #[test]
    fn strip_token_is_none_for_an_empty_token() {
        let config = json!({ "username": "octocat", "token": "" });
        assert!(strip_token(&config, &github_host).is_none());
    }

    #[test]
    fn strip_token_falls_back_to_unknown_username() {
        let config = json!({ "token": "ghp_abc123" });
        let (account, _, _) = strip_token(&config, &github_host).unwrap();
        assert_eq!(account, "unknown@github.com");
    }

    #[test]
    fn strip_token_is_none_for_a_malformed_blob() {
        assert!(strip_token(&json!("not an object"), &github_host).is_none());
        assert!(strip_token(&json!(null), &github_host).is_none());
    }

    #[test]
    fn host_from_url_strips_scheme_path_and_port() {
        assert_eq!(
            host_from_url("https://gitlab.example.com/api/v4"),
            Some("gitlab.example.com".to_string())
        );
        assert_eq!(
            host_from_url("https://gitlab.example.com:8443"),
            Some("gitlab.example.com".to_string())
        );
        assert_eq!(host_from_url("not a url"), None);
    }

    // Round-trip against the real Keychain. Ignored by default: the test
    // binary is ad-hoc signed and its cdhash changes on every build, so a
    // real Keychain access raises an interactive authorization dialog and
    // would hang CI. Run manually with `cargo test -- --ignored keychain`.
    #[test]
    #[ignore]
    fn set_get_delete_round_trip_against_the_real_keychain() {
        let service = format!("com.beacon.notifications.test-{}", std::process::id());
        let account = "roundtrip-test";

        set(&service, account, "secret-value").unwrap();
        assert_eq!(
            get(&service, account).unwrap(),
            Some("secret-value".to_string())
        );

        set(&service, account, "updated-value").unwrap();
        assert_eq!(
            get(&service, account).unwrap(),
            Some("updated-value".to_string())
        );

        delete(&service, account).unwrap();
        assert_eq!(get(&service, account).unwrap(), None);
    }
}
