use std::collections::HashSet;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

// ── Config types (mirrors JS store) ─────────────────────────────

#[derive(Deserialize)]
struct GitHubConfig {
    token: String,
    username: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitLabConfig {
    token: String,
    base_url: String,
    username: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default = "default_interval")]
    polling_interval: u64,
    #[serde(default)]
    notify_mode: NotifyMode,
    #[serde(default = "default_summary_min")]
    notify_summary_minutes: u64,
    #[serde(default = "default_badge")]
    badge_mode: String,
    #[serde(default = "default_dot")]
    dot_color: String,
}

#[derive(Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
enum NotifyMode {
    #[default]
    Disabled,
    Instant,
    Summary,
}

fn default_interval() -> u64 {
    300
}
fn default_summary_min() -> u64 {
    15
}
fn default_badge() -> String {
    "count".into()
}
fn default_dot() -> String {
    "blue".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            polling_interval: default_interval(),
            notify_mode: NotifyMode::default(),
            notify_summary_minutes: default_summary_min(),
            badge_mode: default_badge(),
            dot_color: default_dot(),
        }
    }
}

// ── GitHub API types ────────────────────────────────────────────

#[derive(Deserialize)]
struct GHNotification {
    id: String,
    unread: bool,
    reason: String,
    updated_at: String,
    subject: GHSubject,
    repository: GHRepo,
}

#[derive(Deserialize)]
struct GHSubject {
    title: String,
    url: Option<String>,
    #[serde(rename = "type")]
    subject_type: String,
}

#[derive(Deserialize)]
struct GHRepo {
    full_name: String,
    html_url: String,
}

#[derive(Deserialize, Default)]
struct GHDetail {
    html_url: Option<String>,
    state: Option<String>,
    #[serde(default)]
    merged: bool,
    user: Option<GHUser>,
}

#[derive(Deserialize)]
struct GHUser {
    login: String,
    avatar_url: String,
}

// ── GitLab API types ────────────────────────────────────────────

#[derive(Deserialize)]
struct GLTodo {
    id: u64,
    action_name: String,
    target_type: String,
    target_url: String,
    body: String,
    state: String,
    created_at: String,
    updated_at: String,
    project: GLProject,
    target: GLTarget,
    author: GLAuthor,
}

#[derive(Deserialize)]
struct GLProject {
    path_with_namespace: String,
}

#[derive(Deserialize)]
struct GLTarget {
    title: String,
    state: Option<String>,
    updated_at: Option<String>,
}

#[derive(Deserialize)]
struct GLAuthor {
    username: String,
    avatar_url: String,
}

// ── Unified notification (emitted to frontend) ──────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UnifiedNotification {
    id: String,
    source: String,
    #[serde(rename = "type")]
    kind: String,
    title: String,
    repository: String,
    url: String,
    reason: String,
    unread: bool,
    updated_at: String,
    created_at: String,
    author: Option<Author>,
    subject_state: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Author {
    login: String,
    avatar_url: String,
}

// ── Poller state ────────────────────────────────────────────────

pub struct Poller {
    client: reqwest::Client,
    inner: Mutex<PollerInner>,
}

struct PollerInner {
    known_ids: HashSet<String>,
    first_run: bool,
    summary_buffer: Vec<UnifiedNotification>,
    last_summary_flush: std::time::Instant,
    task_handle: Option<tokio::task::JoinHandle<()>>,
}

impl Poller {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("Beacon")
                .build()
                .expect("http client"),
            inner: Mutex::new(PollerInner {
                known_ids: HashSet::new(),
                first_run: true,
                summary_buffer: Vec::new(),
                last_summary_flush: std::time::Instant::now(),
                task_handle: None,
            }),
        }
    }
}

// ── Store helpers ───────────────────────────────────────────────

fn read_store(app: &AppHandle) -> (Option<GitHubConfig>, Option<GitLabConfig>, Settings) {
    let Ok(store) = app.store("settings.json") else {
        return (None, None, Settings::default());
    };
    let gh = store
        .get("github-config")
        .and_then(|v| serde_json::from_value(v).ok());
    let gl = store
        .get("gitlab-config")
        .and_then(|v| serde_json::from_value(v).ok());
    let settings = store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    (gh, gl, settings)
}

