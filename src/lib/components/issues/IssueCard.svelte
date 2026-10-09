<script lang="ts">
  import type { UnifiedIssue } from '$lib/types';
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
  import { issueRow } from '$lib/utils/row-chips';
  import { repoShortName } from '$lib/utils/repository';

  let { issue }: { issue: UnifiedIssue } = $props();

  let timeLabel = $derived(timeShort(issue.updatedAt));
  let repoLine = $derived(`${repoShortName(issue.repository)} · #${issue.number}`);
  let row = $derived(issueRow(issue));

  async function openUrl(): Promise<void> {
    await openExternalUrl(issue.url);
  }

  let contextMenu: { x: number; y: number } | null = $state(null);

  const menuEntries: MenuEntry[] = [
    { label: 'Open', hint: '↵', onclick: openUrl },
    { label: 'Copy link', onclick: () => navigator.clipboard.writeText(issue.url) }
  ];

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    contextMenu = clampMenuPosition(event, menuSize(menuEntries));
  }

  function handleCardKeydown(e: KeyboardEvent): void {
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      contextMenu = menuPositionFromElement(rect, menuSize(menuEntries));
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
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    entries={menuEntries}
    onClose={() => (contextMenu = null)}
  />
{/if}
