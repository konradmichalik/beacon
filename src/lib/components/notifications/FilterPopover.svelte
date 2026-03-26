<script lang="ts">
  import {
    filterState,
    toggleTypeFilter,
    toggleProjectFilter,
    toggleStatusFilter,
    clearTypeFilters,
    clearProjectFilters,
    clearStatusFilters,
    clearAllFilters,
    hasActiveFilters
  } from '$lib/stores/filters.svelte';
  import type { StatusFilter } from '$lib/stores/filters.svelte';
  import {
    getUniqueTypes,
    getUniqueProjectsWithSource,
    getUnreadCountByType,
    getUnreadCountByProject
  } from '$lib/stores/notifications.svelte';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import { X } from '@lucide/svelte';
  import { focusTrap } from '$lib/actions/focusTrap';

  let { onClose }: { onClose: () => void } = $props();

  let availableTypes = $derived(getUniqueTypes());
  let availableProjects = $derived.by(() => {
    const projects = getUniqueProjectsWithSource();
    return [...projects].sort((a, b) => {
      const countA = unreadByProject.get(a.repository) ?? 0;
      const countB = unreadByProject.get(b.repository) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.repository.localeCompare(b.repository);
    });
  });
  let filtersActive = $derived(hasActiveFilters());
  let unreadByType = $derived(getUnreadCountByType(filterState.source));
  let unreadByProject = $derived(getUnreadCountByProject(filterState.source));

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-[2px]"
  role="presentation"
  onclick={handleBackdropClick}
>
  <!-- Modal -->
  <div
    class="z-50 w-72 rounded-lg border border-border bg-card shadow-lg"
    role="dialog"
    aria-modal="true"
    use:focusTrap
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between rounded-t-lg border-b border-border bg-secondary/40 px-3 py-2"
    >
      <span class="text-[11px] font-semibold text-foreground">Filters</span>
      <button
        type="button"
        onclick={onClose}
        class="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={12} />
      </button>
    </div>

    <div class="space-y-3 p-3">
      <!-- Type filter -->
      {#if availableTypes.length > 0}
        <div>
          <span
            class="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >Type</span
          >
          <div class="flex flex-wrap gap-1">
            <button
              type="button"
              onclick={clearTypeFilters}
              class="rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors
                {filterState.types.size === 0
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
            >
              All
            </button>
            {#each availableTypes as type (type)}
              {@const active = filterState.types.has(type)}
              {@const count = unreadByType.get(type) ?? 0}
              <button
                type="button"
                onclick={() => toggleTypeFilter(type)}
                class="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors
                  {active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : count === 0
                    ? 'border-border text-muted-foreground/50'
                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
              >
                {NOTIFICATION_TYPE_LABELS[type] ?? type}
                {#if count > 0}
                  <span
                    class="rounded-full px-1 py-px text-[9px] font-semibold leading-tight
                      {active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'}"
                  >
                    {count}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Status filter -->
      <div>
        <span
          class="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >Status</span
        >
        <div class="flex flex-wrap gap-1">
          <button
            type="button"
            onclick={clearStatusFilters}
            class="rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors
              {filterState.statuses.size === 0
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
          >
            All
          </button>
          {#each [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed / Merged' }] as status (status.value)}
            {@const active = filterState.statuses.has(status.value as StatusFilter)}
            <button
              type="button"
              onclick={() => toggleStatusFilter(status.value as StatusFilter)}
              class="rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors
                {active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
            >
              {status.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Project filter -->
      {#if availableProjects.length > 0}
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >Project</span
            >
            {#if filterState.projects.size > 0}
              <button
                type="button"
                onclick={clearProjectFilters}
                class="text-[10px] text-primary hover:underline">Clear</button
              >
            {/if}
          </div>
          <div class="max-h-28 space-y-0.5 overflow-y-auto">
            {#each availableProjects as project (project.repository)}
              {@const active = filterState.projects.has(project.repository)}
              {@const count = unreadByProject.get(project.repository) ?? 0}
              <label
                class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onchange={() => toggleProjectFilter(project.repository)}
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

    <!-- Footer -->
    {#if filtersActive}
      <div class="border-t border-border px-3 py-2">
        <button
          type="button"
          onclick={() => {
            clearAllFilters();
            onClose();
          }}
          class="w-full rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary/80"
        >
          Reset all filters
        </button>
      </div>
    {/if}
  </div>
</div>
