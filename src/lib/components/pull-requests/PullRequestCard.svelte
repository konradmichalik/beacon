<script lang="ts">
  import type { UnifiedPullRequest } from '$lib/types';
  import { timeAgo } from '$lib/utils/time';
  import { isTauri } from '$lib/utils/storage';
  import { clampMenuPosition } from '$lib/utils/context-menu';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import {
    CircleCheck,
    CircleX,
    Loader,
    ShieldCheck,
    PenLine,
    Eye,
    FileEdit,
    ExternalLink,
    ClipboardCopy,
    CircleCheckBig
  } from '@lucide/svelte';

  let { pullRequest }: { pullRequest: UnifiedPullRequest } = $props();

  let timeLabel = $derived(timeAgo(pullRequest.updatedAt));
  let repoShort = $derived(pullRequest.repository.split('/').slice(-2).join('/'));

  const avatarColors = [
    '#bf616a',
    '#d08770',
    '#ebcb8b',
    '#a3be8c',
    '#88c0d0',
    '#5e81ac',
    '#b48ead'
  ];
  let avatarFailed = $state(false);
  let avatarInitial = $derived(pullRequest.author?.login?.charAt(0).toUpperCase() ?? '');
  let avatarColor = $derived.by(() => {
    const name = pullRequest.author?.login ?? '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  });

  let isPending = $derived(pullRequest.enrichment === 'pending');
  let isSkipped = $derived(pullRequest.enrichment === 'skipped');

  let ciInfo = $derived.by(() => {
    if (isSkipped && pullRequest.ciStatus === 'unknown') return null;
    switch (pullRequest.ciStatus) {
      case 'success':
        return { label: 'CI passed', class: 'text-success-text', icon: CircleCheck };
      case 'failure':
        return { label: 'CI failed', class: 'text-destructive', icon: CircleX };
      case 'pending':
        return { label: 'CI running', class: 'text-warning', icon: Loader };
      default:
        return null;
    }
  });

  let reviewInfo = $derived.by(() => {
    if (isSkipped && !pullRequest.reviewDecision) return null;
    if (pullRequest.reviewRequestedFromMe) {
      if (pullRequest.enrichment !== 'enriched') {
        return null;
      }
      if (pullRequest.reviewedByMe) {
        return { label: 'Reviewed', class: 'text-success-text', icon: CircleCheckBig };
      }
      return { label: 'Pending your review', class: 'text-muted-foreground', icon: Eye };
    }
    switch (pullRequest.reviewDecision) {
      case 'approved':
        return { label: 'Approved', class: 'text-success-text', icon: ShieldCheck };
      case 'changes_requested':
        return { label: 'Changes', class: 'text-warning', icon: PenLine };
      case 'review_required':
        return { label: 'Review needed', class: 'text-muted-foreground', icon: Eye };
      default:
        return null;
    }
  });

  async function openUrl(): Promise<void> {
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(pullRequest.url);
    } else {
      window.open(pullRequest.url, '_blank');
    }
  }

  let contextMenu: { x: number; y: number } | null = $state(null);

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    contextMenu = clampMenuPosition(event, 70);

    function close() {
      contextMenu = null;
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    }
    requestAnimationFrame(() => {
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
    });
  }
</script>

<div class="border-b border-border/60">
  <button
    type="button"
    onclick={openUrl}
    oncontextmenu={handleContextMenu}
    class="group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 ease-in-out hover:bg-secondary/40"
  >
    <!-- Avatar -->
    <div class="group/avatar relative mt-0.5 flex-shrink-0">
      {#if pullRequest.author?.avatarUrl && !avatarFailed}
        <img
          src={pullRequest.author.avatarUrl}
          alt={pullRequest.author.login}
          class="h-8 w-8 rounded-full"
          onerror={() => (avatarFailed = true)}
        />
      {:else if pullRequest.author}
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style="background-color: {avatarColor}"
        >
          {avatarInitial}
        </div>
      {:else}
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          {#if pullRequest.source === 'github'}
            <GitHubIcon size={14} />
          {:else}
            <GitLabIcon size={14} />
          {/if}
        </div>
      {/if}
      {#if pullRequest.author}
        <span
          class="pointer-events-none absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/avatar:opacity-100"
        >
          {pullRequest.author.login}
        </span>
      {/if}
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Row 1: Source icon + repo -->
      <div class="flex items-center gap-1.5">
        {#if pullRequest.source === 'github'}
          <GitHubIcon size={11} class="flex-shrink-0 text-muted-foreground/70" />
        {:else}
          <GitLabIcon size={11} class="flex-shrink-0 text-muted-foreground/70" />
        {/if}
        <span class="truncate text-[11px] text-muted-foreground">{repoShort}</span>
      </div>

      <!-- Row 2: Title -->
      <p class="mt-0.5 truncate text-[13px] font-medium leading-snug text-foreground">
        {pullRequest.title}
      </p>

      <!-- Row 3: PR number + CI + Review + Draft + Time -->
      <div class="mt-1 flex items-center gap-1.5">
        <span
          class="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          #{pullRequest.number}
        </span>

        {#if pullRequest.draft}
          <span
            class="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <FileEdit size={9} />
            Draft
          </span>
        {/if}

        {#if isPending && pullRequest.source === 'github'}
          <span class="h-2.5 w-12 animate-pulse rounded-full bg-muted-foreground/15"></span>
        {:else if ciInfo}
          {@const CIIcon = ciInfo.icon}
          <span class="flex shrink-0 items-center gap-0.5 text-[10px] font-medium {ciInfo.class}">
            <CIIcon size={10} />
            {ciInfo.label}
          </span>
        {/if}

        {#if isPending && pullRequest.reviewRequestedFromMe}
          <span class="h-2.5 w-14 animate-pulse rounded-full bg-muted-foreground/15"></span>
        {:else if reviewInfo}
          {@const ReviewIcon = reviewInfo.icon}
          <span
            class="flex shrink-0 items-center gap-0.5 text-[10px] font-medium {reviewInfo.class}"
          >
            <ReviewIcon size={9} />
            {reviewInfo.label}
          </span>
        {/if}

        <span class="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeLabel}</span>
      </div>
    </div>
  </button>
</div>

{#if contextMenu}
  <div
    class="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover py-1 shadow-lg"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
  >
    <button
      type="button"
      onclick={() => {
        contextMenu = null;
        openUrl();
      }}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <ExternalLink size={12} />
      Open
    </button>
    <button
      type="button"
      onclick={() => {
        contextMenu = null;
        navigator.clipboard.writeText(pullRequest.url);
      }}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <ClipboardCopy size={12} />
      Copy link
    </button>
  </div>
{/if}
