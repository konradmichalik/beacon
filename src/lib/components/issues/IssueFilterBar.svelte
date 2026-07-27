<script lang="ts">
  import {
    getIssueCount,
    getIssueCountBySource,
    getIsIssueLoading,
    getUniqueIssueProjectsWithSource,
    getIssueCountByRole,
    getIssueCountByProject
  } from '$lib/stores/issues.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import SourceToggle from '$lib/components/ui/SourceToggle.svelte';
  import SortMenu from '$lib/components/ui/SortMenu.svelte';
  import { focusTrap } from '$lib/actions/focusTrap';
  import { Filter, X } from '@lucide/svelte';
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

  let countByRole = $derived(getIssueCountByRole(sourceFilter));
  let countByProject = $derived(getIssueCountByProject(sourceFilter));
  let sourceScopedTotal = $derived(
    sourceFilter === 'all' ? totalCount : sourceFilter === 'github' ? githubCount : gitlabCount
  );
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

  const chipBase = 'rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors';
  const chipActive = 'border-primary bg-primary text-primary-foreground';
  const chipInactive =
    'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground';
  const badgeBase = 'ml-0.5 rounded-full px-1 py-px text-[9px] font-semibold leading-tight';
  const badgeActive = 'bg-primary-foreground/20 text-primary-foreground';
  const badgeInactive = 'bg-secondary text-muted-foreground';

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

  const roleOptions: { value: IssueRoleFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'authored', label: 'Created by me' },
    { value: 'assigned', label: 'Assigned to me' }
  ];

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Newest first' }
  ];
</script>

{#snippet filterChips(
  options: { value: string; label: string }[],
  currentValue: string,
  counts: ReadonlyMap<string, number>,
  total: number,
  onChange: (value: string) => void
)}
  <div class="flex flex-wrap gap-1">
    {#each options as opt (opt.value)}
      {@const count = opt.value === 'all' ? total : (counts.get(opt.value) ?? 0)}
      {@const active = currentValue === opt.value}
      <button
        type="button"
        onclick={() => onChange(opt.value)}
        class="flex items-center gap-1 {chipBase} {active
          ? chipActive
          : opt.value !== 'all' && count === 0
            ? 'border-border text-muted-foreground/50'
            : chipInactive}"
      >
        {opt.label}
        {#if count > 0}
          <span class="{badgeBase} {active ? badgeActive : badgeInactive}">
            {count}
          </span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && filterOpen) filterOpen = false;
  }}
/>

<div
  data-filter-bar
  class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-secondary/40 px-4 py-1.5 scrollbar-none"
>
  <SourceToggle
    source={sourceFilter}
    total={totalCount}
    {githubCount}
    {gitlabCount}
    {initialLoading}
    {onSourceChange}
  />

  <div class="ml-auto flex items-center gap-1.5">
    <!-- Filter button -->
    <button
      type="button"
      onclick={() => (filterOpen = !filterOpen)}
      title="Filter"
      class="relative rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <Filter size={11} />
      {#if hasActiveFilter}
        <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"></span>
      {/if}
    </button>

    {#if filterOpen}
      <div
        class="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-[2px]"
        role="presentation"
        onclick={(e) => {
          if (e.target === e.currentTarget) filterOpen = false;
        }}
      >
        <div
          class="z-50 w-72 rounded-lg border border-border bg-card shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          use:focusTrap
        >
          <div
            class="flex items-center justify-between rounded-t-lg border-b border-border bg-secondary/40 px-3 py-2"
          >
            <span class="text-[11px] font-semibold text-foreground">Filters</span>
            <button
              type="button"
              onclick={() => (filterOpen = false)}
              class="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>

          <div class="space-y-3 p-3">
            <!-- Role -->
            <div>
              <span
                class="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >Role</span
              >
              {@render filterChips(roleOptions, roleFilter, countByRole, sourceScopedTotal, (v) =>
                onRoleChange(v as IssueRoleFilter)
              )}
            </div>

            <!-- Project -->
            {#if availableProjects.length > 0}
              <div>
                <div class="mb-1.5 flex items-center justify-between">
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >Project</span
                  >
                  {#if projectsFilter.size > 0}
                    <button
                      type="button"
                      onclick={clearProjects}
                      class="text-[10px] text-primary hover:underline">Clear</button
                    >
                  {/if}
                </div>
                <div class="max-h-28 space-y-0.5 overflow-y-auto">
                  {#each availableProjects as project (project.repository)}
                    {@const active = projectsFilter.has(project.repository)}
                    {@const count = countByProject.get(project.repository) ?? 0}
                    <label
                      class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onchange={() => toggleProject(project.repository)}
                        class="h-3 w-3 rounded border-border accent-primary"
                      />
                      {#if project.source === 'github'}
                        <GitHubIcon size={11} class="shrink-0 text-muted-foreground" />
                      {:else}
                        <GitLabIcon size={11} class="shrink-0 text-muted-foreground" />
                      {/if}
                      <span
                        class="truncate text-[11px] {active
                          ? 'font-medium text-foreground'
                          : count === 0
                            ? 'text-muted-foreground/50'
                            : 'text-muted-foreground'}"
                      >
                        {project.repository.split('/').slice(-2).join('/')}
                      </span>
                      {#if count > 0}
                        <span
                          class="ml-auto shrink-0 rounded-full bg-secondary px-1 py-px text-[9px] font-semibold leading-tight text-muted-foreground"
                        >
                          {count}
                        </span>
                      {/if}
                    </label>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          {#if hasActiveFilter}
            <div class="border-t border-border px-3 py-2">
              <button
                type="button"
                onclick={resetFilters}
                class="w-full rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                Reset all filters
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <SortMenu options={sortOptions} current={sort} onSelect={(v) => onSortChange(v as SortMode)} />
  </div>
</div>
