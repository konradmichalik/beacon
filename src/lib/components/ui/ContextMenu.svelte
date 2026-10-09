<script lang="ts">
  import { onMount } from 'svelte';
  import { focusTrap } from '$lib/actions/focusTrap';
  import { MENU_WIDTH, type MenuEntry } from '$lib/utils/context-menu';

  let {
    x,
    y,
    entries,
    onClose
  }: { x: number; y: number; entries: readonly MenuEntry[]; onClose: () => void } = $props();

  // Listeners start one frame late so the click or right-click that opened the
  // menu does not close it again.
  onMount(() => {
    const frame = requestAnimationFrame(() => {
      window.addEventListener('click', onClose);
      window.addEventListener('contextmenu', onClose);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('click', onClose);
      window.removeEventListener('contextmenu', onClose);
    };
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  role="menu"
  class="fixed z-50 rounded-[10px] border border-border bg-popover p-1 shadow-lg"
  style="left: {x}px; top: {y}px; width: {MENU_WIDTH}px;"
  use:focusTrap
>
  {#each entries as entry, i (i)}
    {#if entry === 'divider'}
      <div role="separator" class="mx-1.5 my-1 h-px bg-border"></div>
    {:else}
      <button
        type="button"
        role="menuitem"
        title={entry.title}
        onclick={() => {
          onClose();
          entry.onclick();
        }}
        class="flex h-7 w-full items-center justify-between gap-3 rounded-md px-2.5 text-left text-[12.5px] text-foreground transition-colors hover:bg-surface-hovered focus-visible:bg-surface-hovered focus-visible:outline-none"
      >
        <span class="truncate">{entry.label}</span>
        {#if entry.hint}
          <kbd
            class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border-strong px-1 font-sans text-[10.5px] text-subtlest"
          >
            {entry.hint}
          </kbd>
        {/if}
      </button>
    {/if}
  {/each}
</div>
