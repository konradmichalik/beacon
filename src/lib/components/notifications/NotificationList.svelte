<script lang="ts">
  import {
    getVisibleNotifications,
    getHiddenCount,
    getIsLoading,
    getNotifications
  } from '$lib/stores/notifications.svelte';
  import { getSnoozedNotifications, getSnoozedEntries, unsnooze } from '$lib/stores/snooze.svelte';
  import { filterState } from '$lib/stores/filters.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import { isTauri } from '$lib/utils/storage';
  import { filterByQuery } from '$lib/utils/filter-tokens';
  import NotificationCard from './NotificationCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import PartyPopperIcon from '$lib/components/icons/PartyPopperIcon.svelte';
  import { Inbox, ChevronRight, MailOpen, AlarmClockOff } from '@lucide/svelte';
  import type { UnifiedNotification } from '$lib/types';
  import { roving } from '$lib/actions/roving';
  import { formatWakeTime } from '$lib/utils/time';

  let items = $derived(getVisibleNotifications());
  let isLoading = $derived(getIsLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  let unreadItems = $derived(items.filter((n) => n.unread));
  let readItems = $derived(items.filter((n) => !n.unread));
  let showRead = $state(false);

  // getFilteredNotifications already excludes snoozed items, so the snoozed
  // list is built from the unfiltered set — matching source/project/query, the
  // same scope the hidden-count reasoning elsewhere in the app uses.
  let snoozedItems = $derived(
    filterByQuery(
      getSnoozedNotifications(getNotifications()).filter(
        (n) =>
          (filterState.source === 'all' || n.source === filterState.source) &&
          (!filterState.project || n.repository === filterState.project)
      ),
      filterState.query
    )
  );
  let showSnoozed = $state(false);

  // Scoped to the same source/project/type/etc. filters as `items`, so this
  // never claims more is hidden than the user could actually see by clearing
  // filters — a global count would include notifications outside the current
  // view entirely.
  let hiddenCount = $derived(
    getHiddenCount(
      filterState.source,
      filterState.project,
      filterState.types,
      filterState.projects,
      filterState.statuses,
      filterState.authors,
      filterState.draftFilter,
      filterState.query
    )
  );

  // Deep-links into the standalone settings window; not available in the
  // browser dev-preview fallback (no Tauri window to open).
  async function openMuteRuleSettings(): Promise<void> {
    if (!isTauri()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_settings_window', { tab: 'preferences' });
  }

  interface ProjectGroup {
    repository: string;
    source: 'github' | 'gitlab';
    notifications: UnifiedNotification[];
  }

  let projectGroups = $derived.by((): ProjectGroup[] => {
    if (filterState.sort !== 'project' || unreadItems.length === 0) return [];

    const groups: ProjectGroup[] = [];
    let currentRepo = '';

    for (const n of unreadItems) {
      if (n.repository !== currentRepo) {
        currentRepo = n.repository;
        groups.push({ repository: n.repository, source: n.source, notifications: [n] });
      } else {
        groups[groups.length - 1].notifications.push(n);
      }
    }

    return groups;
  });
</script>

{#snippet hiddenCountFooter()}
  {#if hiddenCount > 0}
    <button
      type="button"
      onclick={openMuteRuleSettings}
      class="mt-1.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
    >
      {hiddenCount} hidden — muted or snoozed
    </button>
  {/if}
{/snippet}

{#if !isConfigured}
  <EmptyState
    icon={Inbox}
    title="No services connected"
    description="Open Settings to connect GitHub or GitLab."
  />
{:else if isLoading && items.length === 0}
  <div class="divide-y divide-border">
    {#each [0, 1, 2, 3, 4] as i (i)}
      <div class="flex gap-3 px-4 py-3">
        <div class="h-7 w-7 shrink-0 animate-pulse rounded-full bg-secondary"></div>
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <div class="h-3 w-3/4 animate-pulse rounded bg-secondary"></div>
          <div class="h-2.5 w-1/2 animate-pulse rounded bg-secondary/60"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if items.length === 0}
  <div class="flex min-h-full flex-col items-center justify-center">
    <EmptyState
      icon={PartyPopperIcon}
      title="All clear"
      description="No unread notifications."
      iconSize={48}
    />
    {@render hiddenCountFooter()}
  </div>
{:else}
  <div class="flex min-h-full flex-col">
    <!-- Unread -->
    {#if filterState.sort === 'project' && projectGroups.length > 0}
      <div use:roving>
        {#each projectGroups as group (group.source + ':' + group.repository)}
          <div
            class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-background/95 px-4 py-1.5 backdrop-blur-sm"
          >
            {#if group.source === 'github'}
              <GitHubIcon size={12} class="text-muted-foreground" />
            {:else}
              <GitLabIcon size={12} class="text-muted-foreground" />
            {/if}
            <span class="truncate text-[11px] font-semibold text-muted-foreground">
              {group.repository}
            </span>
            <span
              class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold leading-tight text-muted-foreground"
            >
              {group.notifications.length}
            </span>
          </div>
          {#each group.notifications as notification (notification.id)}
            <NotificationCard {notification} />
          {/each}
        {/each}
      </div>
    {:else}
      <div use:roving>
        {#each unreadItems as notification (notification.id)}
          <NotificationCard {notification} />
        {/each}
      </div>
    {/if}

    <!-- Spacer pushes read section to bottom when unread list is short -->
    {#if unreadItems.length === 0}
      <div class="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState
          icon={PartyPopperIcon}
          title="All clear"
          description="No unread notifications."
          iconSize={48}
        />
      </div>
    {:else}
      <div class="flex-1"></div>
    {/if}

    <!-- Read section (collapsible, always at bottom) -->
    {#if readItems.length > 0}
      <button
        type="button"
        onclick={() => (showRead = !showRead)}
        class="sticky top-0 z-10 flex w-full items-center gap-1.5 border-b border-border bg-card/95 px-4 py-1.5 backdrop-blur-sm transition-colors hover:bg-secondary/40"
      >
        <ChevronRight
          size={12}
          class="shrink-0 text-muted-foreground transition-transform {showRead ? 'rotate-90' : ''}"
        />
        <MailOpen size={10} class="shrink-0 text-muted-foreground" />
        <span class="text-[11px] font-semibold text-muted-foreground">Read</span>
        <span
          class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
          >{readItems.length}</span
        >
      </button>
      {#if showRead}
        <div use:roving>
          {#each readItems as notification (notification.id)}
            <NotificationCard {notification} />
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Snoozed section (collapsible, always at bottom) -->
    {#if snoozedItems.length > 0}
      <button
        type="button"
        onclick={() => (showSnoozed = !showSnoozed)}
        class="sticky top-0 z-10 flex w-full items-center gap-1.5 border-b border-border bg-card/95 px-4 py-1.5 backdrop-blur-sm transition-colors hover:bg-secondary/40"
      >
        <ChevronRight
          size={12}
          class="shrink-0 text-muted-foreground transition-transform {showSnoozed
            ? 'rotate-90'
            : ''}"
        />
        <AlarmClockOff size={10} class="shrink-0 text-muted-foreground" />
        <span class="text-[11px] font-semibold text-muted-foreground">Snoozed</span>
        <span
          class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
          >{snoozedItems.length}</span
        >
      </button>
      {#if showSnoozed}
        <div class="divide-y divide-border/60">
          {#each snoozedItems as notification (notification.id)}
            {@const entry = getSnoozedEntries()[notification.id]}
            <div class="flex items-center gap-3 px-4 py-2">
              {#if notification.source === 'github'}
                <GitHubIcon size={12} class="shrink-0 text-muted-foreground/70" />
              {:else}
                <GitLabIcon size={12} class="shrink-0 text-muted-foreground/70" />
              {/if}
              <div class="min-w-0 flex-1">
                <p class="truncate text-[12px] text-foreground">{notification.title}</p>
                {#if entry}
                  <p class="text-[10px] text-muted-foreground">
                    Wakes {formatWakeTime(entry.until)}
                  </p>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => unsnooze(notification.id)}
                class="shrink-0 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Wake now
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    {#if hiddenCount > 0}
      <div class="border-t border-border/60 px-4 py-2 text-center">
        {@render hiddenCountFooter()}
      </div>
    {/if}
  </div>
{/if}
