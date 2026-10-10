<script lang="ts">
  import type { UnifiedPullRequest } from '$lib/types';
  import { timeShort } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import { clampMenuPosition, menuPositionFromElement } from '$lib/utils/context-menu';
  import { focusTrap } from '$lib/actions/focusTrap';
  import ListRow from '$lib/components/ui/ListRow.svelte';
  import { ExternalLink, ClipboardCopy, Star } from '@lucide/svelte';
  import { isStarred, toggleStar } from '$lib/stores/starred-prs.svelte';
  import { pullRequestChips, pullRequestRef, repoShortName } from '$lib/utils/row-chips';

  let { pullRequest }: { pullRequest: UnifiedPullRequest } = $props();

  let timeLabel = $derived(timeShort(pullRequest.updatedAt));
  let repoLine = $derived(
    `${repoShortName(pullRequest.repository)} · ${pullRequestRef(pullRequest.source, pullRequest.number)}`
  );
  let row = $derived(pullRequestChips(pullRequest));

  async function openUrl(): Promise<void> {
    await openExternalUrl(pullRequest.url);
  }

  async function openFailingCheck(_chip: unknown, event: MouseEvent): Promise<void> {
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
    if (e.target !== e.currentTarget) return;
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
  onclick={openUrl}
  oncontextmenu={handleContextMenu}
  class="border-b border-border outline-none focus:bg-surface-hovered focus:shadow-[inset_3px_0_0_var(--ds-border-focused)]"
>
  <div class="group relative transition-all duration-200 ease-in-out hover:bg-surface-hovered">
    <ListRow
      author={pullRequest.author}
      source={pullRequest.source}
      {repoLine}
      title={pullRequest.title}
      time={timeLabel}
      {starred}
      chips={row.chips}
      metas={row.metas}
      pending={row.pending}
      onChipClick={openFailingCheck}
    />
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
    <div class="mx-2 my-0.5 border-t border-border"></div>
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
