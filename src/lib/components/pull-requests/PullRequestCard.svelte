<script lang="ts">
  import type { UnifiedPullRequest } from '$lib/types';
  import { timeShort } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import {
    clampMenuPosition,
    menuPositionFromElement,
    menuSize,
    type MenuEntry
  } from '$lib/utils/context-menu';
  import ListRow from '$lib/components/ui/ListRow.svelte';
  import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
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

  let menuEntries = $derived<MenuEntry[]>([
    { label: 'Open', hint: '↵', onclick: openUrl },
    { label: 'Copy link', onclick: () => navigator.clipboard.writeText(pullRequest.url) },
    'divider',
    { label: starred ? 'Unstar' : 'Star', hint: 'S', onclick: () => toggleStar(pullRequest.id) }
  ]);

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    contextMenu = clampMenuPosition(event, menuSize(menuEntries));
  }

  function handleCardKeydown(e: KeyboardEvent): void {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      contextMenu = menuPositionFromElement(rect, menuSize(menuEntries));
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
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    entries={menuEntries}
    onClose={() => (contextMenu = null)}
  />
{/if}
