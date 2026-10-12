<script lang="ts">
  import {
    filterState,
    toggleTypeFilter,
    toggleProjectFilter,
    toggleStatusFilter,
    toggleAuthorFilter,
    setDraftFilter,
    setQuery,
    clearTypeFilters,
    clearProjectFilters,
    clearStatusFilters,
    clearAuthorFilters,
    clearAllFilters,
    hasActiveFilters
  } from '$lib/stores/filters.svelte';
  import type { StatusFilter, NotificationDraftFilter } from '$lib/stores/filters.svelte';
  import {
    getUniqueTypes,
    getUniqueProjectsWithSource,
    getUniqueAuthors,
    getUnreadCountByType,
    getUnreadCountByProject,
    getUnreadCountByStatus,
    getUnreadCountByAuthor
  } from '$lib/stores/notifications.svelte';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import { Search } from '@lucide/svelte';
  import FilterPanel from '$lib/components/ui/FilterPanel.svelte';
  import FilterField from '$lib/components/ui/FilterField.svelte';
  import CheckRow from '$lib/components/ui/CheckRow.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import ProjectFilter from '$lib/components/ui/ProjectFilter.svelte';

  let { onClose }: { onClose: () => void } = $props();

  const VISIBLE_LIMIT = 5;

  let showAllAuthors = $state(false);

  let availableTypes = $derived(getUniqueTypes());
  let unreadByType = $derived(getUnreadCountByType(filterState.source));
  let unreadByProject = $derived(getUnreadCountByProject(filterState.source));
  let unreadByStatus = $derived(getUnreadCountByStatus(filterState.source));
  let unreadByAuthor = $derived(getUnreadCountByAuthor(filterState.source));
  let availableProjects = $derived.by(() => {
    const projects = getUniqueProjectsWithSource();
    return [...projects].sort((a, b) => {
      const countA = unreadByProject.get(a.repository) ?? 0;
      const countB = unreadByProject.get(b.repository) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.repository.localeCompare(b.repository);
    });
  });
  let availableAuthors = $derived.by(() => {
    const authors = getUniqueAuthors();
    return [...authors].sort((a, b) => {
      const countA = unreadByAuthor.get(a.login) ?? 0;
      const countB = unreadByAuthor.get(b.login) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.login.localeCompare(b.login);
    });
  });
  let visibleAuthors = $derived(
    showAllAuthors ? availableAuthors : availableAuthors.slice(0, VISIBLE_LIMIT)
  );
  let filtersActive = $derived(hasActiveFilters());

  const draftOptions = [
    { value: 'all' as const, aria: 'All', label: 'All' },
    { value: 'ready' as const, aria: 'Ready', label: 'Ready' },
    { value: 'draft' as const, aria: 'Draft', label: 'Draft' }
  ];

  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed / Merged' }
  ];

  const chipBase =
    'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11.5px] font-medium transition-colors';
</script>

{#snippet toggleChip(label: string, active: boolean, count: number, onclick: () => void)}
  <button
    type="button"
    aria-pressed={active}
    {onclick}
    class="{chipBase} {active
      ? 'border-primary bg-primary text-primary-foreground'
      : count === 0
        ? 'border-border-strong text-subtlest'
        : 'border-border-strong text-muted-foreground hover:text-foreground'}"
  >
    {label}
    {#if count > 0}
      <span class="tabular-nums opacity-80">{count}</span>
    {/if}
  </button>
{/snippet}

{#snippet clearAction(onclick: () => void)}
  <button type="button" {onclick} class="text-[11.5px] font-medium text-accent-foreground">
    Clear
  </button>
{/snippet}

{#snippet resetFooter()}
  <button
    type="button"
    onclick={() => {
      clearAllFilters();
      onClose();
    }}
    class="text-xs font-semibold text-accent-foreground"
  >
    Reset all filters
  </button>
{/snippet}

<FilterPanel {onClose} footer={filtersActive ? resetFooter : undefined}>
  <FilterField title="Search">
    <label for="notification-query" class="sr-only">Search</label>
    <div
      class="flex h-[30px] items-center gap-1.5 rounded-[7px] border border-input bg-background px-2 text-subtlest focus-within:ring-1 focus-within:ring-primary"
    >
      <Search size={13} class="shrink-0" />
      <input
        id="notification-query"
        type="text"
        value={filterState.query}
        oninput={(e) => setQuery(e.currentTarget.value)}
        placeholder="repo:owner/name author:login -bot"
        class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-subtlest"
      />
    </div>
  </FilterField>

  {#if availableTypes.length > 0}
    <FilterField title="Type">
      <div class="flex flex-wrap gap-1">
        {@render toggleChip('All', filterState.types.size === 0, 0, clearTypeFilters)}
        {#each availableTypes as type (type)}
          {@render toggleChip(
            NOTIFICATION_TYPE_LABELS[type] ?? type,
            filterState.types.has(type),
            unreadByType.get(type) ?? 0,
            () => toggleTypeFilter(type)
          )}
        {/each}
      </div>
    </FilterField>
  {/if}

  <FilterField title="Status">
    <div class="flex flex-wrap gap-1">
      {@render toggleChip('All', filterState.statuses.size === 0, 0, clearStatusFilters)}
      {#each statusOptions as status (status.value)}
        {@render toggleChip(
          status.label,
          filterState.statuses.has(status.value as StatusFilter),
          unreadByStatus.get(status.value as StatusFilter) ?? 0,
          () => toggleStatusFilter(status.value as StatusFilter)
        )}
      {/each}
    </div>
  </FilterField>

  <FilterField title="Draft">
    <Segmented
      fill
      label="Draft"
      options={draftOptions}
      value={filterState.draftFilter}
      onChange={(value) => setDraftFilter(value as NotificationDraftFilter)}
    />
  </FilterField>

  <ProjectFilter
    projects={availableProjects}
    selected={filterState.projects}
    counts={unreadByProject}
    onToggle={toggleProjectFilter}
    onClear={clearProjectFilters}
    limit={VISIBLE_LIMIT}
  />

  {#if availableAuthors.length > 0}
    <FilterField title="Author">
      {#snippet action()}
        {#if filterState.authors.size > 0}
          {@render clearAction(clearAuthorFilters)}
        {/if}
      {/snippet}
      {#each visibleAuthors as author (author.login)}
        {@const count = unreadByAuthor.get(author.login) ?? 0}
        <CheckRow
          checked={filterState.authors.has(author.login)}
          onchange={() => toggleAuthorFilter(author.login)}
          label={author.login}
          {count}
          dimmed={count === 0}
        >
          {#snippet leading()}
            {#if author.avatarUrl}
              <img src={author.avatarUrl} alt="" class="h-4 w-4 shrink-0 rounded-full" />
            {/if}
          {/snippet}
        </CheckRow>
      {/each}
      {#if !showAllAuthors && availableAuthors.length > VISIBLE_LIMIT}
        <button
          type="button"
          onclick={() => (showAllAuthors = true)}
          class="h-7 w-full rounded-md px-1.5 text-left text-xs font-medium text-accent-foreground"
        >
          +{availableAuthors.length - VISIBLE_LIMIT} more
        </button>
      {/if}
    </FilterField>
  {/if}
</FilterPanel>
