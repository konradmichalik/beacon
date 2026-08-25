<script lang="ts">
  import { clickOutside } from '$lib/actions/clickOutside';
  import {
    filterState,
    setSourceFilter,
    setSortMode,
    setQuery,
    hasActiveFilters
  } from '$lib/stores/filters.svelte';
  import type { SortMode } from '$lib/stores/filters.svelte';
  import {
    getFilteredUnreadCount,
    getCountBySource,
    getFilteredNotifications,
    getLastRefresh,
    markAllAsRead
  } from '$lib/stores/notifications.svelte';
  import SourceToggle from '$lib/components/ui/SourceToggle.svelte';
  import SortMenu from '$lib/components/ui/SortMenu.svelte';
  import FilterPopover from './FilterPopover.svelte';
  import { CheckCheck, Filter, ChevronDown, Search } from '@lucide/svelte';

  let totalCount = $derived(getFilteredUnreadCount());
  let githubCount = $derived(getCountBySource('github'));
  let gitlabCount = $derived(getCountBySource('gitlab'));

  let filteredNotifications = $derived(
    getFilteredNotifications(
      filterState.source,
      filterState.project,
      filterState.sort,
      filterState.types,
      filterState.projects,
      filterState.statuses,
      filterState.authors,
      filterState.draftFilter,
      filterState.query
    )
  );

  let filteredIds = $derived(new Set(filteredNotifications.map((n) => n.id)));

  let closedMergedIds = $derived(
    new Set(
      filteredNotifications
        .filter((n) => n.unread && (n.subjectState === 'closed' || n.subjectState === 'merged'))
        .map((n) => n.id)
    )
  );

  let draftIds = $derived(
    new Set(filteredNotifications.filter((n) => n.unread && n.draft === true).map((n) => n.id))
  );

  const OTHER_TYPES = new Set(['pipeline', 'release', 'discussion', 'other']);
  let otherIds = $derived(
    new Set(
      filteredNotifications.filter((n) => n.unread && OTHER_TYPES.has(n.type)).map((n) => n.id)
    )
  );

  let filtersActive = $derived(hasActiveFilters());
  let popoverOpen = $state(false);
  let markReadOpen = $state(false);
  let markReadBtnEl: HTMLButtonElement | undefined = $state();

  let markReadOptions = $derived([
    { label: 'All', ids: filteredIds },
    { label: 'Drafts', ids: draftIds },
    { label: 'Other / CI Activities', ids: otherIds },
    { label: 'Closed & Merged', ids: closedMergedIds }
  ]);

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'project', label: 'Project' }
  ];

  let initialLoading = $derived(getLastRefresh() === null);
</script>

<div
  data-filter-bar
  class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-secondary/40 px-4 py-1.5 scrollbar-none"
>
  <SourceToggle
    source={filterState.source}
    total={totalCount}
    {githubCount}
    {gitlabCount}
    {initialLoading}
    onSourceChange={setSourceFilter}
  />

  <label for="notification-query" class="sr-only">Filter notifications</label>
  <div class="relative flex items-center">
    <Search size={11} class="pointer-events-none absolute left-2 text-muted-foreground" />
    <input
      id="notification-query"
      type="text"
      value={filterState.query}
      oninput={(e) => setQuery(e.currentTarget.value)}
      placeholder="repo:owner/name author:login -bot"
      class="w-44 rounded-full border border-border bg-card py-1 pl-6 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
    />
  </div>

  <div class="ml-auto flex items-center gap-1.5">
    <!-- Mark as read (split button) -->
    <div class="flex items-center overflow-hidden rounded-full border border-border bg-card">
      <button
        type="button"
        onclick={() => markAllAsRead(filteredIds)}
        disabled={totalCount === 0}
        title="Mark all as read"
        class="p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <CheckCheck size={11} />
      </button>
      <button
        type="button"
        bind:this={markReadBtnEl}
        onclick={() => (markReadOpen = !markReadOpen)}
        disabled={totalCount === 0}
        title="Mark as read options"
        class="border-l border-border px-0.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
      >
        <ChevronDown size={9} />
      </button>
    </div>

    {#if markReadOpen && markReadBtnEl}
      {@const rect = markReadBtnEl.getBoundingClientRect()}
      <div
        use:clickOutside={() => (markReadOpen = false)}
        style="position:fixed;top:{rect.bottom + 4}px;right:{window.innerWidth - rect.right}px;"
        class="z-50 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg"
      >
        {#each markReadOptions as opt, i (opt.label)}
          <button
            type="button"
            disabled={i > 0 && opt.ids.size === 0}
            onclick={() => {
              markAllAsRead(opt.ids);
              markReadOpen = false;
            }}
            class="flex w-full items-center px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          >
            {opt.label}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Filter button -->
    <button
      type="button"
      onclick={() => (popoverOpen = !popoverOpen)}
      title="Filter"
      class="relative rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <Filter size={11} />
      {#if filtersActive}
        <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"></span>
      {/if}
    </button>

    {#if popoverOpen}
      <FilterPopover onClose={() => (popoverOpen = false)} />
    {/if}

    <SortMenu
      options={sortOptions}
      current={filterState.sort}
      onSelect={(v) => setSortMode(v as SortMode)}
    />
  </div>
</div>
