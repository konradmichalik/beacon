<script lang="ts">
  import type { NotificationSource, NotificationAuthor } from '$lib/types';
  import { User } from '@lucide/svelte';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';

  let { author, source }: { author: NotificationAuthor | null; source: NotificationSource } =
    $props();

  // Dark tones only: white initials reach 4.5:1 on all of them.
  const avatarColors = [
    '#4a6a91',
    '#4a6e35',
    '#7f5a79',
    '#9a5236',
    '#a3434d',
    '#5c6578',
    '#3f6f78'
  ];

  let failed = $state(false);
  let initial = $derived(author?.login?.charAt(0).toUpperCase() ?? '');
  let color = $derived.by(() => {
    const name = author?.login ?? '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  });
</script>

<div class="group/avatar relative h-8 w-8 flex-shrink-0">
  {#if author?.avatarUrl && !failed}
    <img
      src={author.avatarUrl}
      alt={author.login}
      class="h-8 w-8 rounded-full"
      onerror={() => (failed = true)}
    />
  {:else if author}
    <div
      class="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white"
      style="background-color: {color}"
    >
      {initial}
    </div>
  {:else}
    <div
      class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground"
    >
      <User size={15} />
    </div>
  {/if}
  <span
    title={source === 'github' ? 'GitHub' : 'GitLab'}
    class="absolute -bottom-1 -right-1 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-card text-muted-foreground ring-2 ring-background"
  >
    {#if source === 'github'}
      <GitHubIcon size={10} />
    {:else}
      <GitLabIcon size={10} />
    {/if}
  </span>
  {#if author}
    <span
      class="pointer-events-none absolute -bottom-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/avatar:opacity-100"
    >
      {author.login}
    </span>
  {/if}
</div>
