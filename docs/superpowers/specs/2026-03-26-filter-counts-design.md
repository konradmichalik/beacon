# Filter Counts & Sticky Header Counts

**Date:** 2026-03-26
**Status:** Approved
**Inspiration:** GitLight app (repository sidebar with counts, type filters with counts)

## Summary

Add unread notification counts to the FilterPopover (type and project filters) and to sticky group headers in project-sorted view. Gives users immediate visibility into notification distribution without needing to scan the full list.

## Design

### 1. FilterPopover — Type Filter Badges

Each type filter button shows a small pill badge with the unread count:

- `Issue ③` · `PR ⑫` · `Review ①` · `Pipeline` (no badge if 0)
- Types with 0 unread: visible but visually muted (lower opacity or secondary color)
- The "All" button does not show a count (redundant with header badge)
- Badge style: matches existing source filter badges in FilterBar (small, pill-shaped)

### 2. FilterPopover — Project Filter Counts

Each project checkbox row shows a badge with the unread count on the right side:

- `☐ website                    ⑤`
- `☐ vhw-middleware             ②`
- `☐ beacon` (no badge if 0)
- Sort order: unread count descending, then alphabetical on tie
- Badge style: same pill badges as type filters

### 3. Sticky Headers — Project Sort View

When `sort: project` is active, sticky group headers include an unread count badge:

- **Current:** `⬡ website`
- **New:** `⬡ website  ⑤`
- Badge appears right of the repo name
- Only counts unread notifications within that group
- Groups with 0 unread: no badge shown

### Count Calculation

Counts are computed from unread notifications **after** applying:

- Source filter (GitHub/GitLab/All)
- Mute rules

But **before** applying:

- Type filter
- Project filter
- Status filter

This ensures the counts reflect the real distribution regardless of which type/project/status filters are currently active.

## Scope

- **In scope:** FilterPopover type badges, FilterPopover project badges, sticky header badges, project sort order by count
- **Out of scope:** Sidebar layout, Done/Priorities view, PR filter counts (separate effort)

## Files Affected

- `src/lib/components/FilterPopover.svelte` — add badges to type buttons and project checkboxes, sort projects by count
- `src/lib/components/NotificationList.svelte` — add badge to sticky group headers
- `src/lib/stores/notifications.svelte.ts` — add helper functions for count-by-type and count-by-project (if not already sufficient)
