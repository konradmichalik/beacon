<script lang="ts">
  import {
    getFilteredPRs,
    getIsPRLoading,
    getPRDisplayLimit,
    loadMorePRs,
    resetPRDisplayLimit
  } from '$lib/stores/pull-requests.svelte';
  import type { PRSortMode } from '$lib/stores/pull-requests.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import PullRequestCard from './PullRequestCard.svelte';
  import EmptyState from '../notifications/EmptyState.svelte';
  import PartyPopperIcon from '$lib/components/icons/PartyPopperIcon.svelte';
  import {
    Inbox,
    ChevronRight,
    ChevronDown,
    Star,
    GitPullRequest,
    Eye,
    CircleCheckBig
  } from '@lucide/svelte';
  import type {
    NotificationSource,
    PRRoleFilter,
    PRDraftFilter,
    PRCIFilter,
    UnifiedPullRequest
  } from '$lib/types';
  import { getStarredIds } from '$lib/stores/starred-prs.svelte';
  import { settingsState } from '$lib/stores/settings.svelte';
  import { roving } from '$lib/actions/roving';
  import { attentionPriority, getAttentionState } from '$lib/utils/pr-attention';

  // Sorts attention-bearing PRs (blocked/failing/ready/stale) to the top of a
  // section without introducing a second grouping axis — order otherwise
  // follows whatever `sort` already produced.
  function byAttention(items: readonly UnifiedPullRequest[]): UnifiedPullRequest[] {
    return [...items].sort(
      (a, b) => attentionPriority(getAttentionState(a)) - attentionPriority(getAttentionState(b))
    );
  }

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    draftFilter = 'all',
    ciFilter = 'all',
    sort = 'updated',
    projectsFilter = new Set<string>()
  }: {
    sourceFilter?: NotificationSource | 'all';
    roleFilter?: PRRoleFilter;
    draftFilter?: PRDraftFilter;
    ciFilter?: PRCIFilter;
    sort?: PRSortMode;
    projectsFilter?: ReadonlySet<string>;
  } = $props();

  let collapsed: Record<string, boolean> = $state({ reviewed: true });

  function toggle(section: string): void {
    collapsed = { ...collapsed, [section]: !collapsed[section] };
  }

  let allItems = $derived(
    getFilteredPRs(sourceFilter, roleFilter, sort, draftFilter, ciFilter, projectsFilter)
  );
  let isLoading = $derived(getIsPRLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  let starredIds = $derived(getStarredIds());

  // Starred PRs always show at the top; the display window only bounds the rest.
  let starred = $derived(byAttention(allItems.filter((pr) => starredIds.has(pr.id))));
  let unstarredAll = $derived(allItems.filter((pr) => !starredIds.has(pr.id)));
  let unstarred = $derived(unstarredAll.slice(0, getPRDisplayLimit()));
  let hasMore = $derived(unstarredAll.length > unstarred.length);
  let remaining = $derived(unstarredAll.length - unstarred.length);

  // Restart the display window whenever the active filters change.
  let filterKey = $derived(
    `${sourceFilter}|${roleFilter}|${draftFilter}|${ciFilter}|${[...projectsFilter].sort().join(',')}`
  );
  let lastFilterKey = '';
  $effect(() => {
    if (filterKey !== lastFilterKey) {
      lastFilterKey = filterKey;
      resetPRDisplayLimit();
    }
  });

  // Section splits (only unstarred PRs)
  let authored = $derived(
    byAttention(
      roleFilter === 'all'
        ? unstarred.filter((pr) => !pr.reviewRequestedFromMe)
        : roleFilter === 'authored'
          ? unstarred
          : []
    )
  );
  let toReview = $derived(
    byAttention(
      roleFilter === 'all'
        ? unstarred.filter((pr) => pr.reviewRequestedFromMe && !pr.reviewedByMe)
        : roleFilter === 'review_requested'
          ? unstarred.filter((pr) => !pr.reviewedByMe)
          : []
    )
  );
  let reviewed = $derived(
    byAttention(
      roleFilter === 'all'
        ? unstarred.filter((pr) => pr.reviewRequestedFromMe && pr.reviewedByMe)
        : roleFilter === 'review_requested'
          ? unstarred.filter((pr) => pr.reviewedByMe)
          : []
    )
  );
  // Only rendered when groupPullRequests is off — the ungrouped fallback list.
  let unstarredSorted = $derived(byAttention(unstarred));
</script>

{#if !isConfigured}
  <EmptyState
    icon={Inbox}
    title="No services connected"
    description="Open Settings to connect GitHub or GitLab."
  />
{:else if isLoading && allItems.length === 0}
  <div class="divide-y divide-border">
    {#each [0, 1, 2, 3, 4] as i (i)}
      <div class="flex gap-3 px-4 py-3">
        <div class="h-7 w-7 shrink-0 animate-pulse rounded-full bg-secondary"></div>
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <div class="h-3 w-3/4 animate-pulse rounded bg-secondary"></div>
          <div class="h-2.5 w-1/2 animate-pulse rounded bg-secondary/60"></div>
        </div>
      </div>
    {/each}
  </div>
{:else if allItems.length === 0}
  <EmptyState
    icon={PartyPopperIcon}
    title="All clear"
    description="No open pull requests."
    iconSize={48}
  />
{:else}
  {#snippet sectionHeader(
    label: string,
    count: number,
    key: string,
    icon?: typeof Star,
    iconClass?: string
  )}
    <button
      type="button"
      onclick={() => toggle(key)}
      class="sticky top-0 z-10 flex w-full items-center gap-1.5 border-b border-border bg-card/95 px-4 py-1.5 backdrop-blur-sm transition-colors hover:bg-secondary/40"
    >
      <ChevronRight
        size={12}
        class="shrink-0 text-muted-foreground transition-transform {collapsed[key]
          ? ''
          : 'rotate-90'}"
      />
      {#if icon}
        {@const Icon = icon}
        <Icon size={10} class="shrink-0 {iconClass ?? 'text-muted-foreground'}" />
      {/if}
      <span class="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span
        class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
      >
        {count}
      </span>
    </button>
  {/snippet}

  <div class="flex min-h-full flex-col">
    {#if starred.length > 0}
      {@render sectionHeader(
        'Starred',
        starred.length,
        'starred',
        Star,
        'fill-warning text-warning'
      )}
      {#if !collapsed.starred}
        <div use:roving>
          {#each starred as pr (pr.id)}
            <PullRequestCard pullRequest={pr} />
          {/each}
        </div>
      {/if}
    {/if}

    {#if settingsState.groupPullRequests}
      {#if authored.length > 0}
        {@render sectionHeader('Created by me', authored.length, 'authored', GitPullRequest)}
        {#if !collapsed.authored}
          <div use:roving>
            {#each authored as pr (pr.id)}
              <PullRequestCard pullRequest={pr} />
            {/each}
          </div>
        {/if}
      {/if}

      {#if toReview.length > 0}
        {@render sectionHeader('To review', toReview.length, 'toReview', Eye)}
        {#if !collapsed.toReview}
          <div use:roving>
            {#each toReview as pr (pr.id)}
              <PullRequestCard pullRequest={pr} />
            {/each}
          </div>
        {/if}
      {/if}

      {#if reviewed.length > 0}
        {@render sectionHeader(
          'Reviewed',
          reviewed.length,
          'reviewed',
          CircleCheckBig,
          'text-success-text'
        )}
        {#if !collapsed.reviewed}
          <div use:roving>
            {#each reviewed as pr (pr.id)}
              <PullRequestCard pullRequest={pr} />
            {/each}
          </div>
        {/if}
      {/if}
    {:else}
      {#each unstarredSorted as pr (pr.id)}
        <PullRequestCard pullRequest={pr} />
      {/each}
    {/if}

    {#if hasMore}
      <button
        type="button"
        onclick={loadMorePRs}
        class="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
      >
        <ChevronDown size={12} class="shrink-0" />
        Load more ({remaining})
      </button>
    {/if}
  </div>
{/if}
