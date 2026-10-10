<script lang="ts">
  import { Settings, RefreshCw, Power } from '@lucide/svelte';
  import BeaconLogo from '$lib/components/icons/BeaconLogo.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { bump } from '$lib/actions/bump';
  import { logoMotion } from '$lib/stores/logo-motion.svelte';
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

  // Beacon is quit from the tray menu. Only the landing page demo passes a
  // handler, to simulate closing the app.
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

  // Fixed width keeps the sliding underline a plain transform.
  const TAB_WIDTH = 88;
  const UNDERLINE_INSET = 14;

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

  let tabs = $derived<{ id: ViewTab; label: string; getCount: () => number }[]>([
    { id: 'notifications', label: 'Inbox', getCount: () => unreadCount },
    { id: 'pull-requests', label: 'My PRs', getCount: () => prCount },
    ...(settingsState.enableIssues
      ? [{ id: 'issues' as const, label: 'Issues', getCount: () => issueCount }]
      : [])
  ]);
  let activeIndex = $derived(
    Math.max(
      0,
      tabs.findIndex((t) => t.id === activeView)
    )
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

  let turns = $state(0);
  let slowRequest = $state(false);

  // One full turn per click. Only a request that outlasts the turn keeps spinning.
  $effect(() => {
    if (!isLoading) {
      slowRequest = false;
      return;
    }
    const timer = setTimeout(() => (slowRequest = true), 800);
    return () => clearTimeout(timer);
  });

  function handleRefresh(): void {
    turns += 1;
    if (activeView === 'notifications') {
      refreshNotifications();
    } else if (activeView === 'issues') {
      refreshIssues();
    } else {
      refreshPullRequests();
    }
  }

  function isFirstLoad(id: ViewTab): boolean {
    return (
      (id === 'notifications' && notificationsLoading && !getHasLoadedOnce()) ||
      (id === 'pull-requests' && prsLoading && !getPRHasLoadedOnce()) ||
      (id === 'issues' && issuesLoading && !getIssueHasLoadedOnce())
    );
  }
</script>

<header class="flex h-11 shrink-0 items-stretch border-b border-border pl-4 pr-2">
  <div class="flex min-w-0 flex-1 basis-0 items-center">
    <BeaconLogo height={18} class="text-foreground" motion={logoMotion.kind} />
  </div>

  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="relative flex items-stretch" role="tablist" onkeydown={handleTabKeydown}>
    {#each tabs as tab (tab.id)}
      {@const count = tab.getCount()}
      {@const isActive = activeView === tab.id}
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        tabindex={isActive ? 0 : -1}
        onclick={() => onTabChange(tab.id)}
        style="width: {TAB_WIDTH}px"
        class="flex items-center justify-center gap-1.5 text-xs transition-colors {isActive
          ? 'font-semibold text-foreground'
          : 'font-medium text-muted-foreground hover:text-foreground'}"
      >
        {tab.label}
        {#if count > 0}
          <span
            use:bump={count}
            class="inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10.5px] font-bold tabular-nums transition-colors {isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'}"
          >
            {count}
          </span>
        {:else if isFirstLoad(tab.id)}
          <span class="inline-block h-4 w-[18px] animate-pulse rounded-full bg-muted"></span>
        {/if}
      </button>
    {/each}
    <span
      aria-hidden="true"
      class="absolute -bottom-px left-0 h-0.5 rounded-full bg-primary"
      style="width: {TAB_WIDTH - UNDERLINE_INSET * 2}px; transform: translateX({activeIndex *
        TAB_WIDTH +
        UNDERLINE_INSET}px); transition: transform var(--dur-slow) var(--ease-out);"
    ></span>
  </div>

  <div class="flex min-w-0 flex-1 basis-0 items-center justify-end">
    <IconButton label="Refresh" disabled={isLoading} onclick={handleRefresh}>
      <RefreshCw
        size={15}
        class={slowRequest ? 'animate-spin' : ''}
        style="transform: rotate({turns * 360}deg); transition: transform 800ms var(--ease-out);"
      />
    </IconButton>
    <IconButton label="Settings" onclick={onSettingsToggle}>
      <Settings size={15} />
    </IconButton>
    {#if onQuit}
      <IconButton label="Quit Beacon" onclick={onQuit}>
        <Power size={15} />
      </IconButton>
    {/if}
  </div>
</header>
