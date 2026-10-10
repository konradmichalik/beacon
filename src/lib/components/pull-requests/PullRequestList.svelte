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
  import { Inbox, ChevronDown, Star, GitPullRequest, Eye, CircleCheckBig } from '@lucide/svelte';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
  import ListSkeleton from '$lib/components/ui/ListSkeleton.svelte';
  import { motionMs, rise, swipe } from '$lib/utils/motion';
  import type {
    NotificationSource,
    PRRoleFilter,
    PRDraftFilter,
    PRCIFilter,
    PRMergeFilter,
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
    mergeFilter = 'all',
    sort = 'updated',
    projectsFilter = new Set<string>()
  }: {
    sourceFilter?: NotificationSource | 'all';
    roleFilter?: PRRoleFilter;
    draftFilter?: PRDraftFilter;
    ciFilter?: PRCIFilter;
    mergeFilter?: PRMergeFilter;
    sort?: PRSortMode;
    projectsFilter?: ReadonlySet<string>;
  } = $props();

  let collapsed: Record<string, boolean> = $state({ reviewed: true });

  function toggle(section: string): void {
    collapsed = { ...collapsed, [section]: !collapsed[section] };
  }

  let allItems = $derived(
    getFilteredPRs({
      source: sourceFilter,
      role: roleFilter,
      sort,
      draft: draftFilter,
      ci: ciFilter,
      merge: mergeFilter,
      projects: projectsFilter
    })
  );
  let isLoading = $derived(getIsPRLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  let starredIds = $derived(getStarredIds());

  // Starred PRs always show at the top; the display window only bounds the rest.
  let starred = $derived(byAttention(allItems.filter((pr) => starredIds.has(pr.id))));
  let unstarredAll = $derived(allItems.filter((pr) => !starredIds.has(pr.id)));
  let unstarred = $derived(byAttention(unstarredAll).slice(0, getPRDisplayLimit()));
  let hasMore = $derived(unstarredAll.length > unstarred.length);
  let remaining = $derived(unstarredAll.length - unstarred.length);

  // Restart the display window whenever the active filters change.
  let filterKey = $derived(
    `${sourceFilter}|${roleFilter}|${draftFilter}|${ciFilter}|${mergeFilter}|${[...projectsFilter].sort().join(',')}`
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
  // Without grouping, the unstarred PRs form one list without a header.
  let sections = $derived(
    [
      {
        key: 'starred',
        label: 'Starred',
        icon: Star,
        iconClass: 'fill-warning text-warning',
        items: starred
      },
      ...(settingsState.groupPullRequests
        ? [
            { key: 'authored', label: 'Created by me', icon: GitPullRequest, items: authored },
            { key: 'toReview', label: 'To review', icon: Eye, items: toReview },
            {
              key: 'reviewed',
              label: 'Reviewed',
              icon: CircleCheckBig,
              iconClass: 'text-success-text',
              items: reviewed
            }
          ]
        : [{ key: 'unstarred', items: byAttention(unstarred) }])
    ].filter((section) => section.items.length > 0)
  );
</script>

{#if !isConfigured}
  <EmptyState
    icon={Inbox}
    title="No services connected"
    description="Open Settings to connect GitHub or GitLab."
  />
{:else if isLoading && allItems.length === 0}
  <ListSkeleton />
{:else if allItems.length === 0}
  <EmptyState
    icon={PartyPopperIcon}
    title="All clear"
    description="No open pull requests."
    iconSize={48}
  />
{:else}
  <div class="flex min-h-full flex-col">
    {#each sections as section (section.key)}
      {#if section.label}
        <SectionHeader
          label={section.label}
          count={section.items.length}
          icon={section.icon}
          iconClass={section.iconClass}
          expanded={!collapsed[section.key]}
          onclick={() => toggle(section.key)}
        />
      {/if}
      {#if !section.label || !collapsed[section.key]}
        <div use:roving transition:slide={{ duration: motionMs(220) }}>
          {#each section.items as pr, i (pr.id)}
            <div in:rise|global={{ index: i }} out:swipe animate:flip={{ duration: motionMs(280) }}>
              <PullRequestCard pullRequest={pr} />
            </div>
          {/each}
        </div>
      {/if}
    {/each}

    {#if hasMore}
      <button
        type="button"
        onclick={loadMorePRs}
        class="flex h-10 w-full items-center justify-center gap-1.5 border-t border-border text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hovered hover:text-foreground"
      >
        <ChevronDown size={12} class="shrink-0" />
        Load more ({remaining})
      </button>
    {/if}
  </div>
{/if}
