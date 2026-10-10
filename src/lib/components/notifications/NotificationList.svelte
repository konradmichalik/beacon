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
  import { Inbox, MailOpen, AlarmClockOff } from '@lucide/svelte';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
  import ListSkeleton from '$lib/components/ui/ListSkeleton.svelte';
  import { motionMs, rise, swipe } from '$lib/utils/motion';
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
      class="mt-1.5 text-[11px] text-subtlest underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
    >
      {hiddenCount} hidden, muted or snoozed
    </button>
  {/if}
{/snippet}

{#snippet allClear()}
  <EmptyState
    icon={PartyPopperIcon}
    title="All clear"
    description="No unread notifications."
    iconSize={48}
  />
{/snippet}

{#if !isConfigured}
  <EmptyState
    icon={Inbox}
    title="No services connected"
    description="Open Settings to connect GitHub or GitLab."
  />
{:else if isLoading && items.length === 0}
  <ListSkeleton />
{:else if items.length === 0}
  <div class="flex min-h-full flex-col items-center justify-center">
    {@render allClear()}
    {@render hiddenCountFooter()}
  </div>
{:else}
  <div class="flex min-h-full flex-col">
    <!-- Unread -->
    {#if filterState.sort === 'project' && projectGroups.length > 0}
      <div use:roving>
        {#each projectGroups as group (group.source + ':' + group.repository)}
          <SectionHeader
            label={group.repository}
            count={group.notifications.length}
            icon={group.source === 'github' ? GitHubIcon : GitLabIcon}
          />
          {#each group.notifications as notification, i (notification.id)}
            <div in:rise|global={{ index: i }} out:swipe animate:flip={{ duration: motionMs(280) }}>
              <NotificationCard {notification} />
            </div>
          {/each}
        {/each}
      </div>
    {:else}
      <div use:roving>
        {#each unreadItems as notification, i (notification.id)}
          <div in:rise|global={{ index: i }} out:swipe animate:flip={{ duration: motionMs(280) }}>
            <NotificationCard {notification} />
          </div>
        {/each}
      </div>
    {/if}

    <!-- Spacer pushes the read section to the bottom when the unread list is short -->
    {#if unreadItems.length === 0}
      <div class="flex min-h-0 flex-1 items-center justify-center">
        {@render allClear()}
      </div>
    {:else}
      <div class="flex-1"></div>
    {/if}

    <!-- Read section (collapsible, pinned to the bottom) -->
    {#if readItems.length > 0}
      <SectionHeader
        label="Read"
        count={readItems.length}
        icon={MailOpen}
        expanded={showRead}
        onclick={() => (showRead = !showRead)}
        sticky="bottom"
      />
      {#if showRead}
        <div use:roving transition:slide={{ duration: motionMs(220) }}>
          {#each readItems as notification (notification.id)}
            <div animate:flip={{ duration: motionMs(280) }}>
              <NotificationCard {notification} />
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Snoozed section (collapsible) -->
    {#if snoozedItems.length > 0}
      <SectionHeader
        label="Snoozed"
        count={snoozedItems.length}
        icon={AlarmClockOff}
        expanded={showSnoozed}
        onclick={() => (showSnoozed = !showSnoozed)}
        sticky="none"
      />
      {#if showSnoozed}
        <div class="divide-y divide-border" transition:slide={{ duration: motionMs(220) }}>
          {#each snoozedItems as notification (notification.id)}
            {@const entry = getSnoozedEntries()[notification.id]}
            <div class="flex items-center gap-3 px-4 py-2">
              {#if notification.source === 'github'}
                <GitHubIcon size={12} class="shrink-0 text-muted-foreground" />
              {:else}
                <GitLabIcon size={12} class="shrink-0 text-muted-foreground" />
              {/if}
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs text-foreground">{notification.title}</p>
                {#if entry}
                  <p class="text-[11px] text-subtlest">
                    Wakes {formatWakeTime(entry.until)}
                  </p>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => unsnooze(notification.id)}
                class="h-7 shrink-0 rounded-md px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-hovered hover:text-foreground"
              >
                Wake now
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    {#if hiddenCount > 0}
      <div class="border-t border-border px-4 py-2 text-center">
        {@render hiddenCountFooter()}
      </div>
    {/if}
  </div>
{/if}
