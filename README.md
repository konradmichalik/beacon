<p align="center">
  <img src="assets/beacon-logo.svg" alt="Beacon" width="280">
</p>

<p align="center">
  A lightweight macOS menu bar app that brings GitHub and GitLab notifications into one place.<br>
  Learn more at <a href="https://konradmichalik.github.io/beacon/">konradmichalik.github.io/beacon</a>
</p>

<p align="center">
  <img src="assets/screenshot.jpg" alt="Beacon screenshot" width="680">
</p>

---

## ✨ Features

- **Unified inbox** for GitHub and GitLab notifications side by side, including local alerts for pull request changes GitHub/GitLab never notify about (a draft becoming ready for your review, or your PR becoming mergeable)
- **My PRs overview** — see open pull requests you authored or need to review, with CI, review and merge status at a glance
- **Issues overview** _(opt-in)_ — open issues you created or are assigned to, grouped by role; enable it in Settings
- **Menu bar popup** — lives quietly in the tray, one click to open
- **Filter & sort** by source, project, type, or read status — or type qualifiers like `repo:owner/name`, `author:login`, `type:pr` (with a leading `-` to exclude)
- **Desktop notifications** — instant alerts or batched summaries
- **Configurable badge** — unread count or a colored dot indicator

## 🍺 Installation

<a href="https://github.com/konradmichalik/homebrew-tap"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fkonradmichalik.github.io%2Fhomebrew-tap%2Fbadges%2Fbeacon-version.json&style=flat-square&logo=homebrew" alt="Homebrew version"></a>
<a href="https://github.com/konradmichalik/homebrew-tap"><img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fkonradmichalik.github.io%2Fhomebrew-tap%2Fbadges%2Fbeacon-downloads.json&style=flat-square&logo=homebrew" alt="Homebrew downloads"></a>

```bash
brew install konradmichalik/tap/beacon
```

> [!NOTE]
> Homebrew 6.0+ requires explicit trust for non-official taps. Installing the fully qualified formula above automatically trusts just `beacon` — no extra step needed. To trust the whole tap instead (e.g. for future short-name installs), run `brew tap konradmichalik/tap && brew trust konradmichalik/tap` first.

### Update

```bash
brew update && brew upgrade beacon
```

## ⚙️ Configuration

On first launch, open **Settings** via the gear icon or the tray context menu and add your tokens.

| Service | Token                                                                              | Required scope  |
| ------- | ---------------------------------------------------------------------------------- | --------------- |
| GitHub  | [Personal Access Token](https://github.com/settings/tokens/new)                    | `notifications` |
| GitLab  | [Personal Access Token](https://gitlab.com/-/user_settings/personal_access_tokens) | `api`           |

> [!TIP]
> GitLab supports self-hosted instances — set your instance's base URL in the GitLab settings panel.

> [!NOTE]
> Tokens are stored in the macOS Keychain, not in a plain file. Nothing is sent to any server other than GitHub and GitLab.

> [!TIP]
> The first time Beacon reads or writes a token, macOS shows a one-time "Beacon wants to use your confidential information stored in Keychain" prompt. Choose **Always Allow**. A signed release build only asks again after a signing-identity change; an unsigned local dev build asks on every launch, since its signature changes with every build — see [`CLAUDE.md`](./CLAUDE.md) if that's you.

### Export data for external apps

Enabling **Export data for external apps** in Settings writes a small JSON snapshot to
`~/Library/Application Support/com.beacon.notifications/data.json` after every refresh, so external
tools (e.g. a Stream Deck plugin) can read Beacon's current unread/review/PR/issue counts without
needing their own GitHub/GitLab credentials. The file is removed as soon as the setting is turned
off.

## 💎 Credits

Notification sounds from [Pixabay](https://pixabay.com).

## 📜 License

[MIT](LICENSE)
