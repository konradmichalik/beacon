# Filter Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unread count badges to type and project filters in the FilterPopover, matching the existing badge style from FilterBar.

**Architecture:** Two new store helper functions compute unread counts per type and per project (after source filter + mute rules, before type/project/status filters). FilterPopover consumes these counts to render pill badges and sort projects by count.

**Tech Stack:** Svelte 5 (runes, $derived), TypeScript, Tailwind CSS

**Note:** Sticky header counts in NotificationList.svelte are already implemented — groups are built from unread items only, so `group.notifications.length` already equals the unread count.

---

### Task 1: Add store helper functions for unread counts

**Files:**

- Modify: `src/lib/stores/notifications.svelte.ts:158-217`

These functions compute unread counts after applying source filter and mute rules, but before type/project/status filters. This matches how `getUniqueTypes()` and `getUniqueProjectsWithSource()` work but adds unread counting.

- [ ] **Step 1: Add `getUnreadCountByType` function**

Add after the `getUniqueTypes()` function (line 161):

```typescript
export function getUnreadCountByType(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<NotificationType, number> {
  let filtered = notifications.filter((n) => n.unread && !isNotificationMuted(n));
  if (sourceFilter !== 'all') {
    filtered = filtered.filter((n) => n.source === sourceFilter);
  }
  const counts = new Map<NotificationType, number>();
  for (const n of filtered) {
    counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  }
  return counts;
}
```

- [ ] **Step 2: Add `getUnreadCountByProject` function**

Add after the new `getUnreadCountByType` function:

```typescript
export function getUnreadCountByProject(
  sourceFilter: NotificationSource | 'all'
): ReadonlyMap<string, number> {
  let filtered = notifications.filter((n) => n.unread && !isNotificationMuted(n));
  if (sourceFilter !== 'all') {
    filtered = filtered.filter((n) => n.source === sourceFilter);
  }
  const counts = new Map<string, number>();
  for (const n of filtered) {
    counts.set(n.repository, (counts.get(n.repository) ?? 0) + 1);
  }
  return counts;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/k.michalik/Sites/Packages/beacon && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No new errors related to the two added functions.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/notifications.svelte.ts
git commit -m "feat: add unread count helpers by type and project"
```

---

### Task 2: Add badge counts to type filter buttons in FilterPopover

**Files:**

- Modify: `src/lib/components/notifications/FilterPopover.svelte:1-98`

- [ ] **Step 1: Import the new helper and derive counts**

In the `<script>` block, add the import and a derived value. Change line 14:

```svelte
import {(getUniqueTypes,
getUniqueProjectsWithSource,
getUnreadCountByType,
getUnreadCountByProject)} from '$lib/stores/notifications.svelte';
```

Add after line 25 (`let filtersActive = ...`):

```svelte
let unreadByType = $derived(getUnreadCountByType(filterState.source)); let unreadByProject =
$derived(getUnreadCountByProject(filterState.source));
```

- [ ] **Step 2: Add badge to type filter buttons**

Replace the type button content (lines 84-96) with a version that includes a badge. Each button shows the type label plus a pill badge with the unread count. Types with 0 unread get muted styling:

```svelte
{#each availableTypes as type (type)}
  {@const active = filterState.types.has(type)}
  {@const count = unreadByType.get(type) ?? 0}
  <button
    type="button"
    onclick={() => toggleTypeFilter(type)}
    class="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors
                  {active
      ? 'border-primary bg-primary text-primary-foreground'
      : count === 0
        ? 'border-border text-muted-foreground/50'
        : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
  >
    {NOTIFICATION_TYPE_LABELS[type] ?? type}
    {#if count > 0}
      <span
        class="rounded-full px-1 py-px text-[9px] font-semibold leading-tight
                      {active
          ? 'bg-primary-foreground/20 text-primary-foreground'
          : 'bg-secondary text-muted-foreground'}"
      >
        {count}
      </span>
    {/if}
  </button>
{/each}
```

- [ ] **Step 3: Verify it renders correctly**

Run: `cd /Users/k.michalik/Sites/Packages/beacon && npm run dev`
Open the app, check the FilterPopover type buttons show pill badges with unread counts. Verify:

- Active buttons show badge with `bg-primary-foreground/20` style
- Inactive buttons with count > 0 show badge with `bg-secondary` style
- Inactive buttons with count 0 have muted text (`text-muted-foreground/50`), no badge
- "All" button has no badge

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/notifications/FilterPopover.svelte
git commit -m "feat: add unread count badges to type filter buttons"
```

---

### Task 3: Add badge counts to project filter rows and sort by count

**Files:**

- Modify: `src/lib/components/notifications/FilterPopover.svelte:135-177`

- [ ] **Step 1: Sort projects by unread count descending, then alphabetically**

Replace the `availableProjects` derived (line 24) with a sorted version that uses the unread counts:

```svelte
  let availableProjects = $derived.by(() => {
    const projects = getUniqueProjectsWithSource();
    return [...projects].sort((a, b) => {
      const countA = unreadByProject.get(a.repository) ?? 0;
      const countB = unreadByProject.get(b.repository) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.repository.localeCompare(b.repository);
    });
  });
```

- [ ] **Step 2: Add badge to project filter rows**

Replace the project label content (lines 150-173) to include a count badge on the right side. The badge uses `ml-auto` to push it to the far right:

```svelte
<div class="max-h-28 space-y-0.5 overflow-y-auto">
  {#each availableProjects as project (project.repository)}
    {@const active = filterState.projects.has(project.repository)}
    {@const count = unreadByProject.get(project.repository) ?? 0}
    <label
      class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-secondary"
    >
      <input
        type="checkbox"
        checked={active}
        onchange={() => toggleProjectFilter(project.repository)}
        class="h-3 w-3 rounded border-border accent-primary"
      />
      {#if project.source === 'github'}
        <GitHubIcon size={11} class="shrink-0 text-muted-foreground" />
      {:else}
        <GitLabIcon size={11} class="shrink-0 text-muted-foreground" />
      {/if}
      <span
        class="truncate text-[11px] {active
          ? 'font-medium text-foreground'
          : count === 0
            ? 'text-muted-foreground/50'
            : 'text-muted-foreground'}"
      >
        {project.repository.split('/').slice(-2).join('/')}
      </span>
      {#if count > 0}
        <span
          class="ml-auto shrink-0 rounded-full bg-secondary px-1 py-px text-[9px] font-semibold leading-tight text-muted-foreground"
        >
          {count}
        </span>
      {/if}
    </label>
  {/each}
</div>
```

- [ ] **Step 3: Verify it renders correctly**

Run: `cd /Users/k.michalik/Sites/Packages/beacon && npm run dev`
Open the app, check the FilterPopover project list:

- Projects are sorted by unread count descending (most active first)
- Each project row shows a pill badge on the right with the unread count
- Projects with 0 unread have muted text and no badge
- Badges use the same `bg-secondary text-muted-foreground` style as other badges

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/notifications/FilterPopover.svelte
git commit -m "feat: add unread count badges to project filter and sort by count"
```
