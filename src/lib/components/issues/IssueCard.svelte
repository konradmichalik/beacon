<script lang="ts">
  import type { UnifiedIssue } from '$lib/types';
  import { timeAgo } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import { clampMenuPosition, menuPositionFromElement } from '$lib/utils/context-menu';
  import { focusTrap } from '$lib/actions/focusTrap';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { ExternalLink, ClipboardCopy, MessageSquare, Tag } from '@lucide/svelte';

  let { issue }: { issue: UnifiedIssue } = $props();

  let timeLabel = $derived(timeAgo(issue.updatedAt));
  let repoShort = $derived(issue.repository.split('/').slice(-2).join('/'));

  // Show at most two labels inline to keep the row compact.
  let visibleLabels = $derived(issue.labels.slice(0, 2));
  let extraLabels = $derived(issue.labels.length - visibleLabels.length);

  async function openUrl(): Promise<void> {
    await openExternalUrl(issue.url);
  }

  let contextMenu: { x: number; y: number } | null = $state(null);

  function openContextMenu(position: { x: number; y: number }): void {
    contextMenu = position;
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

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    openContextMenu(clampMenuPosition(event, { width: 160, height: 70 }));
  }

  function handleCardKeydown(e: KeyboardEvent): void {
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openContextMenu(menuPositionFromElement(rect, { width: 160, height: 70 }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openUrl();
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
  <button
    type="button"
    tabindex={-1}
    onclick={openUrl}
    oncontextmenu={handleContextMenu}
    class="group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 ease-in-out hover:bg-surface-hovered"
  >
    <!-- Avatar -->
    <Avatar author={issue.author} source={issue.source} />

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Row 1: Source icon + repo -->
      <div class="flex items-center gap-1.5">
        {#if issue.source === 'github'}
          <GitHubIcon size={11} class="flex-shrink-0 text-muted-foreground/70" />
        {:else}
          <GitLabIcon size={11} class="flex-shrink-0 text-muted-foreground/70" />
        {/if}
        <span class="truncate text-[11px] text-muted-foreground">{repoShort}</span>
      </div>

      <!-- Row 2: Title -->
      <p class="mt-0.5 truncate text-[13px] font-medium leading-snug text-foreground">
        {issue.title}
      </p>

      <!-- Row 3: Issue number + labels + comments + Time -->
      <div class="mt-1 flex items-center gap-1.5">
        <span
          class="shrink-0 rounded bg-accent-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
        >
          #{issue.number}
        </span>

        {#each visibleLabels as label (label)}
          <span
            class="flex shrink-0 items-center gap-0.5 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={label}
          >
            <Tag size={9} class="shrink-0" />
            <span class="max-w-[90px] truncate">{label}</span>
          </span>
        {/each}
        {#if extraLabels > 0}
          <span class="shrink-0 text-[10px] font-medium text-muted-foreground">+{extraLabels}</span>
        {/if}

        {#if issue.commentsCount != null && issue.commentsCount > 0}
          <span
            class="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground"
            title="{issue.commentsCount} comments"
          >
            <MessageSquare size={9} class="shrink-0" />
            {issue.commentsCount}
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
        navigator.clipboard.writeText(issue.url);
      }}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <ClipboardCopy size={12} />
      Copy link
    </button>
  </div>
{/if}
