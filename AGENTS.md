# AGENTS.md

## Project overview

Beacon is a macOS menu bar app that provides a unified notification hub for GitHub and GitLab. It is built with Tauri 2 (Rust backend) and Svelte 5 with TypeScript (frontend). CI uses Node.js 22.

## Structure

- `src/`: Svelte frontend
  - `lib/stores/`: module-level rune state in `.svelte.ts` files (notifications, connections, settings, pull-requests, mute-rules). `pull-requests` diffs consecutive polls (`lib/utils/pr-transitions.ts`) and feeds locally generated (`synthetic: true`) entries into `notifications`
  - `lib/services/github/`, `lib/services/gitlab/`: API clients that map platform responses to `UnifiedNotification` and `UnifiedPullRequest`
  - `lib/types/`: shared TypeScript interfaces
  - `lib/components/`: UI by feature (notifications, pull-requests, issues, settings, layout, connection, icons, ui)
  - `lib/utils/storage.ts`: wrapper around Tauri's encrypted store plugin
  - `landing/`: landing page (separate Vite config)
- `src-tauri/src/`: Rust backend
  - `lib.rs`: app setup, Tauri commands, tray icon rendering, NSPanel subclass, global shortcuts
  - `polling.rs`: polling loop for GitHub notifications and GitLab todos
  - `tray.rs`: tray click handling and window positioning
  - `keychain.rs`: forge tokens in the macOS Keychain
  - `export.rs`: opt-in `data.json` export (atomic write, `0600`)
  - `debug_log.rs`: optional file logging with rotation
- `docs/`: `DEVELOPMENT.md` and `RELEASE.md`, `docs/design/`: design rules and screen designs

Frontend and backend talk through Tauri commands (`invoke(...)`, frontend to backend) and events (`notifications:update`, `notifications:summary`, backend to frontend). Settings, tokens and read state persist in the Tauri store plugin.

## Development commands

```bash
npm install
npm run tauri:dev      # full app with hot reload (Vite and Tauri)
npm run dev            # frontend only, Vite on port 5199
npm run tauri:test     # rebuild and open the bundled app, needed for tray testing
npm run tauri:build    # production macOS app (.app and .dmg)
npm run build:pages    # landing page
```

- `tauri:dev` produces a non-bundled binary that macOS refuses to show in the menu bar, use `tauri:test` for tray work
- Unsigned local builds re-prompt for Keychain access on every launch, this is expected
- Set `BEACON_DEMO=1` or the `?demo` URL parameter to load fake data without API tokens
- Vite injects `__APP_VERSION__`, `__APP_NAME__`, `__BUILD_DATE__` and `__DEMO_MODE__`

## Testing

```bash
npm test                                   # Vitest, single run
npm run test:watch
npx vitest run src/lib/utils/time.test.ts  # single file
cd src-tauri && cargo test                 # Rust tests
```

## Code style and linting

```bash
npm run lint         # ESLint and Prettier check
npm run lint:fix
npm run check        # svelte-check
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy -- -D warnings
```

- CI runs lint, check and test on ubuntu, then `cargo fmt --check`, clippy and `cargo test` on macOS
- Svelte 5 runes (`$state`, `$derived`, `$effect`), no legacy stores
- Prettier: single quotes, no trailing commas, 100 character width, `prettier-plugin-svelte`
- The `$lib` alias resolves to `src/lib`
- The `state_referenced_locally` Svelte warning is suppressed on purpose
- macOS only: uses the `macos-private-api` Tauri feature and `objc2` bindings

## Design

- Every change to the popup (also where the landing page embeds it) or the Settings window follows [`docs/design/rules.md`](docs/design/rules.md). The target screens are listed in [`docs/design/screens.md`](docs/design/screens.md)
- A change that needs to break a rule updates `rules.md` in the same pull request

## Git workflow

- Commit format: `<type>: <description>`, with type one of feat, fix, refactor, docs, test, chore, perf, ci
- One commit per logical change, no co-author trailers
- Releases are described in `docs/RELEASE.md`
