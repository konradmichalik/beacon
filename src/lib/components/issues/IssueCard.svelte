<script lang="ts">
  import type { UnifiedIssue } from '$lib/types';
  import { timeShort } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import { clampMenuPosition, menuPositionFromElement } from '$lib/utils/context-menu';
  import { focusTrap } from '$lib/actions/focusTrap';
  import ListRow from '$lib/components/ui/ListRow.svelte';
  import { ExternalLink, ClipboardCopy } from '@lucide/svelte';
  import { issueRow, repoShortName } from '$lib/utils/row-chips';

  let { issue }: { issue: UnifiedIssue } = $props();

  let timeLabel = $derived(timeShort(issue.updatedAt));
  let repoLine = $derived(`${repoShortName(issue.repository)} · #${issue.number}`);
  let row = $derived(issueRow(issue));

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
  class="border-b border-border outline-none focus:bg-surface-hovered focus:shadow-[inset_3px_0_0_var(--ds-border-focused)]"
>
  <button
    type="button"
    tabindex={-1}
    onclick={openUrl}
    oncontextmenu={handleContextMenu}
    class="group relative block w-full text-left transition-all duration-200 ease-in-out hover:bg-surface-hovered"
  >
    <ListRow
      author={issue.author}
      source={issue.source}
      {repoLine}
      title={issue.title}
      time={timeLabel}
      metas={row.metas}
      labels={row.labels}
      extraLabels={row.extraLabels}
    />
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
