<script lang="ts">
  import { getFilteredIssues, getIsIssueLoading } from '$lib/stores/issues.svelte';
  import type { IssueSortMode } from '$lib/stores/issues.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import IssueCard from './IssueCard.svelte';
  import EmptyState from '../notifications/EmptyState.svelte';
  import PartyPopperIcon from '$lib/components/icons/PartyPopperIcon.svelte';
  import { Inbox, ChevronRight, CircleDot, UserCheck } from '@lucide/svelte';
  import type { NotificationSource, IssueRoleFilter } from '$lib/types';
  import { roving } from '$lib/actions/roving';

  let {
    sourceFilter = 'all',
    roleFilter = 'all',
    sort = 'updated',
    projectsFilter = new Set<string>()
  }: {
    sourceFilter?: NotificationSource | 'all';
    roleFilter?: IssueRoleFilter;
    sort?: IssueSortMode;
    projectsFilter?: ReadonlySet<string>;
  } = $props();

  let collapsed: Record<string, boolean> = $state({});

  function toggle(section: string): void {
    collapsed = { ...collapsed, [section]: !collapsed[section] };
  }

  let allItems = $derived(getFilteredIssues(sourceFilter, roleFilter, sort, projectsFilter));
  let isLoading = $derived(getIsIssueLoading());
  let isConfigured = $derived(hasAnyServiceConfigured());

  // Issues are capped (authored + assigned, ~100 max), so the full list is
  // rendered without pagination — keeps section counts honest.
  let authored = $derived(allItems.filter((issue) => issue.role === 'authored'));
  let assigned = $derived(allItems.filter((issue) => issue.role === 'assigned'));
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
    description="No open issues."
    iconSize={48}
  />
{:else}
  {#snippet sectionHeader(label: string, count: number, key: string, icon: typeof CircleDot)}
    {@const Icon = icon}
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
      <Icon size={10} class="shrink-0 text-muted-foreground" />
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
      {@render sectionHeader('Created by me', authored.length, 'authored', CircleDot)}
      {#if !collapsed.authored}
        <div use:roving>
          {#each authored as issue (issue.id)}
            <IssueCard {issue} />
          {/each}
        </div>
      {/if}
    {/if}

    {#if assigned.length > 0}
      {@render sectionHeader('Assigned to me', assigned.length, 'assigned', UserCheck)}
      {#if !collapsed.assigned}
        <div use:roving>
          {#each assigned as issue (issue.id)}
            <IssueCard {issue} />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}
