<script lang="ts">
  import type { NotificationSource } from '$lib/types';
  import { repoShortName } from '$lib/utils/repository';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import CheckRow from './CheckRow.svelte';
  import FilterField from './FilterField.svelte';

  let {
    projects,
    selected,
    counts,
    onToggle,
    onClear,
    limit
  }: {
    projects: readonly { repository: string; source: NotificationSource }[];
    selected: ReadonlySet<string>;
    counts: ReadonlyMap<string, number>;
    onToggle: (repository: string) => void;
    onClear: () => void;
    limit?: number;
  } = $props();

  let showAll = $state(false);
  let visible = $derived(limit !== undefined && !showAll ? projects.slice(0, limit) : projects);
  let hidden = $derived(projects.length - visible.length);
</script>

{#if projects.length > 0}
  <FilterField title="Project">
    {#snippet action()}
      {#if selected.size > 0}
        <button
          type="button"
          onclick={onClear}
          class="text-[11.5px] font-medium text-accent-foreground"
        >
          Clear
        </button>
      {/if}
    {/snippet}
    {#each visible as project (project.repository)}
      {@const count = counts.get(project.repository) ?? 0}
      <CheckRow
        checked={selected.has(project.repository)}
        onchange={() => onToggle(project.repository)}
        label={repoShortName(project.repository)}
        {count}
        dimmed={count === 0}
      >
        {#snippet leading()}
          {#if project.source === 'github'}
            <GitHubIcon size={12} class="shrink-0 text-muted-foreground" />
          {:else}
            <GitLabIcon size={12} class="shrink-0 text-muted-foreground" />
          {/if}
        {/snippet}
      </CheckRow>
    {/each}
    {#if hidden > 0}
      <button
        type="button"
        onclick={() => (showAll = true)}
        class="h-7 w-full rounded-md px-1.5 text-left text-xs font-medium text-accent-foreground"
      >
        +{hidden} more
      </button>
    {/if}
  </FilterField>
{/if}
