<script lang="ts">
  import {
    getIssueCount,
    getIssueCountBySource,
    getIsIssueLoading,
    getUniqueIssueProjectsWithSource,
    getIssueCountByProject
  } from '$lib/stores/issues.svelte';
  import SourceToggle from '$lib/components/ui/SourceToggle.svelte';
  import SortMenu from '$lib/components/ui/SortMenu.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { ListFilter } from '@lucide/svelte';
  import FilterPanel from '$lib/components/ui/FilterPanel.svelte';
  import FilterField from '$lib/components/ui/FilterField.svelte';
  import ProjectFilter from '$lib/components/ui/ProjectFilter.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import type { NotificationSource, IssueRoleFilter } from '$lib/types';
  import { SvelteSet } from 'svelte/reactivity';

  type SourceOption = NotificationSource | 'all';
  type SortMode = 'updated' | 'created';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    sort = 'updated',
    projectsFilter = new SvelteSet<string>(),
    onSourceChange,
    onRoleChange,
    onSortChange,
    onProjectsChange
  }: {
    sourceFilter?: SourceOption;
    roleFilter?: IssueRoleFilter;
    sort?: SortMode;
    projectsFilter?: SvelteSet<string>;
    onSourceChange: (source: SourceOption) => void;
    onRoleChange: (role: IssueRoleFilter) => void;
    onSortChange: (sort: SortMode) => void;
    onProjectsChange: (projects: SvelteSet<string>) => void;
  } = $props();

  let totalCount = $derived(getIssueCount());
  let githubCount = $derived(getIssueCountBySource('github'));
  let gitlabCount = $derived(getIssueCountBySource('gitlab'));

  let filterOpen = $state(false);

  let countByProject = $derived(getIssueCountByProject(sourceFilter));
  let availableProjects = $derived.by(() => {
    const projects = getUniqueIssueProjectsWithSource();
    return [...projects].sort((a, b) => {
      const countA = countByProject.get(a.repository) ?? 0;
      const countB = countByProject.get(b.repository) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.repository.localeCompare(b.repository);
    });
  });

  let hasActiveFilter = $derived(roleFilter !== 'all' || projectsFilter.size > 0);
  let initialLoading = $derived(getIsIssueLoading() && totalCount === 0);

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
    onProjectsChange(new SvelteSet());
    filterOpen = false;
  }

  const roleOptions = [
    { value: 'all' as IssueRoleFilter, aria: 'All', label: 'All' },
    { value: 'authored' as IssueRoleFilter, aria: 'Created by me', label: 'Created by me' },
    { value: 'assigned' as IssueRoleFilter, aria: 'Assigned to me', label: 'Assigned' }
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
