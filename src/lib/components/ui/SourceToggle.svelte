<script lang="ts">
  import { bump } from '$lib/actions/bump';
  import CountSkeleton from './CountSkeleton.svelte';
  import { isServiceConnected } from '$lib/stores/connections.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import type { NotificationSource } from '$lib/types';
  import Segmented from './Segmented.svelte';

  type SourceOption = NotificationSource | 'all';

  let {
    source,
    total,
    githubCount,
    gitlabCount,
    initialLoading = false,
    onSourceChange
  }: {
    source: SourceOption;
    total: number;
    githubCount: number;
    gitlabCount: number;
    initialLoading?: boolean;
    onSourceChange: (source: SourceOption) => void;
  } = $props();

  let githubConnected = $derived(isServiceConnected('github'));
  let gitlabConnected = $derived(isServiceConnected('gitlab'));
  let bothConnected = $derived(githubConnected && gitlabConnected);

  let options = $derived([
    { value: 'all' as const, aria: `All, ${total}`, label: 'All', count: total },
    {
      value: 'github' as const,
      aria: `GitHub, ${githubCount}`,
      icon: GitHubIcon,
      count: githubCount
    },
    {
      value: 'gitlab' as const,
      aria: `GitLab, ${gitlabCount}`,
      icon: GitLabIcon,
      count: gitlabCount
    }
  ]);
</script>

{#if bothConnected}
  <Segmented
    {options}
    value={source}
    label="Source"
    loading={initialLoading}
    onChange={onSourceChange}
    class="shrink-0"
  />
{:else if githubConnected || gitlabConnected}
  <div
    class="flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-[11.5px] font-medium text-foreground"
    title={githubConnected ? 'GitHub' : 'GitLab'}
  >
    {#if githubConnected}
      <GitHubIcon size={12} />
      {#if initialLoading}
        <CountSkeleton />
      {:else}
        <span use:bump={githubCount} class="tabular-nums text-subtlest">{githubCount}</span>
      {/if}
    {:else}
      <GitLabIcon size={12} />
      {#if initialLoading}
        <CountSkeleton />
      {:else}
        <span use:bump={gitlabCount} class="tabular-nums text-subtlest">{gitlabCount}</span>
      {/if}
    {/if}
  </div>
{/if}
