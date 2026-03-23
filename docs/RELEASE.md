# Release

## Overview

Releases are fully automated via GitHub Actions. Pushing a version tag triggers the build, creates a GitHub Release with macOS binaries, and updates the Homebrew tap.

## Release Steps

1. **Bump versions** in both files (they must match):
   - `package.json` — `"version": "x.y.z"`
   - `src-tauri/tauri.conf.json` — `"version": "x.y.z"`

2. **Commit the version bump:**

   ```bash
   git add package.json src-tauri/tauri.conf.json
   git commit -m "chore: bump version to x.y.z"
   ```

3. **Tag and push:**

   ```bash
   git tag vx.y.z
   git push origin main vx.y.z
   ```

The `v*` tag triggers the release workflow automatically.

## What Happens Automatically

The workflow (`.github/workflows/release.yml`) runs two jobs:

### 1. Build & Release

- Builds for **Apple Silicon** (`aarch64-apple-darwin`) and **Intel** (`x86_64-apple-darwin`)
- Produces `.dmg` and `.app.tar.gz` for each architecture
- Creates a GitHub Release with all assets attached

Asset naming follows the pattern: `Beacon_{version}_{arch}.{ext}`

### 2. Homebrew Tap Update

- Waits for both DMG assets to be available
- Downloads them and computes SHA256 hashes
- Dispatches an update event to [`konradmichalik/homebrew-tap`](https://github.com/konradmichalik/homebrew-tap)
- The tap repository regenerates the cask definition with the new version and hashes

After the workflow completes, users can install or upgrade via:

```bash
brew install konradmichalik/tap/beacon
brew upgrade beacon
```

## Version Sync

Both `package.json` and `src-tauri/tauri.conf.json` must have the same version string. Tauri uses its own config for the DMG filename, while the Homebrew update job reads the version from `package.json`. A mismatch causes the Homebrew cask to reference a non-existent filename.

## Re-releasing a Tag

If a release needs to be redone (e.g. broken assets):

```bash
gh release delete vx.y.z --yes --cleanup-tag
git tag -d vx.y.z
git tag vx.y.z
git push origin vx.y.z
```

## Requirements

The release workflow requires these repository secrets:

| Secret               | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `GITHUB_TOKEN`       | Provided automatically by GitHub Actions         |
| `HOMEBREW_TAP_TOKEN` | PAT with access to `konradmichalik/homebrew-tap` |
