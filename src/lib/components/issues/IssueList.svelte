<script lang="ts">
  import { getFilteredIssues, getIsIssueLoading } from '$lib/stores/issues.svelte';
  import type { IssueSortMode } from '$lib/stores/issues.svelte';
  import { hasAnyServiceConfigured } from '$lib/stores/connections.svelte';
  import IssueCard from './IssueCard.svelte';
  import EmptyState from '../notifications/EmptyState.svelte';
  import PartyPopperIcon from '$lib/components/icons/PartyPopperIcon.svelte';
  import { Inbox, CircleDot, UserCheck } from '@lucide/svelte';
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
  import ListSkeleton from '$lib/components/ui/ListSkeleton.svelte';
  import { motionMs, rise, swipe } from '$lib/utils/motion';
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
  let sections = $derived(
    [
      {
        key: 'authored',
        label: 'Created by me',
        icon: CircleDot,
        items: allItems.filter((issue) => issue.role === 'authored')
      },
      {
        key: 'assigned',
        label: 'Assigned to me',
        icon: UserCheck,
        items: allItems.filter((issue) => issue.role === 'assigned')
      }
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
    description="No open issues."
    iconSize={48}
  />
{:else}
  <div class="flex min-h-full flex-col">
    {#each sections as section (section.key)}
      <SectionHeader
        label={section.label}
        count={section.items.length}
        icon={section.icon}
        expanded={!collapsed[section.key]}
        onclick={() => toggle(section.key)}
      />
      {#if !collapsed[section.key]}
        <div use:roving transition:slide={{ duration: motionMs(220) }}>
          {#each section.items as issue, i (issue.id)}
            <div in:rise|global={{ index: i }} out:swipe animate:flip={{ duration: motionMs(280) }}>
              <IssueCard {issue} />
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
{/if}
