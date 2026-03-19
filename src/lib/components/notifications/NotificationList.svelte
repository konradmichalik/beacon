<script lang="ts">
  import { getFilteredNotifications, getIsLoading } from '$lib/stores/notifications.svelte';
  import { filterState } from '$lib/stores/filters.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import NotificationCard from './NotificationCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import PartyPopperIcon from '$lib/components/icons/PartyPopperIcon.svelte';
  import { Inbox, ChevronRight } from '@lucide/svelte';
  import type { UnifiedNotification } from '$lib/types';

  let items = $derived(
    getFilteredNotifications(
      filterState.source,
      filterState.project,
      filterState.sort,
      filterState.types,
      filterState.projects,
      filterState.statuses
    )
  );
  let isLoading = $derived(getIsLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  let unreadItems = $derived(items.filter((n) => n.unread));
  let readItems = $derived(items.filter((n) => !n.unread));
  let showRead = $state(false);

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
  <EmptyState
    icon={PartyPopperIcon}
    title="All clear"
    description="No unread notifications."
    iconSize={48}
  />
{:else}
  <div class="flex min-h-full flex-col">
    <!-- Unread -->
    {#if filterState.sort === 'project' && projectGroups.length > 0}
      <div>
        {#each projectGroups as group (group.source + ':' + group.repository)}
          <div
            class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-card/95 px-4 py-1.5 backdrop-blur-sm"
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
      <div>
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
        class="flex w-full items-center gap-1.5 border-t border-border bg-background/60 px-4 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight size={12} class="transition-transform {showRead ? 'rotate-90' : ''}" />
        Read
        <span class="rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold leading-tight"
          >{readItems.length}</span
        >
      </button>
      {#if showRead}
        <div>
          {#each readItems as notification (notification.id)}
            <NotificationCard {notification} />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}
