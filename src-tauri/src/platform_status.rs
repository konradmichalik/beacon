//! Polls the public GitHub/GitLab Statuspage APIs for connected services and
//! emits the result to the frontend, independent of the notification poll
//! loop in `polling.rs`.

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const GITHUB_STATUS_URL: &str = "https://www.githubstatus.com/api/v2/status.json";
const GITLAB_STATUS_URL: &str = "https://status.gitlab.com/api/v2/status.json";
const POLL_INTERVAL: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum IndicatorLevel {
    Ok,
    Degraded,
    Down,
}

#[derive(Debug, Clone, Serialize)]
struct PlatformStatus {
    indicator: IndicatorLevel,
    description: String,
}

#[derive(Deserialize)]
struct StatuspagePayload {
    status: StatuspageStatus,
}

#[derive(Deserialize)]
struct StatuspageStatus {
    indicator: String,
    description: String,
}

fn map_indicator(raw: &str) -> IndicatorLevel {
    match raw {
        "none" => IndicatorLevel::Ok,
        "minor" => IndicatorLevel::Degraded,
        "major" | "critical" => IndicatorLevel::Down,
        _ => IndicatorLevel::Down,
    }
}

fn parse_status_response(body: &str) -> Option<PlatformStatus> {
    let payload: StatuspagePayload = serde_json::from_str(body).ok()?;
    Some(PlatformStatus {
        indicator: map_indicator(&payload.status.indicator),
        description: payload.status.description,
    })
}

async fn fetch_status(client: &reqwest::Client, url: &str) -> Option<PlatformStatus> {
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.text().await.ok()?;
    parse_status_response(&body)
}

#[derive(Serialize)]
struct PlatformStatusEvent {
    github: Option<PlatformStatus>,
    gitlab: Option<PlatformStatus>,
}

/// Runs for the app's lifetime; independent of `polling::start_polling` /
/// `stop_polling` since the status check is cheap and useful even while the
/// notification poller is stopped.
///
/// Called synchronously from `setup()`, outside any Tokio task, so this must
/// go through Tauri's runtime-agnostic spawn rather than `tokio::spawn`
/// directly — the latter panics with "no reactor running" when there's no
/// ambient Tokio context to spawn onto (see `tray.rs`'s menu handler for the
/// same pattern from a sync callback).
pub fn spawn_loop(app: AppHandle) -> tauri::async_runtime::JoinHandle<()> {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .user_agent("Beacon")
            .build()
            .expect("http client");

        let mut last_github: Option<PlatformStatus> = None;
        let mut last_gitlab: Option<PlatformStatus> = None;

        loop {
            last_github = if crate::polling::github_is_configured(&app) {
                fetch_status(&client, GITHUB_STATUS_URL)
                    .await
                    .or(last_github)
            } else {
                None
            };

            last_gitlab = if crate::polling::gitlab_is_configured(&app) {
                fetch_status(&client, GITLAB_STATUS_URL)
                    .await
                    .or(last_gitlab)
            } else {
                None
            };

            let _ = app.emit(
                "platform-status-updated",
                &PlatformStatusEvent {
                    github: last_github.clone(),
                    gitlab: last_gitlab.clone(),
                },
            );

            tokio::time::sleep(POLL_INTERVAL).await;
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_indicator_none_is_ok() {
        assert_eq!(map_indicator("none"), IndicatorLevel::Ok);
    }

    #[test]
    fn map_indicator_minor_is_degraded() {
        assert_eq!(map_indicator("minor"), IndicatorLevel::Degraded);
    }

    #[test]
    fn map_indicator_major_is_down() {
        assert_eq!(map_indicator("major"), IndicatorLevel::Down);
    }

    #[test]
    fn map_indicator_critical_is_down() {
        assert_eq!(map_indicator("critical"), IndicatorLevel::Down);
    }

    #[test]
    fn map_indicator_unknown_defaults_to_down() {
        assert_eq!(map_indicator("something-new"), IndicatorLevel::Down);
    }

    #[test]
    fn parse_status_response_extracts_indicator_and_description() {
        let body = r#"{
            "page": {"id": "abc", "name": "GitHub"},
            "status": {"indicator": "minor", "description": "Partial outage"}
        }"#;
        let status = parse_status_response(body).expect("should parse");
        assert_eq!(status.indicator, IndicatorLevel::Degraded);
        assert_eq!(status.description, "Partial outage");
    }

    #[test]
    fn parse_status_response_returns_none_on_malformed_json() {
        assert!(parse_status_response("not json").is_none());
    }

    #[test]
    fn parse_status_response_returns_none_when_status_field_missing() {
        assert!(parse_status_response(r#"{"page": {"id": "abc"}}"#).is_none());
    }
}
