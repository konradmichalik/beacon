<script lang="ts">
  import { clickOutside } from '$lib/actions/clickOutside';
  import {
    filterState,
    setSourceFilter,
    setSortMode,
    hasActiveFilters
  } from '$lib/stores/filters.svelte';
  import type { SortMode } from '$lib/stores/filters.svelte';
  import {
    getFilteredUnreadCount,
    getCountBySource,
    getFilteredNotifications,
    markAllAsRead
  } from '$lib/stores/notifications.svelte';
  import { isServiceConnected } from '$lib/stores/connections.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import FilterPopover from './FilterPopover.svelte';
  import { ArrowDownUp, CheckCheck, Filter } from '@lucide/svelte';
  import type { NotificationSource } from '$lib/types';

  type FilterOption = NotificationSource | 'all';

  let totalCount = $derived(getFilteredUnreadCount());
  let githubCount = $derived(getCountBySource('github'));
  let gitlabCount = $derived(getCountBySource('gitlab'));

  let githubConnected = $derived(isServiceConnected('github'));
  let gitlabConnected = $derived(isServiceConnected('gitlab'));
  let bothConnected = $derived(githubConnected && gitlabConnected);

  let filteredIds = $derived(
    new Set(
      getFilteredNotifications(
        filterState.source,
        filterState.project,
        filterState.sort,
        filterState.types,
        filterState.projects,
        filterState.statuses
      ).map((n) => n.id)
    )
  );

  let filtersActive = $derived(hasActiveFilters());
  let popoverOpen = $state(false);
  let filterBtnEl: HTMLButtonElement | undefined = $state();
  let sortOpen = $state(false);
  let sortBtnEl: HTMLButtonElement | undefined = $state();

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'project', label: 'Project' }
  ];

  function pickSort(value: SortMode) {
    setSortMode(value);
    sortOpen = false;
  }

  function isActive(value: FilterOption): boolean {
    return filterState.source === value;
  }

  const btnBase = 'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors';
  const btnActive = 'bg-foreground text-background';
  const btnInactive = 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground';

  const badgeBase = 'ml-0.5 rounded-full px-1 py-px text-[9px] font-semibold leading-tight';
  const badgeActive = 'bg-background/20 text-background';
  const badgeInactive = 'bg-secondary text-muted-foreground';
</script>

<div
  class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-secondary/40 px-4 py-1.5 scrollbar-none"
>
  {#if bothConnected}
    <div class="flex shrink-0 overflow-hidden rounded-md border border-border bg-card" role="group">
      <button
        type="button"
        onclick={() => setSourceFilter('all')}
        class="{btnBase} rounded-l-md {isActive('all') ? btnActive : btnInactive}"
      >
        All
        {#if totalCount > 0}
          <span class="{badgeBase} {isActive('all') ? badgeActive : badgeInactive}"
            >{totalCount}</span
          >
        {/if}
      </button>

      <button
        type="button"
        onclick={() => setSourceFilter('github')}
        title="GitHub"
        class="{btnBase} border-l border-border {isActive('github') ? btnActive : btnInactive}"
      >
        <GitHubIcon size={12} />
        {#if githubCount > 0}
          <span class="{badgeBase} {isActive('github') ? badgeActive : badgeInactive}"
            >{githubCount}</span
          >
        {/if}
      </button>

      <button
        type="button"
        onclick={() => setSourceFilter('gitlab')}
        title="GitLab"
        class="{btnBase} rounded-r-md border-l border-border {isActive('gitlab')
          ? btnActive
          : btnInactive}"
      >
        <GitLabIcon size={12} />
        {#if gitlabCount > 0}
          <span class="{badgeBase} {isActive('gitlab') ? badgeActive : badgeInactive}"
            >{gitlabCount}</span
          >
        {/if}
      </button>
    </div>
  {:else if githubConnected || gitlabConnected}
    <div
      class="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1"
      title={githubConnected ? 'GitHub' : 'GitLab'}
    >
      {#if githubConnected}
        <GitHubIcon size={12} />
        <span class="{badgeBase} {badgeInactive}">{githubCount}</span>
      {:else if gitlabConnected}
        <GitLabIcon size={12} />
        <span class="{badgeBase} {badgeInactive}">{gitlabCount}</span>
      {/if}
    </div>
  {/if}

  <div class="ml-auto flex items-center gap-1.5">
    <!-- Mark all as read -->
    <button
      type="button"
      onclick={() => markAllAsRead(filteredIds)}
      disabled={totalCount === 0}
      title="Mark all as read"
      class="rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-30"
    >
      <CheckCheck size={11} />
    </button>

    <!-- Filter button -->
    <button
      type="button"
      bind:this={filterBtnEl}
      onclick={() => (popoverOpen = !popoverOpen)}
      title="Filter"
      class="relative rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <Filter size={11} />
      {#if filtersActive}
        <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"></span>
      {/if}
    </button>

    {#if popoverOpen && filterBtnEl}
      <FilterPopover anchorEl={filterBtnEl} onClose={() => (popoverOpen = false)} />
    {/if}

    <!-- Sort button -->
    <button
      type="button"
      bind:this={sortBtnEl}
      onclick={() => (sortOpen = !sortOpen)}
      title="Sort"
      class="rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <ArrowDownUp size={11} />
    </button>

    {#if sortOpen && sortBtnEl}
      {@const rect = sortBtnEl.getBoundingClientRect()}
      <div
        use:clickOutside={() => (sortOpen = false)}
        style="position:fixed;top:{rect.bottom + 4}px;right:{window.innerWidth - rect.right}px;"
        class="z-50 min-w-[120px] rounded-lg border border-border bg-card py-1 shadow-lg"
      >
        {#each sortOptions as opt (opt.value)}
          <button
            type="button"
            onclick={() => pickSort(opt.value)}
            class="flex w-full items-center px-3 py-1.5 text-[11px] font-medium transition-colors
              {filterState.sort === opt.value
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