// ── GitHub fetching ─────────────────────────────────────────────

fn gh_type(t: &str) -> &str {
    match t {
        "Issue" => "issue",
        "PullRequest" => "pull_request",
        "Release" => "release",
        "Discussion" => "discussion",
        _ => "other",
    }
}

fn gh_url(n: &GHNotification) -> String {
    if let Some(ref api_url) = n.subject.url {
        if let Some((prefix, num)) = api_url.rsplit_once('/') {
            if num.chars().all(|c| c.is_ascii_digit()) {
                if let Some((_, seg)) = prefix.rsplit_once('/') {
                    let base = &n.repository.html_url;
                    match seg {
                        "pulls" => return format!("{base}/pull/{num}"),
                        "issues" => return format!("{base}/issues/{num}"),
                        "releases" => return format!("{base}/releases/tag/{num}"),
                        "discussions" => return format!("{base}/discussions/{num}"),
                        _ => {}
                    }
                }
            }
            // Commits use a SHA (hex), not a numeric ID
            if num.chars().all(|c| c.is_ascii_hexdigit()) && num.len() >= 7 {
                if let Some((_, seg)) = prefix.rsplit_once('/') {
                    if seg == "commits" {
                        return format!("{}/commit/{num}", n.repository.html_url);
                    }
                }
            }
        }
    }
    n.repository.html_url.clone()
}

async fn gh_detail(client: &reqwest::Client, url: &str, token: &str) -> GHDetail {
    let resp = client
        .get(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;
    match resp {
        Ok(r) if r.status().is_success() => match r.json::<GHDetail>().await {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[beacon] detail JSON parse failed for {url}: {e}");
                GHDetail::default()
            }
        },
        Ok(r) => {
            eprintln!("[beacon] detail fetch {} returned {}", url, r.status());
            GHDetail::default()
        }
        Err(e) => {
            eprintln!("[beacon] detail fetch failed for {url}: {e}");
            GHDetail::default()
        }
    }
}

async fn fetch_github(client: &reqwest::Client, config: &GitHubConfig) -> Vec<UnifiedNotification> {
    let resp = client
        .get("https://api.github.com/notifications?participating=false&all=false")
        .header("Authorization", format!("Bearer {}", config.token))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;

    let items: Vec<GHNotification> = match resp {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        _ => return vec![],
    };

    let mut handles = Vec::with_capacity(items.len());
    for n in items {
        let c = client.clone();
        let token = config.token.clone();
        let username = config.username.clone();
        handles.push(tokio::spawn(async move {
            let detail = match n.subject.url {
                Some(ref url) => gh_detail(&c, url, &token).await,
                None => GHDetail::default(),
            };

            let author = detail.user.map(|u| Author {
                login: u.login,
                avatar_url: u.avatar_url,
            });

            // Filter out own notifications
            if author.as_ref().is_some_and(|a| a.login == username) {
                return None;
            }

            let state = match (detail.state.as_deref(), detail.merged) {
                (Some("closed"), true) => Some("merged".into()),
                (Some("closed"), false) => Some("closed".into()),
                (Some("open"), _) => Some("open".into()),
                _ => None,
            };

            let url = detail.html_url.clone().unwrap_or_else(|| gh_url(&n));
            eprintln!(
                "[beacon] notification id={} type={} subject_url={:?} detail_html_url={:?} resolved_url={}",
                n.id, n.subject.subject_type, n.subject.url, detail.html_url, url
            );
            Some(UnifiedNotification {
                id: format!("github-{}", n.id),
                source: "github".into(),
                kind: gh_type(&n.subject.subject_type).into(),
                title: n.subject.title,
                repository: n.repository.full_name,
                url,
                reason: n.reason,
                unread: n.unread,
                created_at: n.updated_at.clone(),
                updated_at: n.updated_at,
                author,
                subject_state: state,
            })
        }));
    }

    let mut results = Vec::new();
    for h in handles {
        if let Ok(Some(n)) = h.await {
            results.push(n);
        }
    }
    results
}

// ── GitLab fetching ─────────────────────────────────────────────

