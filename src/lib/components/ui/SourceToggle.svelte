<script lang="ts">
  import { isServiceConnected } from '$lib/stores/connections.svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import type { NotificationSource } from '$lib/types';

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

  const btnBase = 'flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors';
  const btnActive = 'bg-primary text-primary-foreground';
  const btnInactive = 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground';

  const badgeBase = 'ml-0.5 rounded-full px-1 py-px text-[9px] font-semibold leading-tight';
  const badgeActive = 'bg-primary-foreground/20 text-primary-foreground';
  const badgeInactive = 'bg-secondary text-muted-foreground';
</script>

{#snippet badge(count: number, active: boolean)}
  {#if initialLoading}
    <span class="ml-0.5 inline-block h-3 w-5 animate-pulse rounded-full bg-secondary"></span>
  {:else if count > 0}
    <span class="{badgeBase} {active ? badgeActive : badgeInactive}">{count}</span>
  {/if}
{/snippet}

{#if bothConnected}
  <div class="flex shrink-0 overflow-hidden rounded-md border border-border bg-card" role="group">
    <button
      type="button"
      onclick={() => onSourceChange('all')}
      class="{btnBase} rounded-l-md {source === 'all' ? btnActive : btnInactive}"
    >
      All
      {@render badge(total, source === 'all')}
    </button>

    <button
      type="button"
      onclick={() => onSourceChange('github')}
      title="GitHub"
      class="{btnBase} border-l border-border {source === 'github' ? btnActive : btnInactive}"
    >
      <GitHubIcon size={12} />
      {@render badge(githubCount, source === 'github')}
    </button>

    <button
      type="button"
      onclick={() => onSourceChange('gitlab')}
      title="GitLab"
      class="{btnBase} rounded-r-md border-l border-border {source === 'gitlab'
        ? btnActive
        : btnInactive}"
    >
      <GitLabIcon size={12} />
      {@render badge(gitlabCount, source === 'gitlab')}
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
