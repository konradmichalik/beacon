<script lang="ts">
  import type { UnifiedPullRequest } from '$lib/types';
  import { timeAgo } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import { clampMenuPosition, menuPositionFromElement } from '$lib/utils/context-menu';
  import { focusTrap } from '$lib/actions/focusTrap';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
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
    CircleCheckBig,
    Star,
    GitBranch
  } from '@lucide/svelte';
  import { isStarred, toggleStar } from '$lib/stores/starred-prs.svelte';
  import { getAttentionState, type AttentionState } from '$lib/utils/pr-attention';

  let { pullRequest }: { pullRequest: UnifiedPullRequest } = $props();

  const ATTENTION_LABELS: Record<Exclude<AttentionState, 'none'>, string> = {
    blocked: 'Changes requested',
    failing: 'CI failing',
    ready: 'Ready to merge',
    stale: 'Stale — no activity in a while'
  };
  const ATTENTION_DOT_CLASS: Record<Exclude<AttentionState, 'none'>, string> = {
    blocked: 'bg-warning',
    failing: 'bg-destructive',
    ready: 'bg-success-text',
    stale: 'bg-muted-foreground'
  };

  let attentionState = $derived(getAttentionState(pullRequest));

  let timeLabel = $derived(timeAgo(pullRequest.updatedAt));
  let repoShort = $derived(pullRequest.repository.split('/').slice(-2).join('/'));

  let isPending = $derived(pullRequest.enrichment === 'pending');
  let isSkipped = $derived(pullRequest.enrichment === 'skipped');

  let showBaseBranch = $derived(
    pullRequest.baseBranch != null &&
      pullRequest.baseBranch !== 'main' &&
      pullRequest.baseBranch !== 'master'
  );

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
      return { label: 'Pending your review', class: 'text-warning', icon: Eye };
    }
    switch (pullRequest.reviewDecision) {
      case 'approved':
        return { label: 'Approved', class: 'text-success-text', icon: ShieldCheck };
      case 'changes_requested':
        return { label: 'Changes', class: 'text-warning', icon: PenLine };
      case 'review_required':
        return { label: 'Review needed', class: 'text-warning', icon: Eye };
      default:
        return null;
    }
  });

  async function openUrl(): Promise<void> {
    await openExternalUrl(pullRequest.url);
  }

  async function openFailingCheck(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (pullRequest.failingCheck) {
      await openExternalUrl(pullRequest.failingCheck.url);
    }
  }

  let starred = $derived(isStarred(pullRequest.id));
  let contextMenu: { x: number; y: number } | null = $state(null);

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    contextMenu = clampMenuPosition(event, { width: 160, height: 105 });

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

  function handleCardKeydown(e: KeyboardEvent): void {
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      contextMenu = menuPositionFromElement(rect, { width: 160, height: 105 });
      function close() {
        contextMenu = null;
        window.removeEventListener('click', close);
        window.removeEventListener('contextmenu', close);
      }
      requestAnimationFrame(() => {
        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openUrl();
    } else if (e.key === 's') {
      e.preventDefault();
      toggleStar(pullRequest.id);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-roving-item
  tabindex="-1"
  onkeydown={handleCardKeydown}
  class="border-b border-border/60 outline-none focus:bg-surface-hovered focus:shadow-[inset_3px_0_0_var(--ds-border-focused)]"
>
  <!-- Not focusable (tabindex=-1) — the outer roving container's onkeydown handles Enter -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    role="button"
    tabindex={-1}
    onclick={openUrl}
    oncontextmenu={handleContextMenu}
    class="group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 ease-in-out hover:bg-surface-hovered"
  >
    <!-- Attention indicator -->
    {#if attentionState !== 'none'}
      <span
        title={ATTENTION_LABELS[attentionState]}
        class="absolute right-2 top-2 h-1.5 w-1.5 rounded-full {ATTENTION_DOT_CLASS[
          attentionState
        ]}"
      ></span>
    {/if}

    <!-- Avatar -->
    <Avatar author={pullRequest.author} source={pullRequest.source} />

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
          class="shrink-0 rounded bg-accent-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
        >
          #{pullRequest.number}
        </span>

        {#if showBaseBranch}
          <span
            class="flex shrink-0 items-center gap-0.5 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title="Target: {pullRequest.baseBranch}"
          >
            <GitBranch size={9} class="shrink-0" />
            <span class="max-w-[80px] truncate">{pullRequest.baseBranch}</span>
          </span>
        {/if}

        {#if pullRequest.draft}
          <span
            title="Draft — work in progress"
            class="flex shrink-0 items-center gap-0.5 rounded border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
          >
            <FileEdit size={9} class="shrink-0" />
            Draft
          </span>
        {/if}

        {#if isPending && pullRequest.source === 'github'}
          <span class="h-2.5 w-12 animate-pulse rounded-full bg-muted-foreground/15"></span>
        {:else if ciInfo}
          {@const CIIcon = ciInfo.icon}
          <span class="flex shrink-0 items-center gap-0.5 text-[10px] font-medium {ciInfo.class}">
            <CIIcon size={10} />
            {#if pullRequest.ciStatus === 'failure' && pullRequest.failingCheck}
              <button
                type="button"
                onclick={openFailingCheck}
                title="Open {pullRequest.failingCheck.name}"
                class="max-w-[110px] truncate underline decoration-dotted underline-offset-2 hover:text-destructive"
              >
                {pullRequest.failingCheck.name}
              </button>
            {:else}
              {ciInfo.label}
            {/if}
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

        {#if starred}
          <Star size={10} class="shrink-0 fill-warning text-warning" />
        {/if}
        <span class="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeLabel}</span>
      </div>
    </div>
  </div>
</div>

{#if contextMenu}
  <div
    class="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover py-1 shadow-lg"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    use:focusTrap
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
    <div class="mx-2 my-0.5 border-t border-border/60"></div>
    <button
      type="button"
      onclick={() => {
        contextMenu = null;
        toggleStar(pullRequest.id);
      }}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <Star size={12} class={starred ? 'fill-warning text-warning' : ''} />
      {starred ? 'Unstar' : 'Star'}
    </button>
  </div>
{/if}
