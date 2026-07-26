<script lang="ts">
  import type { NotificationSource, NotificationAuthor } from '$lib/types';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';

  let { author, source }: { author: NotificationAuthor | null; source: NotificationSource } =
    $props();

  const avatarColors = [
    '#bf616a',
    '#d08770',
    '#ebcb8b',
    '#a3be8c',
    '#88c0d0',
    '#5e81ac',
    '#b48ead'
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

<div class="group/avatar relative mt-0.5 flex-shrink-0">
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
      {#if source === 'github'}
        <GitHubIcon size={14} />
      {:else}
        <GitLabIcon size={14} />
      {/if}
    </div>
  {/if}
  {#if author}
    <span
      class="pointer-events-none absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/avatar:opacity-100"
    >
      {author.login}
    </span>
  {/if}
</div>