fn gl_type(t: &str) -> &str {
    match t {
        "Issue" => "issue",
        "MergeRequest" => "merge_request",
        "Pipeline" => "pipeline",
        _ => "other",
    }
}

fn gl_reason(action: &str, body: &str) -> String {
    match action {
        "assigned" => "assign",
        "mentioned" | "directly_addressed" => "mention",
        "build_failed" => "ci_activity",
        "marked" | "review_requested" => "review_requested",
        "approval_required" => "approval_requested",
        "approved" => "approved",
        "review_submitted" => {
            if body.trim().is_empty() {
                return "approved".into();
            }
            let l = body.to_lowercase();
            return if l.contains("requested changes") || l.contains("change") {
                "change_requested".into()
            } else {
                "review_submitted".into()
            };
        }
        "change_requested" => "change_requested",
        "unmergeable" => "unmergeable",
        "merge_train_removed" => "merge_train_removed",
        "member_access_requested" => "member_access_requested",
        _ => return action.into(),
    }
    .into()
}

fn gl_state(s: Option<&str>) -> Option<String> {
    match s {
        Some("merged") => Some("merged".into()),
        Some("closed") => Some("closed".into()),
        Some("opened") => Some("open".into()),
        _ => None,
    }
}

async fn fetch_gitlab(client: &reqwest::Client, config: &GitLabConfig) -> Vec<UnifiedNotification> {
    let base = config.base_url.trim_end_matches('/');
    let resp = client
        .get(format!("{base}/api/v4/todos?state=pending&per_page=50"))
        .header("Authorization", format!("Bearer {}", config.token))
        .send()
        .await;

    let items: Vec<GLTodo> = match resp {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        _ => return vec![],
    };

    items
        .into_iter()
        .filter(|t| t.author.username != config.username)
        .map(|t| {
            // Use the latest of todo.updated_at and target.updated_at so the
            // displayed time reflects the most recent MR activity, not just
            // when the todo was originally created.
            let effective_updated = match &t.target.updated_at {
                Some(target_ts) if target_ts.as_str() > t.updated_at.as_str() => target_ts.clone(),
                _ => t.updated_at,
            };
            UnifiedNotification {
                id: format!("gitlab-{}", t.id),
                source: "gitlab".into(),
                kind: gl_type(&t.target_type).into(),
                title: t.target.title,
                repository: t.project.path_with_namespace,
                url: t.target_url,
                reason: gl_reason(&t.action_name, &t.body),
                unread: t.state == "pending",
                updated_at: effective_updated,
                created_at: t.created_at,
                author: Some(Author {
                    login: t.author.username,
                    avatar_url: t.author.avatar_url,
                }),
                subject_state: gl_state(t.target.state.as_deref()),
            }
        })
        .collect()
}

// ── Desktop notifications ───────────────────────────────────────

