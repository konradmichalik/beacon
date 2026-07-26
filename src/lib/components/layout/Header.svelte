<script lang="ts">
  import { Settings, RefreshCw, Power, Inbox, GitPullRequest, CircleDot } from '@lucide/svelte';
  import { isTauri } from '$lib/utils/storage';
  import BeaconLogo from '$lib/components/icons/BeaconLogo.svelte';
  import {
    getIsLoading,
    getHasLoadedOnce,
    refreshNotifications,
    getFilteredUnreadCount
  } from '$lib/stores/notifications.svelte';
  import {
    getIsPRLoading,
    getPRHasLoadedOnce,
    refreshPullRequests,
    getPRCount
  } from '$lib/stores/pull-requests.svelte';
  import {
    getIsIssueLoading,
    getIssueHasLoadedOnce,
    refreshIssues,
    getIssueCount
  } from '$lib/stores/issues.svelte';
  import { settingsState } from '$lib/stores/settings.svelte';
  import type { ViewTab } from '$lib/types';

  let {
    onSettingsToggle,
    onQuit,
    activeView = 'notifications',
    onTabChange
  }: {
    onSettingsToggle: () => void;
    onQuit?: () => void;
    activeView?: ViewTab;
    onTabChange: (tab: ViewTab) => void;
  } = $props();

  let isLoading = $derived.by(() => {
    if (activeView === 'notifications') return getIsLoading();
    if (activeView === 'issues') return getIsIssueLoading();
    return getIsPRLoading();
  });
  let unreadCount = $derived(getFilteredUnreadCount());
  let prCount = $derived(getPRCount());
  let issueCount = $derived(getIssueCount());
  let notificationsLoading = $derived(getIsLoading());
  let prsLoading = $derived(getIsPRLoading());
  let issuesLoading = $derived(getIsIssueLoading());

  let tabs = $derived<{ id: ViewTab; label: string; icon: typeof Inbox; getCount: () => number }[]>(
    [
      { id: 'notifications', label: 'Inbox', icon: Inbox, getCount: () => unreadCount },
      { id: 'pull-requests', label: 'My PRs', icon: GitPullRequest, getCount: () => prCount },
      ...(settingsState.enableIssues
        ? [{ id: 'issues' as const, label: 'Issues', icon: CircleDot, getCount: () => issueCount }]
        : [])
    ]
  );

  function handleTabKeydown(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const currentIndex = tabs.findIndex((t) => t.id === activeView);
    const next =
      e.key === 'ArrowRight'
        ? tabs[(currentIndex + 1) % tabs.length]
        : tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    onTabChange(next.id);
    // Focus the newly active tab button
    const container = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      container.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    });
  }

  function handleRefresh(): void {
    if (activeView === 'notifications') {
      refreshNotifications();
    } else if (activeView === 'issues') {
      refreshIssues();
    } else {
      refreshPullRequests();
    }
  }

  async function handleQuit(): Promise<void> {
    if (onQuit) {
      onQuit();
      return;
    }
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('quit_app');
    }
  }
</script>

{#snippet tabStrip(wrapperClass: string)}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class={wrapperClass} role="tablist" onkeydown={handleTabKeydown}>
    {#each tabs as tab (tab.id)}
      {@const TabIcon = tab.icon}
      {@const count = tab.getCount()}
      {@const isActive = activeView === tab.id}
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        tabindex={isActive ? 0 : -1}
        onclick={() => onTabChange(tab.id)}
        class="pointer-events-auto flex items-center gap-1.5 rounded-t-md px-2.5 py-1 text-[11px] font-medium transition-colors
          {isActive
          ? 'bg-accent text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
      >
        <TabIcon size={11} />
        {tab.label}
        {#if count > 0}
          <span
            class="rounded-full px-1.5 py-px text-[9px] font-semibold leading-tight
              {activeView === tab.id
              ? 'bg-primary/15 text-primary'
              : 'bg-secondary/80 text-muted-foreground'}"
          >
            {count}
          </span>
        {:else if (tab.id === 'notifications' && notificationsLoading && !getHasLoadedOnce()) || (tab.id === 'pull-requests' && prsLoading && !getPRHasLoadedOnce()) || (tab.id === 'issues' && issuesLoading && !getIssueHasLoadedOnce())}
          <span class="inline-block h-3 w-5 animate-pulse rounded-full bg-secondary/80"></span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet actions()}
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={handleRefresh}
      disabled={isLoading}
      class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
      title="Refresh"
    >
      <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
    </button>
    <button
      type="button"
      onclick={onSettingsToggle}
      class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      title="Settings"
    >
      <Settings size={15} />
    </button>
    <button
      type="button"
      onclick={handleQuit}
      class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/80 hover:text-white"
      title="Quit Beacon"
    >
      <Power size={14} />
    </button>
  </div>
{/snippet}

{#if tabs.length > 2}
  <!-- Two-row header: tabs get a dedicated row so three (or more) tabs never
       overlap the action buttons. -->
  <header class="flex flex-col border-b border-border px-4 py-2">
    <div class="flex items-center justify-between">
      <BeaconLogo height={18} class="text-foreground" />
      {@render actions()}
    </div>
    {@render tabStrip('-mb-2 mt-1.5 flex justify-center gap-1')}
  </header>
{:else}
  <!-- Single-row header: compact layout with tabs floating centered at the
       bottom edge (fits comfortably with two tabs). -->
  <header class="relative flex items-center justify-between border-b border-border px-4 py-2">
    <div class="flex items-center">
      <BeaconLogo height={18} class="text-foreground" />
    </div>
    {@render tabStrip('pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-1')}
    {@render actions()}
  </header>
{/if}
