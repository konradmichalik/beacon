<script lang="ts">
  import Header from './Header.svelte';
  import type { ViewTab } from '$lib/types';
  import NotificationList from '../notifications/NotificationList.svelte';
  import FilterBar from '../notifications/FilterBar.svelte';
  import PullRequestList from '../pull-requests/PullRequestList.svelte';
  import PRFilterBar from '../pull-requests/PRFilterBar.svelte';
  import IssueList from '../issues/IssueList.svelte';
  import IssueFilterBar from '../issues/IssueFilterBar.svelte';
  import SettingsView from '../settings/SettingsView.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import {
    startPolling,
    markAllSeen,
    isDemoMode,
    refreshNotifications
  } from '$lib/stores/notifications.svelte';
  import { showToast } from '$lib/stores/toast.svelte';
  import { refreshPullRequests } from '$lib/stores/pull-requests.svelte';
  import { refreshIssues } from '$lib/stores/issues.svelte';
  import { settingsState } from '$lib/stores/settings.svelte';
  import { ArrowLeft, ArrowUp } from '@lucide/svelte';
  import { onMount, untrack } from 'svelte';
  import type {
    NotificationSource,
    PRRoleFilter,
    PRDraftFilter,
    PRCIFilter,
    IssueRoleFilter
  } from '$lib/types';
  import type { PRSortMode } from '$lib/stores/pull-requests.svelte';
  import type { IssueSortMode } from '$lib/stores/issues.svelte';
  import { SvelteSet } from 'svelte/reactivity';

  let {
    initialTab = 'notifications' as const,
    onQuit
  }: { initialTab?: 'notifications' | 'settings'; onQuit?: () => void } = $props();
  let showSettings = $state(untrack(() => initialTab === 'settings'));
  let scrollEl: HTMLDivElement | undefined = $state();
  let showScrollTop = $state(false);
  let activeView: ViewTab = $state('notifications');
  let prSourceFilter: NotificationSource | 'all' = $state('all');
  let prRoleFilter: PRRoleFilter = $state('all');
  let prDraftFilter: PRDraftFilter = $state('all');
  let prCIFilter: PRCIFilter = $state('all');
  let prSort: PRSortMode = $state('updated');
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- needed for reassignment reactivity in callbacks
  let prProjectsFilter: SvelteSet<string> = $state(new SvelteSet());
  let issueSourceFilter: NotificationSource | 'all' = $state('all');
  let issueRoleFilter: IssueRoleFilter = $state('all');
  let issueSort: IssueSortMode = $state('updated');
  // eslint-disable-next-line svelte/no-unnecessary-state-wrap -- needed for reassignment reactivity in callbacks
  let issueProjectsFilter: SvelteSet<string> = $state(new SvelteSet());

  // If the issues tab is disabled while active, fall back to notifications.
  $effect(() => {
    if (!settingsState.enableIssues && activeView === 'issues') {
      activeView = 'notifications';
    }
  });

  async function toggleSettings(): Promise<void> {
    if (isDemoMode()) {
      showToast('Settings are disabled in demo mode');
      return;
    }
    const { isTauri } = await import('$lib/utils/storage');
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_settings_window');
    } else {
      showSettings = !showSettings;
      if (!showSettings && hasAnyServiceConfigured()) {
        startPolling();
      }
    }
  }

  function handleScroll(): void {
    if (scrollEl) {
      showScrollTop = scrollEl.scrollTop > 100;
    }
  }

  function scrollToTop(): void {
    scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function hidePopup(): Promise<void> {
    const { isTauri } = await import('$lib/utils/storage');
    if (isTauri()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    }
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

  function handleShortcuts(e: KeyboardEvent): void {
    if (showSettings) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const actions: Record<string, () => void> = {
      '1': () => (activeView = 'notifications'),
      '2': () => (activeView = 'pull-requests'),
      '3': () => {
        if (settingsState.enableIssues) activeView = 'issues';
      },
      r: () => handleRefresh(),
      '/': () => {
        const btn = document.querySelector<HTMLElement>('[data-filter-bar] button');
        btn?.focus();
      }
    };

    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
      return;
    }

    // Escape: close the tray popup
    if (e.key === 'Escape') {
      e.preventDefault();
      hidePopup();
      return;
    }

    // When a list item is focused, let the roving action handle all arrow keys
    const active = document.activeElement as HTMLElement;
    const inList =
      active?.hasAttribute('data-roving-item') || !!active?.closest('[data-roving-item]');

    if (inList) return;

    // ArrowLeft/ArrowRight: switch tabs
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const tabs: ViewTab[] = settingsState.enableIssues
        ? ['notifications', 'pull-requests', 'issues']
        : ['notifications', 'pull-requests'];
      const idx = tabs.indexOf(activeView);
      activeView =
        e.key === 'ArrowRight'
          ? tabs[(idx + 1) % tabs.length]
          : tabs[(idx - 1 + tabs.length) % tabs.length];
      return;
    }

    // ArrowDown/ArrowUp: jump into the first visible list item
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const item = document.querySelector<HTMLElement>('[data-roving-item]');
      if (item) {
        e.preventDefault();
        item.setAttribute('tabindex', '0');
        item.focus();
      }
      return;
    }

    // Prevent macOS NSBeep for any unhandled printable character keys
    if (e.key.length === 1) {
      e.preventDefault();
    }
  }

  onMount(() => {
    function handleVisibility(): void {
      if (document.hidden) {
        markAllSeen();
      } else {
        // PR polling (paused while hidden) resumes and refreshes in the store's
        // own visibilitychange handler; here we only restore keyboard focus.

        // Ensure the webview accepts keyboard input after the panel becomes visible.
        // NSPanel with NonactivatingPanel may not route key events to the webview
        // until it has explicit DOM focus.
        requestAnimationFrame(() => {
          document.body.focus();
          window.focus();
        });
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  });
</script>

<svelte:window onkeydown={handleShortcuts} />

<div class="flex h-screen flex-col bg-background">
  {#if showSettings}
    <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
      <button
        type="button"
        onclick={toggleSettings}
        class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ArrowLeft size={15} />
      </button>
      <span class="text-sm font-semibold text-foreground">Settings</span>
    </header>
    <div class="flex-1 overflow-y-auto">
      <SettingsView />
    </div>
  {:else}
    <Header
      onSettingsToggle={toggleSettings}
      {onQuit}
      {activeView}
      onTabChange={(tab) => (activeView = tab)}
    />
    {#if activeView === 'notifications'}
      <FilterBar />
    {:else if activeView === 'issues'}
      <IssueFilterBar
        sourceFilter={issueSourceFilter}
        roleFilter={issueRoleFilter}
        sort={issueSort}
        projectsFilter={issueProjectsFilter}
        onSourceChange={(s) => (issueSourceFilter = s)}
        onRoleChange={(r) => (issueRoleFilter = r)}
        onSortChange={(s) => (issueSort = s)}
        onProjectsChange={(p) => (issueProjectsFilter = p)}
      />
    {:else}
      <PRFilterBar
        sourceFilter={prSourceFilter}
        roleFilter={prRoleFilter}
        draftFilter={prDraftFilter}
        ciFilter={prCIFilter}
        sort={prSort}
        projectsFilter={prProjectsFilter}
        onSourceChange={(s) => (prSourceFilter = s)}
        onRoleChange={(r) => (prRoleFilter = r)}
        onDraftChange={(d) => (prDraftFilter = d)}
        onCIChange={(c) => (prCIFilter = c)}
        onSortChange={(s) => (prSort = s)}
        onProjectsChange={(p) => (prProjectsFilter = p)}
      />
    {/if}
    <div class="relative flex-1 overflow-hidden">
      <div class="h-full overflow-y-auto" bind:this={scrollEl} onscroll={handleScroll}>
        {#if activeView === 'notifications'}
          <NotificationList />
        {:else if activeView === 'issues'}
          <IssueList
            sourceFilter={issueSourceFilter}
            roleFilter={issueRoleFilter}
            sort={issueSort}
            projectsFilter={issueProjectsFilter}
          />
        {:else}
          <PullRequestList
            sourceFilter={prSourceFilter}
            roleFilter={prRoleFilter}
            draftFilter={prDraftFilter}
            ciFilter={prCIFilter}
            sort={prSort}
            projectsFilter={prProjectsFilter}
          />
        {/if}
      </div>
      <button
        type="button"
        onclick={scrollToTop}
        aria-label="Scroll to top"
        class="absolute right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200 ease-out hover:opacity-90 {showScrollTop
          ? 'bottom-3 opacity-100'
          : '-bottom-10 opacity-0'}"
      >
        <ArrowUp size={14} />
      </button>
    </div>
  {/if}
</div>