fn send_native(app: &AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

fn process_new(
    app: &AppHandle,
    inner: &mut PollerInner,
    items: &[UnifiedNotification],
    settings: &Settings,
) {
    if settings.notify_mode == NotifyMode::Disabled {
        return;
    }

    let unread: Vec<&UnifiedNotification> = items.iter().filter(|n| n.unread).collect();

    if inner.first_run {
        inner.known_ids = unread.iter().map(|n| n.id.clone()).collect();
        inner.first_run = false;
        return;
    }

    let new_items: Vec<&UnifiedNotification> = unread
        .iter()
        .filter(|n| !inner.known_ids.contains(&n.id))
        .copied()
        .collect();

    inner.known_ids = unread.iter().map(|n| n.id.clone()).collect();

    if new_items.is_empty() {
        return;
    }

    match settings.notify_mode {
        NotifyMode::Instant => {
            if new_items.len() == 1 {
                send_native(app, &new_items[0].repository, &new_items[0].title);
            } else {
                send_native(
                    app,
                    "Beacon",
                    &format!("{} new notifications", new_items.len()),
                );
            }
        }
        NotifyMode::Summary => {
            inner
                .summary_buffer
                .extend(new_items.iter().map(|n| (*n).clone()));

            let interval = std::time::Duration::from_secs(settings.notify_summary_minutes * 60);
            if inner.last_summary_flush.elapsed() >= interval && !inner.summary_buffer.is_empty() {
                let count = inner.summary_buffer.len();
                let repos: HashSet<&str> = inner
                    .summary_buffer
                    .iter()
                    .map(|n| n.repository.as_str())
                    .collect();
                let body = if repos.len() <= 3 {
                    let list: Vec<_> = repos.into_iter().collect();
                    format!("{count} new in {}", list.join(", "))
                } else {
                    format!("{count} new across {} projects", repos.len())
                };
                send_native(app, "Beacon", &body);
                inner.summary_buffer.clear();
                inner.last_summary_flush = std::time::Instant::now();
            }
        }
        NotifyMode::Disabled => {}
    }
}

// ── Core poll ───────────────────────────────────────────────────

async fn do_poll(app: &AppHandle) {
    let poller = app.state::<Arc<Poller>>();
    let (gh_config, gl_config, settings) = read_store(app);

    let (gh, gl) = tokio::join!(
        async {
            match gh_config {
                Some(ref c) => fetch_github(&poller.client, c).await,
                None => vec![],
            }
        },
        async {
            match gl_config {
                Some(ref c) => fetch_gitlab(&poller.client, c).await,
                None => vec![],
            }
        }
    );

    let mut results = Vec::with_capacity(gh.len() + gl.len());
    results.extend(gh);
    results.extend(gl);

    results.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    {
        let mut inner = poller.inner.lock().await;
        process_new(app, &mut inner, &results, &settings);
    }

    let unread = results.iter().filter(|n| n.unread).count() as u32;
    let _ = crate::update_tray_icon(app, unread, &settings.badge_mode, &settings.dot_color);

    let _ = app.emit("notifications-updated", &results);
}

// ── Poll loop ───────────────────────────────────────────────────

fn spawn_loop(app: AppHandle) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        do_poll(&app).await;

        loop {
            let (_, _, settings) = read_store(&app);
            let interval = std::time::Duration::from_secs(settings.polling_interval);
            tokio::time::sleep(interval).await;
            do_poll(&app).await;
        }
    })
}

// ── Tauri commands ──────────────────────────────────────────────

#[tauri::command]
pub async fn start_polling(app: AppHandle) -> Result<(), String> {
    let poller = app.state::<Arc<Poller>>();
    let mut inner = poller.inner.lock().await;

    if let Some(h) = inner.task_handle.take() {
        h.abort();
    }

    inner.known_ids.clear();
    inner.first_run = true;
    inner.summary_buffer.clear();
    inner.last_summary_flush = std::time::Instant::now();

    inner.task_handle = Some(spawn_loop(app.clone()));
    Ok(())
}

