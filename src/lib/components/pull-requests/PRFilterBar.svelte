<script lang="ts">
  import {
    getPRCount,
    getPRCountBySource,
    getIsPRLoading,
    getUniquePRProjectsWithSource,
    getPRCountByProject
  } from '$lib/stores/pull-requests.svelte';
  import SourceToggle from '$lib/components/ui/SourceToggle.svelte';
  import SortMenu from '$lib/components/ui/SortMenu.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { ListFilter } from '@lucide/svelte';
  import FilterPanel from '$lib/components/ui/FilterPanel.svelte';
  import FilterField from '$lib/components/ui/FilterField.svelte';
  import ProjectFilter from '$lib/components/ui/ProjectFilter.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { seg } from '$lib/utils/segments';
  import type {
    NotificationSource,
    PRRoleFilter,
    PRDraftFilter,
    PRCIFilter,
    PRMergeFilter
  } from '$lib/types';
  import { SvelteSet } from 'svelte/reactivity';

  type SourceOption = NotificationSource | 'all';
  type SortMode = 'updated' | 'created';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    draftFilter = 'all',
    ciFilter = 'all',
    mergeFilter = 'all',
    sort = 'updated',
    projectsFilter = new SvelteSet<string>(),
    onSourceChange,
    onRoleChange,
    onDraftChange,
    onCIChange,
    onMergeChange,
    onSortChange,
    onProjectsChange
  }: {
    sourceFilter?: SourceOption;
    roleFilter?: PRRoleFilter;
    draftFilter?: PRDraftFilter;
    ciFilter?: PRCIFilter;
    mergeFilter?: PRMergeFilter;
    sort?: SortMode;
    projectsFilter?: SvelteSet<string>;
    onSourceChange: (source: SourceOption) => void;
    onRoleChange: (role: PRRoleFilter) => void;
    onDraftChange: (draft: PRDraftFilter) => void;
    onCIChange: (ci: PRCIFilter) => void;
    onMergeChange: (merge: PRMergeFilter) => void;
    onSortChange: (sort: SortMode) => void;
    onProjectsChange: (projects: SvelteSet<string>) => void;
  } = $props();

  let totalCount = $derived(getPRCount());
  let githubCount = $derived(getPRCountBySource('github'));
  let gitlabCount = $derived(getPRCountBySource('gitlab'));

  let filterOpen = $state(false);

  let countByProject = $derived(getPRCountByProject(sourceFilter));
  let availableProjects = $derived.by(() => {
    const projects = getUniquePRProjectsWithSource();
    return [...projects].sort((a, b) => {
      const countA = countByProject.get(a.repository) ?? 0;
      const countB = countByProject.get(b.repository) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.repository.localeCompare(b.repository);
    });
  });

  let hasActiveFilter = $derived(
    roleFilter !== 'all' ||
      draftFilter !== 'all' ||
      ciFilter !== 'all' ||
      mergeFilter !== 'all' ||
      projectsFilter.size > 0
  );

  function toggleProject(repo: string) {
    const next = new SvelteSet(projectsFilter);
    if (next.has(repo)) {
      next.delete(repo);
    } else {
      next.add(repo);
    }
    onProjectsChange(next);
  }

  function clearProjects() {
    onProjectsChange(new SvelteSet());
  }

  function resetFilters() {
    onRoleChange('all');
    onDraftChange('all');
    onCIChange('all');
    onMergeChange('all');
    onProjectsChange(new SvelteSet());
    filterOpen = false;
  }

  let initialLoading = $derived(getIsPRLoading() && totalCount === 0);

  const roleOptions = [
    seg<PRRoleFilter>('all', 'All'),
    seg<PRRoleFilter>('authored', 'Created by me'),
    seg<PRRoleFilter>('review_requested', 'To review')
  ];
  const draftOptions = [
    seg<PRDraftFilter>('all', 'All'),
    seg<PRDraftFilter>('ready', 'Ready'),
    seg<PRDraftFilter>('draft', 'Draft')
  ];
  const ciOptions = [
    seg<PRCIFilter>('all', 'All'),
    seg<PRCIFilter>('success', 'Passed'),
    seg<PRCIFilter>('failure', 'Failed'),
    seg<PRCIFilter>('pending', 'Pending')
  ];
  const mergeOptions = [
    seg<PRMergeFilter>('all', 'All'),
    seg<PRMergeFilter>('mergeable', 'Mergeable')
  ];

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Newest first' }
  ];
</script>

{#snippet resetFooter()}
  <button type="button" onclick={resetFilters} class="text-xs font-semibold text-accent-foreground">
    Reset all filters
  </button>
{/snippet}

<div
  data-filter-bar
  class="flex h-10 items-center gap-2 overflow-x-auto border-b border-border pl-4 pr-2 scrollbar-none"
>
  <SourceToggle
    source={sourceFilter}
    total={totalCount}
    {githubCount}
    {gitlabCount}
    {initialLoading}
    {onSourceChange}
  />

  <div class="ml-auto flex items-center">
    <!-- Filter button -->
    <IconButton
      label="Filter"
      expanded={filterOpen}
      active={filterOpen}
      onclick={() => (filterOpen = !filterOpen)}
    >
      <ListFilter size={15} />
      {#if hasActiveFilter}
        <span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
        ></span>
      {/if}
    </IconButton>

    {#if filterOpen}
      <FilterPanel
        onClose={() => (filterOpen = false)}
        footer={hasActiveFilter ? resetFooter : undefined}
      >
        <FilterField title="Role">
          <Segmented
            fill
            label="Role"
            options={roleOptions}
            value={roleFilter}
            onChange={onRoleChange}
          />
        </FilterField>
        <FilterField title="Status">
          <Segmented
            fill
            label="Status"
            options={draftOptions}
            value={draftFilter}
            onChange={onDraftChange}
          />
        </FilterField>
        <FilterField title="CI">
          <Segmented fill label="CI" options={ciOptions} value={ciFilter} onChange={onCIChange} />
        </FilterField>
        <FilterField title="Merge">
          <Segmented
            fill
            label="Merge"
            options={mergeOptions}
            value={mergeFilter}
            onChange={onMergeChange}
          />
        </FilterField>
        <ProjectFilter
          projects={availableProjects}
          selected={projectsFilter}
          counts={countByProject}
          onToggle={toggleProject}
          onClear={clearProjects}
        />
      </FilterPanel>
    {/if}

    <SortMenu options={sortOptions} current={sort} onSelect={(v) => onSortChange(v as SortMode)} />
  </div>
</div>
