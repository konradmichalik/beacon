<script lang="ts">
  import { getFilteredPRs, getIsPRLoading } from '$lib/stores/pull-requests.svelte';
  import type { PRSortMode } from '$lib/stores/pull-requests.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import PullRequestCard from './PullRequestCard.svelte';
  import EmptyState from '../notifications/EmptyState.svelte';
  import { Inbox, GitPullRequest } from '@lucide/svelte';
  import type { NotificationSource, PRRoleFilter } from '$lib/types';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    sort = 'updated'
  }: {
    sourceFilter?: NotificationSource | 'all';
    roleFilter?: PRRoleFilter;
    sort?: PRSortMode;
  } = $props();

  let items = $derived(getFilteredPRs(sourceFilter, roleFilter, sort));
  let isLoading = $derived(getIsPRLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  // Section splits only when showing "all" role
  let reviewRequested = $derived(
    roleFilter === 'all'
      ? items.filter((pr) => pr.reviewRequestedFromMe)
      : roleFilter === 'review_requested'
        ? items
        : []
  );
  let authored = $derived(
    roleFilter === 'all'
      ? items.filter((pr) => !pr.reviewRequestedFromMe)
      : roleFilter === 'authored'
        ? items
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
  <div class="flex items-center justify-center py-12">
    <div
      class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
    ></div>
  </div>
{:else if items.length === 0}
  <EmptyState icon={GitPullRequest} title="No open PRs" description="Nothing to review or merge." />
{:else}
  <div class="flex min-h-full flex-col">
    {#if roleFilter === 'all' && reviewRequested.length > 0}
      <!-- Review Requested Section -->
      <div
        class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-card/95 px-4 py-1.5 backdrop-blur-sm"
      >
        <span class="text-[11px] font-semibold text-muted-foreground">To review</span>
        <span
          class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
        >
          {reviewRequested.length}
        </span>
      </div>
      {#each reviewRequested as pr (pr.id)}
        <PullRequestCard pullRequest={pr} />
      {/each}
    {/if}

    {#if roleFilter === 'all' && authored.length > 0}
      <!-- Authored Section -->
      <div
        class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-card/95 px-4 py-1.5 backdrop-blur-sm"
      >
        <span class="text-[11px] font-semibold text-muted-foreground">Created by me</span>
        <span
          class="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
        >
          {authored.length}
        </span>
      </div>
      {#each authored as pr (pr.id)}
        <PullRequestCard pullRequest={pr} />
      {/each}
    {/if}

    {#if roleFilter !== 'all'}
      {#each items as pr (pr.id)}
        <PullRequestCard pullRequest={pr} />
      {/each}
    {/if}
  </div>
{/if}