#[tauri::command]
pub async fn stop_polling(app: AppHandle) -> Result<(), String> {
    let poller = app.state::<Arc<Poller>>();
    let mut inner = poller.inner.lock().await;
    if let Some(h) = inner.task_handle.take() {
        h.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn trigger_poll(app: AppHandle) -> Result<(), String> {
    do_poll(&app).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── GitHub type mapping ──────────────────────────────────────

    #[test]
    fn gh_type_maps_known_types() {
        assert_eq!(gh_type("Issue"), "issue");
        assert_eq!(gh_type("PullRequest"), "pull_request");
        assert_eq!(gh_type("Release"), "release");
        assert_eq!(gh_type("Discussion"), "discussion");
    }

    #[test]
    fn gh_type_defaults_to_other() {
        assert_eq!(gh_type("CheckSuite"), "other");
        assert_eq!(gh_type(""), "other");
    }

    // ── GitHub URL construction ──────────────────────────────────

    fn make_gh_notification(subject_url: Option<&str>) -> GHNotification {
        GHNotification {
            id: "1".into(),
            unread: true,
            reason: "review_requested".into(),
            updated_at: "2026-03-17T12:00:00Z".into(),
            subject: GHSubject {
                title: "Test".into(),
                url: subject_url.map(Into::into),
                subject_type: "PullRequest".into(),
            },
            repository: GHRepo {
                full_name: "owner/repo".into(),
                html_url: "https://github.com/owner/repo".into(),
            },
        }
    }

    #[test]
    fn gh_url_converts_pulls_api_to_html() {
        let n = make_gh_notification(Some("https://api.github.com/repos/owner/repo/pulls/42"));
        assert_eq!(gh_url(&n), "https://github.com/owner/repo/pull/42");
    }

    #[test]
    fn gh_url_converts_issues_api_to_html() {
        let n = make_gh_notification(Some("https://api.github.com/repos/owner/repo/issues/7"));
        assert_eq!(gh_url(&n), "https://github.com/owner/repo/issues/7");
    }

    #[test]
    fn gh_url_converts_releases_api_to_html() {
        let n = make_gh_notification(Some("https://api.github.com/repos/owner/repo/releases/99"));
        assert_eq!(gh_url(&n), "https://github.com/owner/repo/releases/tag/99");
    }

    #[test]
    fn gh_url_converts_discussions_api_to_html() {
        let n = make_gh_notification(Some("https://api.github.com/repos/owner/repo/discussions/15"));
        assert_eq!(gh_url(&n), "https://github.com/owner/repo/discussions/15");
    }

    #[test]
    fn gh_url_converts_commits_api_to_html() {
        let n = make_gh_notification(Some("https://api.github.com/repos/owner/repo/commits/abc123def456"));
        assert_eq!(gh_url(&n), "https://github.com/owner/repo/commit/abc123def456");
    }

    #[test]
    fn gh_url_falls_back_to_repo_url() {
        let n = make_gh_notification(None);
        assert_eq!(gh_url(&n), "https://github.com/owner/repo");

        let n2 = make_gh_notification(Some("https://api.github.com/repos/owner/repo/check-suites/99"));
        assert_eq!(gh_url(&n2), "https://github.com/owner/repo");
    }

    // ── GitLab type mapping ──────────────────────────────────────

    #[test]
    fn gl_type_maps_known_types() {
        assert_eq!(gl_type("Issue"), "issue");
        assert_eq!(gl_type("MergeRequest"), "merge_request");
        assert_eq!(gl_type("Pipeline"), "pipeline");
    }

    #[test]
    fn gl_type_defaults_to_other() {
        assert_eq!(gl_type("Epic"), "other");
    }

    // ── GitLab reason mapping ────────────────────────────────────

    #[test]
    fn gl_reason_maps_common_actions() {
        assert_eq!(gl_reason("assigned", ""), "assign");
        assert_eq!(gl_reason("mentioned", ""), "mention");
        assert_eq!(gl_reason("directly_addressed", ""), "mention");
        assert_eq!(gl_reason("build_failed", ""), "ci_activity");
        assert_eq!(gl_reason("review_requested", ""), "review_requested");
        assert_eq!(gl_reason("approval_required", ""), "approval_requested");
        assert_eq!(gl_reason("approved", ""), "approved");
        assert_eq!(gl_reason("unmergeable", ""), "unmergeable");
    }

    #[test]
    fn gl_reason_review_submitted_empty_body() {
        assert_eq!(gl_reason("review_submitted", ""), "approved");
        assert_eq!(gl_reason("review_submitted", "  "), "approved");
    }

    #[test]
    fn gl_reason_review_submitted_with_changes() {
        assert_eq!(
            gl_reason("review_submitted", "Requested changes on line 5"),
            "change_requested"
        );
    }

    #[test]
    fn gl_reason_review_submitted_with_comment() {
        assert_eq!(
            gl_reason("review_submitted", "Looks good overall"),
            "review_submitted"
        );
    }

    #[test]
    fn gl_reason_passes_through_unknown() {
        assert_eq!(gl_reason("some_new_action", ""), "some_new_action");
    }

    // ── GitLab state mapping ─────────────────────────────────────

    #[test]
    fn gl_state_maps_known_states() {
        assert_eq!(gl_state(Some("merged")), Some("merged".into()));
        assert_eq!(gl_state(Some("closed")), Some("closed".into()));
        assert_eq!(gl_state(Some("opened")), Some("open".into()));
    }

    #[test]
    fn gl_state_returns_none_for_unknown() {
        assert_eq!(gl_state(None), None);
        assert_eq!(gl_state(Some("locked")), None);
    }
}
