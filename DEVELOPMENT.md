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

Both frontend and Rust linters run automatically on push and PR via GitHub Actions.

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
