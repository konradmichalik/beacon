<script lang="ts">
  import { getFilteredNotifications, getIsLoading } from '$lib/stores/notifications.svelte';
  import { filterState } from '$lib/stores/filters.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import NotificationCard from './NotificationCard.svelte';
  import EmptyState from './EmptyState.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import { Inbox, ChevronRight, PartyPopper } from '@lucide/svelte';
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
  <div class="flex items-center justify-center py-12">
    <div
      class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
    ></div>
  </div>
{:else if items.length === 0}
  <EmptyState icon={Inbox} title="All clear" description="No notifications right now." />
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
            <span class="ml-auto shrink-0 text-[10px] text-muted-foreground">
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
      <div
        class="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
      >
        <PartyPopper size={72} strokeWidth={1} class="opacity-20" />
        <span class="text-[11px]">No unread notifications</span>
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
        <span class="rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold"
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
