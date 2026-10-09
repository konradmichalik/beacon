<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import { focusTrap } from '$lib/actions/focusTrap';
  import IconButton from './IconButton.svelte';

  let { onClose, children, footer }: { onClose: () => void; children: Snippet; footer?: Snippet } =
    $props();

  const titleId = $props.id();

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-40 bg-foreground/5" role="presentation" onclick={handleBackdropClick}>
  <div
    class="fixed right-2 top-[90px] z-50 flex max-h-[calc(100vh-100px)] w-[300px] flex-col rounded-xl border border-border bg-popover shadow-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    use:focusTrap
  >
    <div class="flex shrink-0 items-center justify-between py-2 pl-3.5 pr-2">
      <h2 id={titleId} class="text-[13px] font-semibold text-foreground">Filters</h2>
      <IconButton label="Close filters" onclick={onClose} class="h-6 min-w-6">
        <X size={13} />
      </IconButton>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto pt-1">
      {@render children()}
    </div>
    {#if footer}
      <div class="shrink-0 border-t border-border px-3.5 py-2">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
