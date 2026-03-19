<script lang="ts">
  import { getFilteredPRs, getIsPRLoading } from '$lib/stores/pull-requests.svelte';
  import type { PRSortMode } from '$lib/stores/pull-requests.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import PullRequestCard from './PullRequestCard.svelte';
  import EmptyState from '../notifications/EmptyState.svelte';
  import PartyPopperIcon from '$lib/components/icons/PartyPopperIcon.svelte';
  import { Inbox, ChevronRight } from '@lucide/svelte';
  import type { NotificationSource, PRRoleFilter, PRDraftFilter, PRCIFilter } from '$lib/types';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    draftFilter = 'all',
    ciFilter = 'all',
    sort = 'updated'
  }: {
    sourceFilter?: NotificationSource | 'all';
    roleFilter?: PRRoleFilter;
    draftFilter?: PRDraftFilter;
    ciFilter?: PRCIFilter;
    sort?: PRSortMode;
  } = $props();

  let collapsed: Record<string, boolean> = $state({ reviewed: true });

  function toggle(section: string): void {
    collapsed = { ...collapsed, [section]: !collapsed[section] };
  }

  let items = $derived(getFilteredPRs(sourceFilter, roleFilter, sort, draftFilter, ciFilter));
  let isLoading = $derived(getIsPRLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  // Section splits
  let authored = $derived(
    roleFilter === 'all'
      ? items.filter((pr) => !pr.reviewRequestedFromMe)
      : roleFilter === 'authored'
        ? items
        : []
  );
  let toReview = $derived(
    roleFilter === 'all'
      ? items.filter((pr) => pr.reviewRequestedFromMe && !pr.reviewedByMe)
      : roleFilter === 'review_requested'
        ? items.filter((pr) => !pr.reviewedByMe)
        : []
  );
  let reviewed = $derived(
    roleFilter === 'all'
      ? items.filter((pr) => pr.reviewRequestedFromMe && pr.reviewedByMe)
      : roleFilter === 'review_requested'
        ? items.filter((pr) => pr.reviewedByMe)
        : []
  );
</script>

{#if !isConfigured}
  <EmptyState
    icon={Inbox}
    title="No services connected"
    description="Open Settings to connect GitHub or GitLab."
  />
{:else if isLoading && items.length === 0}
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
{:else if items.length === 0}
  <EmptyState
    icon={PartyPopperIcon}
    title="All clear"
    description="No open pull requests."
    iconSize={48}
  />
{:else}
  {#snippet sectionHeader(label: string, count: number, key: string)}
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
      <span class="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <span
        class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
      >
        {count}
      </span>
    </button>
  {/snippet}

  <div class="flex min-h-full flex-col">
    {#if authored.length > 0}
      {@render sectionHeader('Created by me', authored.length, 'authored')}
      {#if !collapsed.authored}
        {#each authored as pr (pr.id)}
          <PullRequestCard pullRequest={pr} />
        {/each}
      {/if}
    {/if}

    {#if toReview.length > 0}
      {@render sectionHeader('To review', toReview.length, 'toReview')}
      {#if !collapsed.toReview}
        {#each toReview as pr (pr.id)}
          <PullRequestCard pullRequest={pr} />
        {/each}
      {/if}
    {/if}

    {#if reviewed.length > 0}
      {@render sectionHeader('Reviewed', reviewed.length, 'reviewed')}
      {#if !collapsed.reviewed}
        {#each reviewed as pr (pr.id)}
          <PullRequestCard pullRequest={pr} />
        {/each}
      {/if}
    {/if}
  </div>
{/if}
