<script lang="ts">
  import type { UnifiedNotification } from '$lib/types';
  import { snoozeNotification } from '$lib/stores/snooze.svelte';
  import { SNOOZE_PRESET_LABELS, type SnoozePreset } from '$lib/utils/snooze';
  import { X } from '@lucide/svelte';
  import { focusTrap } from '$lib/actions/focusTrap';

  let { notification, onClose }: { notification: UnifiedNotification; onClose: () => void } =
    $props();

  let wakeOnUpdate = $state(true);

  const presets: SnoozePreset[] = ['1h', 'tomorrow', 'monday'];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handlePreset(preset: SnoozePreset): void {
    snoozeNotification(notification, preset, wakeOnUpdate);
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-[2px]"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="z-50 w-72 rounded-lg border border-border bg-card shadow-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby="snooze-modal-title"
    use:focusTrap
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between rounded-t-lg border-b border-border bg-secondary/40 px-3 py-2"
    >
      <span id="snooze-modal-title" class="text-[11px] font-semibold text-foreground"
        >Snooze notification</span
      >
      <button
        type="button"
        onclick={onClose}
        aria-label="Close snooze dialog"
        class="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={12} />
      </button>
    </div>

    <div class="space-y-2 p-3">
      <p class="text-[10px] text-muted-foreground">Hide this until —</p>

      {#each presets as preset (preset)}
        <button
          type="button"
          onclick={() => handlePreset(preset)}
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-secondary"
        >
          {SNOOZE_PRESET_LABELS[preset]}
        </button>
      {/each}

      <label
        class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 pt-2 hover:bg-secondary"
      >
        <input
          type="checkbox"
          bind:checked={wakeOnUpdate}
          class="h-3 w-3 rounded border-border accent-primary"
        />
        <span class="text-[11px] text-muted-foreground"
          >Wake on new activity (can't tell what changed, only that it did)</span
        >
      </label>
    </div>
  </div>
</div>
