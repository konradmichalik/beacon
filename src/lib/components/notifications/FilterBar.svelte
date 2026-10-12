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
    getVisibleNotifications,
    getLastRefresh,
    markAllAsRead
  } from '$lib/stores/notifications.svelte';
  import SourceToggle from '$lib/components/ui/SourceToggle.svelte';
  import SortMenu from '$lib/components/ui/SortMenu.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import FilterPopover from './FilterPopover.svelte';
  import { CheckCheck, ListFilter, ChevronDown } from '@lucide/svelte';

  let totalCount = $derived(getFilteredUnreadCount());
  let githubCount = $derived(getCountBySource('github'));
  let gitlabCount = $derived(getCountBySource('gitlab'));

  let filteredNotifications = $derived(getVisibleNotifications());

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
  class="flex h-10 items-center gap-2 overflow-x-auto border-b border-border pl-4 pr-2 scrollbar-none"
>
  <SourceToggle
    source={filterState.source}
    total={totalCount}
    {githubCount}
    {gitlabCount}
    {initialLoading}
    onSourceChange={setSourceFilter}
  />

  <div class="ml-auto flex items-center">
    <!-- Mark as read: the action and its options -->
    <IconButton
      label="Mark all as read"
      disabled={totalCount === 0}
      onclick={() => markAllAsRead(filteredIds)}
      class="rounded-r-none pr-1"
    >
      <CheckCheck size={15} />
    </IconButton>
    <IconButton
      label="Mark as read options"
      bind:el={markReadBtnEl}
      disabled={totalCount === 0}
      expanded={markReadOpen}
      active={markReadOpen}
      onclick={() => (markReadOpen = !markReadOpen)}
      class="min-w-5 rounded-l-none px-0.5"
    >
      <ChevronDown size={10} />
    </IconButton>

    {#if markReadOpen && markReadBtnEl}
      {@const rect = markReadBtnEl.getBoundingClientRect()}
      <div
        use:clickOutside={() => (markReadOpen = false)}
        style="position:fixed;top:{rect.bottom + 4}px;right:{window.innerWidth - rect.right}px;"
        class="z-50 min-w-[180px] rounded-[10px] border border-border bg-popover p-1 shadow-lg"
      >
        {#each markReadOptions as opt, i (opt.label)}
          <button
            type="button"
            disabled={i > 0 && opt.ids.size === 0}
            onclick={() => {
              markAllAsRead(opt.ids);
              markReadOpen = false;
            }}
            class="flex h-7 w-full items-center rounded-md px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hovered disabled:pointer-events-none disabled:opacity-35"
          >
            {opt.label}
          </button>
        {/each}
      </div>
    {/if}

    <IconButton
      label="Filter"
      expanded={popoverOpen}
      active={popoverOpen}
      onclick={() => (popoverOpen = !popoverOpen)}
    >
      <ListFilter size={15} />
      {#if filtersActive}
        <span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
        ></span>
      {/if}
    </IconButton>

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
