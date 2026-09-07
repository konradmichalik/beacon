# Development

## Prerequisites

- Node.js 18+
- Rust (via [rustup](https://rustup.rs/))
- Xcode Command Line Tools

## Getting Started

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

The `.app` and `.dmg` are written to `src-tauri/target/release/bundle/`.

## Linting

```bash
npm run lint          # ESLint + Prettier check
npm run lint:fix      # auto-fix ESLint + Prettier
npm run check         # svelte-check (TypeScript)
```

Rust (in `src-tauri/`):

```bash
cargo fmt --check     # formatting
cargo clippy          # lint
```

## Testing

```bash
npm test             # run frontend tests (Vitest)
npm run test:watch   # watch mode
```

Rust (in `src-tauri/`):

```bash
cargo test
```

### What is tested

| Scope                                            | Coverage                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Time formatting (`timeAgo`, `formatRefreshTime`) | Boundary cases: seconds, minutes, hours, days, date fallback, cross-year                                                             |
| API transform pipeline                           | GitHub & GitLab notification type mapping, URL construction, action→reason mapping, state normalization, CI status, review decisions |
| Rust polling transforms                          | Same mapping logic on the backend: `gh_type`, `gh_url`, `gl_type`, `gl_reason`, `gl_state`                                           |

Test files live next to the code they test (`*.test.ts`). Rust tests use `#[cfg(test)]` modules.

## CI

All checks run automatically on push and PR via GitHub Actions (`.github/workflows/ci.yml`):

- **Frontend:** ESLint, Prettier, svelte-check, Vitest
- **Rust:** rustfmt, Clippy, cargo test

## Demo Mode

Demo mode loads sample notifications without requiring API tokens. Useful for screenshots and UI development.

**Via URL parameter:**

```
http://localhost:5173/?demo
```

**Via environment variable:**

```bash
BEACON_DEMO=1 npm run tauri:dev
```

Demo data is defined in `src/lib/utils/demo-data.ts`.

## Icons

The app icon set in `src-tauri/icons/` (`icon.png`, `icon.icns`, `32x32.png`, `128x128.png`, `128x128@2x.png`, referenced from `tauri.conf.json`) is generated from a single square source PNG:

```bash
npm run tauri -- icon path/to/source.png -o src-tauri/icons
```

The command also generates iOS/Android/Windows variants this project doesn't ship (targets are `app`/`dmg` only) — keep just the five files above and discard the rest.

`icons/beacon-tray.png` (the menu bar tray icon) is a separate monochrome template image, not part of this generated set — update it by hand if the icon's silhouette changes.

## Project Structure

```
src/
├── lib/
│   ├── components/    # Svelte UI components
│   ├── services/      # GitHub & GitLab API clients
│   ├── stores/        # Reactive state (notifications, settings, filters)
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Helpers, demo data
src-tauri/
├── src/
│   ├── lib.rs         # App setup, tray icon rendering, NSPanel config
│   └── tray.rs        # Tray menu and click handling
└── icons/             # App and tray icons
```

## Tech Stack

| Layer             | Technology                               |
| ----------------- | ---------------------------------------- |
| Frontend          | Svelte 5, Tailwind CSS 4, Bits UI        |
| Desktop shell     | Tauri 2 (Rust)                           |
| macOS integration | Native NSPanel for tray popover behavior |
