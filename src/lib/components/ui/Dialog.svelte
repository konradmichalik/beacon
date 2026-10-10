<script lang="ts">
  import type { Snippet } from 'svelte';
  import { focusTrap } from '$lib/actions/focusTrap';

  let {
    title,
    subtitle,
    onClose,
    children,
    footer
  }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  const titleId = $props.id();

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-40 flex items-start justify-center pt-[92px]"
  style="background: var(--ds-blanket)"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="w-80 max-w-[calc(100%-32px)] rounded-xl border border-border bg-popover shadow-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    use:focusTrap
  >
    <div class="px-4 pb-2 pt-3.5">
      <h2 id={titleId} class="text-sm font-semibold text-foreground">{title}</h2>
      {#if subtitle}
        <p class="mt-0.5 truncate text-xs text-subtlest">{subtitle}</p>
      {/if}
    </div>
    {@render children()}
    {#if footer}
      <div class="flex items-center justify-end gap-2 px-3 pb-3 pt-1">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
