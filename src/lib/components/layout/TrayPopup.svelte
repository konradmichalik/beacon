<script lang="ts">
  import Header from './Header.svelte';
  import ViewTabs from './ViewTabs.svelte';
  import type { ViewTab } from './ViewTabs.svelte';
  import NotificationList from '../notifications/NotificationList.svelte';
  import FilterBar from '../notifications/FilterBar.svelte';
  import PullRequestList from '../pull-requests/PullRequestList.svelte';
  import PRFilterBar from '../pull-requests/PRFilterBar.svelte';
  import SettingsView from '../settings/SettingsView.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import { startPolling, markAllSeen, isDemoMode } from '$lib/stores/notifications.svelte';
  import { showToast } from '$lib/stores/toast.svelte';
  import { refreshPullRequests } from '$lib/stores/pull-requests.svelte';
  import { ArrowLeft, ArrowUp } from '@lucide/svelte';
  import { onMount, untrack } from 'svelte';
  import type { NotificationSource, PRRoleFilter, PRDraftFilter, PRCIFilter } from '$lib/types';
  import type { PRSortMode } from '$lib/stores/pull-requests.svelte';
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

  onMount(() => {
    function handleVisibility(): void {
      if (document.hidden) {
        markAllSeen();
      } else {
        // Refresh PRs when popup becomes visible (PR polling runs in frontend
        // and may be throttled while the webview is hidden)
        refreshPullRequests();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  });
</script>

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
    <Header onSettingsToggle={toggleSettings} {onQuit} {activeView} />
    <ViewTabs activeTab={activeView} onTabChange={(tab) => (activeView = tab)} />
    {#if activeView === 'notifications'}
      <FilterBar />
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
      <div class="h-full overflow-y-auto bg-card" bind:this={scrollEl} onscroll={handleScroll}>
        {#if activeView === 'notifications'}
          <NotificationList />
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
