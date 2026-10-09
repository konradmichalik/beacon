<script lang="ts">
  import type { UnifiedNotification } from '$lib/types';
  import { snoozeNotification } from '$lib/stores/snooze.svelte';
  import { SNOOZE_PRESET_NAMES, presetTimeLabel, type SnoozePreset } from '$lib/utils/snooze';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let { notification, onClose }: { notification: UnifiedNotification; onClose: () => void } =
    $props();

  let wakeOnUpdate = $state(true);

  const presets: SnoozePreset[] = ['1h', 'tomorrow', 'monday'];

  function handleKeydown(e: KeyboardEvent): void {
    const preset = presets[Number(e.key) - 1];
    if (preset && !e.metaKey && !e.ctrlKey && !e.altKey) handlePreset(preset);
  }

  function handlePreset(preset: SnoozePreset): void {
    snoozeNotification(notification, preset, wakeOnUpdate);
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<Dialog title="Snooze until" subtitle={notification.title} {onClose}>
  <div class="flex flex-col gap-0.5 px-2">
    {#each presets as preset, i (preset)}
      <button
        type="button"
        onclick={() => handlePreset(preset)}
        class="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] text-foreground transition-colors hover:bg-surface-hovered"
      >
        <span class="flex-1">{SNOOZE_PRESET_NAMES[preset]}</span>
        <span class="text-xs tabular-nums text-subtlest">{presetTimeLabel(preset)}</span>
        <kbd
          class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border-strong px-1 font-sans text-[10.5px] text-subtlest"
        >
          {i + 1}
        </kbd>
      </button>
    {/each}
  </div>

  <label
    class="mx-4 mt-2 flex cursor-pointer items-start gap-2 border-t border-border pb-3 pt-2.5 text-[12.5px] leading-[17px] text-foreground"
  >
    <input
      type="checkbox"
      bind:checked={wakeOnUpdate}
      class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input accent-primary"
    />
    <span>
      Wake early on new activity
      <span class="block text-xs text-subtlest">Beacon sees that something changed, not what.</span>
    </span>
  </label>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="h-7 rounded-lg border border-border-strong bg-card px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-hovered"
    >
      Cancel
    </button>
  {/snippet}
</Dialog>
