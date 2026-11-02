//! `beacon://` URLs that let other tools open the popup, e.g. a Stream Deck key.
//!
//! The accessory activation policy discards an activation from outside, so
//! `open -a Beacon` shows nothing. The URL is handled here instead and goes
//! through the same functions as the tray click and the global shortcut.

use tauri::AppHandle;
use url::Url;

#[derive(Debug, PartialEq, Eq)]
enum Action {
    Show,
    Toggle,
}

fn parse(url: &Url) -> Option<Action> {
    if url.scheme() != "beacon" {
        return None;
    }
    match url.host_str()? {
        "show" => Some(Action::Show),
        "toggle" => Some(Action::Toggle),
        _ => None,
    }
}

pub fn handle(app: &AppHandle, urls: &[Url]) {
    for url in urls {
        match parse(url) {
            Some(Action::Show) => crate::tray::show_main_window(app),
            Some(Action::Toggle) => crate::tray::toggle_main_window(app),
            None => crate::debug_log::info("deep-link", "ignored an unsupported URL"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_str(input: &str) -> Option<Action> {
        parse(&Url::parse(input).unwrap())
    }

    #[test]
    fn maps_show_and_toggle() {
        assert_eq!(parse_str("beacon://show"), Some(Action::Show));
        assert_eq!(parse_str("beacon://toggle"), Some(Action::Toggle));
    }

    #[test]
    fn ignores_a_trailing_slash_and_query() {
        assert_eq!(parse_str("beacon://show/"), Some(Action::Show));
        assert_eq!(parse_str("beacon://toggle?x=1"), Some(Action::Toggle));
    }

    #[test]
    fn rejects_unsupported_urls() {
        assert_eq!(parse_str("beacon://quit"), None);
        assert_eq!(parse_str("beacon:show"), None);
        assert_eq!(parse_str("https://show"), None);
    }
}
