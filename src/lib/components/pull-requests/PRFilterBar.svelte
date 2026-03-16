<script lang="ts">
  import { clickOutside } from '$lib/actions/clickOutside';
  import { getPRCount, getPRCountBySource } from '$lib/stores/pull-requests.svelte';
  import { isServiceConnected } from '$lib/stores/connections.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import { ArrowDownUp, Filter } from '@lucide/svelte';
  import type { NotificationSource, PRRoleFilter } from '$lib/types';

  type SourceOption = NotificationSource | 'all';
  type SortMode = 'updated' | 'created';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    sort = 'updated',
    onSourceChange,
    onRoleChange,
    onSortChange
  }: {
    sourceFilter?: SourceOption;
    roleFilter?: PRRoleFilter;
    sort?: SortMode;
    onSourceChange: (source: SourceOption) => void;
    onRoleChange: (role: PRRoleFilter) => void;
    onSortChange: (sort: SortMode) => void;
  } = $props();

  let totalCount = $derived(getPRCount());
  let githubCount = $derived(getPRCountBySource('github'));
  let gitlabCount = $derived(getPRCountBySource('gitlab'));

  let githubConnected = $derived(isServiceConnected('github'));
  let gitlabConnected = $derived(isServiceConnected('gitlab'));
  let bothConnected = $derived(githubConnected && gitlabConnected);

  let filterOpen = $state(false);
  let filterBtnEl: HTMLButtonElement | undefined = $state();
  let sortOpen = $state(false);
  let sortBtnEl: HTMLButtonElement | undefined = $state();

  let hasRoleFilter = $derived(roleFilter !== 'all');

  const btnBase = 'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors';
  const btnActive = 'bg-foreground text-background';
  const btnInactive = 'text-muted-foreground hover:text-foreground';

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

<div
  class="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-secondary/40 px-4 py-1.5 scrollbar-none"
>
  {#if bothConnected}
    <div class="flex shrink-0 overflow-hidden rounded-md border border-border" role="group">
      <button
        type="button"
        onclick={() => onSourceChange('all')}
        class="{btnBase} rounded-l-md {sourceFilter === 'all' ? btnActive : btnInactive}"
      >
        All
        {#if totalCount > 0}
          <span class="{badgeBase} {sourceFilter === 'all' ? badgeActive : badgeInactive}"
            >{totalCount}</span
          >
        {/if}
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
        {#if githubCount > 0}
          <span class="{badgeBase} {sourceFilter === 'github' ? badgeActive : badgeInactive}"
            >{githubCount}</span
          >
        {/if}
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
        {#if gitlabCount > 0}
          <span class="{badgeBase} {sourceFilter === 'gitlab' ? badgeActive : badgeInactive}"
            >{gitlabCount}</span
          >
        {/if}
      </button>
    </div>
  {/if}

  <div class="ml-auto flex items-center gap-1.5">
    <!-- Filter button -->
    <button
      type="button"
      bind:this={filterBtnEl}
      onclick={() => (filterOpen = !filterOpen)}
      title="Filter"
      class="relative rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <Filter size={11} />
      {#if hasRoleFilter}
        <span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary"></span>
      {/if}
    </button>

    {#if filterOpen && filterBtnEl}
      {@const rect = filterBtnEl.getBoundingClientRect()}
      {@const popoverWidth = 200}
      {@const left = Math.max(4, rect.right - popoverWidth)}
      <div
        use:clickOutside={() => (filterOpen = false)}
        style="position:fixed;top:{rect.bottom + 6}px;left:{left}px;"
        class="z-50 w-[200px] rounded-lg border border-border bg-card shadow-lg"
      >
        <div class="border-b border-border px-3 py-2">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >Show</span
          >
        </div>
        <div class="p-1.5">
          <button
            type="button"
            onclick={() => {
              onRoleChange('all');
              filterOpen = false;
            }}
            class="flex w-full items-center rounded px-2 py-1.5 text-[11px] font-medium transition-colors
              {roleFilter === 'all'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}"
          >
            All pull requests
          </button>
          {#each roleOptions as opt (opt.value)}
            <button
              type="button"
              onclick={() => {
                onRoleChange(opt.value);
                filterOpen = false;
              }}
              class="flex w-full items-center rounded px-2 py-1.5 text-[11px] font-medium transition-colors
                {roleFilter === opt.value
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Sort button -->
    <button
      type="button"
      bind:this={sortBtnEl}
      onclick={() => (sortOpen = !sortOpen)}
      title="Sort"
      class="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
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
