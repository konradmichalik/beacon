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
    getLastRefresh,
    markAllAsRead
  } from '$lib/stores/notifications.svelte';
  import { isServiceConnected } from '$lib/stores/connections.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import FilterPopover from './FilterPopover.svelte';
  import { ArrowDownUp, CheckCheck, Filter, ChevronDown } from '@lucide/svelte';
  import type { NotificationSource } from '$lib/types';

  type FilterOption = NotificationSource | 'all';

  let totalCount = $derived(getFilteredUnreadCount());
  let githubCount = $derived(getCountBySource('github'));
  let gitlabCount = $derived(getCountBySource('gitlab'));

  let githubConnected = $derived(isServiceConnected('github'));
  let gitlabConnected = $derived(isServiceConnected('gitlab'));
  let bothConnected = $derived(githubConnected && gitlabConnected);

  let filteredNotifications = $derived(
    getFilteredNotifications(
      filterState.source,
      filterState.project,
      filterState.sort,
      filterState.types,
      filterState.projects,
      filterState.statuses,
      filterState.authors,
      filterState.draftFilter
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

  let filtersActive = $derived(hasActiveFilters());
  let popoverOpen = $state(false);
  let markReadOpen = $state(false);
  let markReadBtnEl: HTMLButtonElement | undefined = $state();
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
  const btnActive = 'bg-primary text-primary-foreground';
  const btnInactive = 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground';

  let initialLoading = $derived(getLastRefresh() === null);

  const badgeBase = 'ml-0.5 rounded-full px-1 py-px text-[9px] font-semibold leading-tight';
  const badgeActive = 'bg-primary-foreground/20 text-primary-foreground';
  const badgeInactive = 'bg-secondary text-muted-foreground';
</script>

{#snippet badge(count: number, active: boolean)}
  {#if initialLoading}
    <span class="ml-0.5 inline-block h-3 w-5 animate-pulse rounded-full bg-secondary"></span>
  {:else if count > 0}
    <span class="{badgeBase} {active ? badgeActive : badgeInactive}">{count}</span>
  {/if}
{/snippet}

<div
  data-filter-bar
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
        {@render badge(totalCount, isActive('all'))}
      </button>

      <button
        type="button"
        onclick={() => setSourceFilter('github')}
        title="GitHub"
        class="{btnBase} border-l border-border {isActive('github') ? btnActive : btnInactive}"
      >
        <GitHubIcon size={12} />
        {@render badge(githubCount, isActive('github'))}
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
        {@render badge(gitlabCount, isActive('gitlab'))}
      </button>
    </div>
  {:else if githubConnected || gitlabConnected}
    <div
      class="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1"
      title={githubConnected ? 'GitHub' : 'GitLab'}
    >
      {#if githubConnected}
        <GitHubIcon size={12} />
        {@render badge(githubCount, false)}
      {:else if gitlabConnected}
        <GitLabIcon size={12} />
        {@render badge(gitlabCount, false)}
      {/if}
    </div>
  {/if}

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
        <button
          type="button"
          onclick={() => {
            markAllAsRead(filteredIds);
            markReadOpen = false;
          }}
          class="flex w-full items-center px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          All
        </button>
        <button
          type="button"
          disabled={closedMergedIds.size === 0}
          onclick={() => {
            markAllAsRead(closedMergedIds);
            markReadOpen = false;
          }}
          class="flex w-full items-center px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          Closed & Merged
        </button>
        <button
          type="button"
          disabled={draftIds.size === 0}
          onclick={() => {
            markAllAsRead(draftIds);
            markReadOpen = false;
          }}
          class="flex w-full items-center px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          Drafts
        </button>
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

    <!-- Sort button -->
    <button
      type="button"
      bind:this={sortBtnEl}
      onclick={() => (sortOpen = !sortOpen)}
      title="Sort"
      class="flex items-center gap-0.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-1 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <ArrowDownUp size={11} />
      <ChevronDown size={9} />
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
