<script lang="ts">
  import { clickOutside } from '$lib/actions/clickOutside';
  import { getPRCount, getPRCountBySource, getIsPRLoading } from '$lib/stores/pull-requests.svelte';
  import { isServiceConnected } from '$lib/stores/connections.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import { ArrowDownUp, ChevronDown, Filter, X } from '@lucide/svelte';
  import type { NotificationSource, PRRoleFilter, PRDraftFilter, PRCIFilter } from '$lib/types';

  type SourceOption = NotificationSource | 'all';
  type SortMode = 'updated' | 'created';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    draftFilter = 'all',
    ciFilter = 'all',
    sort = 'updated',
    onSourceChange,
    onRoleChange,
    onDraftChange,
    onCIChange,
    onSortChange
  }: {
    sourceFilter?: SourceOption;
    roleFilter?: PRRoleFilter;
    draftFilter?: PRDraftFilter;
    ciFilter?: PRCIFilter;
    sort?: SortMode;
    onSourceChange: (source: SourceOption) => void;
    onRoleChange: (role: PRRoleFilter) => void;
    onDraftChange: (draft: PRDraftFilter) => void;
    onCIChange: (ci: PRCIFilter) => void;
    onSortChange: (sort: SortMode) => void;
  } = $props();

  let totalCount = $derived(getPRCount());
  let githubCount = $derived(getPRCountBySource('github'));
  let gitlabCount = $derived(getPRCountBySource('gitlab'));

  let githubConnected = $derived(isServiceConnected('github'));
  let gitlabConnected = $derived(isServiceConnected('gitlab'));
  let bothConnected = $derived(githubConnected && gitlabConnected);

  let filterOpen = $state(false);
  let sortOpen = $state(false);
  let sortBtnEl: HTMLButtonElement | undefined = $state();

  let hasActiveFilter = $derived(
    roleFilter !== 'all' || draftFilter !== 'all' || ciFilter !== 'all'
  );

  const chipBase = 'rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors';
  const chipActive = 'border-primary bg-primary text-primary-foreground';
  const chipInactive =
    'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground';

  function resetFilters() {
    onRoleChange('all');
    onDraftChange('all');
    onCIChange('all');
    filterOpen = false;
  }

  const btnBase = 'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors';
  const btnActive = 'bg-foreground text-background';
  const btnInactive = 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground';

  let initialLoading = $derived(getIsPRLoading() && totalCount === 0);

  const badgeBase = 'ml-0.5 rounded-full px-1 py-px text-[9px] font-semibold leading-tight';
  const badgeActive = 'bg-background/20 text-background';
  const badgeInactive = 'bg-secondary text-muted-foreground';

  const roleOptions: { value: PRRoleFilter; label: string }[] = [
    { value: 'authored', label: 'Created by me' },
    { value: 'review_requested', label: 'Review requested' }
  ];

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Newest first' }
  ];

  function pickSort(value: SortMode) {
    onSortChange(value);
    sortOpen = false;
  }
</script>

{#snippet badge(count: number, active: boolean)}
  {#if initialLoading}
    <span class="ml-0.5 inline-block h-3 w-5 animate-pulse rounded-full bg-secondary"></span>
  {:else if count > 0}
    <span class="{badgeBase} {active ? badgeActive : badgeInactive}">{count}</span>
  {/if}
{/snippet}

<div
  class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-secondary/40 px-4 py-1.5 scrollbar-none"
>
  {#if bothConnected}
    <div class="flex shrink-0 overflow-hidden rounded-md border border-border bg-card" role="group">
      <button
        type="button"
        onclick={() => onSourceChange('all')}
        class="{btnBase} rounded-l-md {sourceFilter === 'all' ? btnActive : btnInactive}"
      >
        All
        {@render badge(totalCount, sourceFilter === 'all')}
      </button>

      <button
        type="button"
        onclick={() => onSourceChange('github')}
        title="GitHub"
        class="{btnBase} border-l border-border {sourceFilter === 'github'
          ? btnActive
          : btnInactive}"
      >
        <GitHubIcon size={12} />
        {@render badge(githubCount, sourceFilter === 'github')}
      </button>

      <button
        type="button"
        onclick={() => onSourceChange('gitlab')}
        title="GitLab"
        class="{btnBase} rounded-r-md border-l border-border {sourceFilter === 'gitlab'
          ? btnActive
          : btnInactive}"
      >
        <GitLabIcon size={12} />
        {@render badge(gitlabCount, sourceFilter === 'gitlab')}
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
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div
        class="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-[2px]"
        onclick={(e) => {
          if (e.target === e.currentTarget) filterOpen = false;
        }}
      >
        <div class="z-50 w-72 rounded-lg border border-border bg-card shadow-lg">
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
              <div class="flex flex-wrap gap-1">
                {#each [{ value: 'all' as PRRoleFilter, label: 'All' }, ...roleOptions] as opt (opt.value)}
                  <button
                    type="button"
                    onclick={() => onRoleChange(opt.value)}
                    class="{chipBase} {roleFilter === opt.value ? chipActive : chipInactive}"
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Status -->
            <div>
              <span
                class="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >Status</span
              >
              <div class="flex flex-wrap gap-1">
                {#each [{ value: 'all', label: 'All' }, { value: 'ready', label: 'Ready' }, { value: 'draft', label: 'Draft' }] as opt (opt.value)}
                  <button
                    type="button"
                    onclick={() => onDraftChange(opt.value as PRDraftFilter)}
                    class="{chipBase} {draftFilter === opt.value ? chipActive : chipInactive}"
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- CI -->
            <div>
              <span
                class="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >CI</span
              >
              <div class="flex flex-wrap gap-1">
                {#each [{ value: 'all', label: 'All' }, { value: 'success', label: 'Passed' }, { value: 'failure', label: 'Failed' }, { value: 'pending', label: 'Pending' }] as opt (opt.value)}
                  <button
                    type="button"
                    onclick={() => onCIChange(opt.value as PRCIFilter)}
                    class="{chipBase} {ciFilter === opt.value ? chipActive : chipInactive}"
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>
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
              {sort === opt.value
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
