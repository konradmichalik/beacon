<script lang="ts">
  import type { UnifiedNotification, MuteRule } from '$lib/types';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import { addMuteRule } from '$lib/stores/mute-rules.svelte';
  import { X } from '@lucide/svelte';
  import { focusTrap } from '$lib/actions/focusTrap';

  let { notification, onClose }: { notification: UnifiedNotification; onClose: () => void } =
    $props();

  let includeProject = $state(true);
  let includeType = $state(true);
  const initialHasStatus = notification.subjectState !== null;
  let includeStatus = $state(initialHasStatus);

  let hasStatus = $derived(notification.subjectState !== null);
  let canConfirm = $derived(includeProject || includeType || (includeStatus && hasStatus));

  let statusLabel = $derived.by(() => {
    const s = notification.subjectState;
    if (s === 'merged') return 'Merged';
    if (s === 'closed') return 'Closed';
    if (s === 'open') return 'Open';
    return null;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleConfirm() {
    const rule: Omit<MuteRule, 'id' | 'createdAt'> = {
      ...(includeProject && { project: notification.repository }),
      ...(includeType && { type: notification.type }),
      ...(includeStatus && hasStatus && { status: notification.subjectState! })
    };
    await addMuteRule(rule);
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-[2px]"
  onclick={handleBackdropClick}
>
  <div
    class="z-50 w-72 rounded-lg border border-border bg-card shadow-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mute-modal-title"
    use:focusTrap
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between rounded-t-lg border-b border-border bg-secondary/40 px-3 py-2"
    >
      <span id="mute-modal-title" class="text-[11px] font-semibold text-foreground"
        >Mute notifications</span
      >
      <button
        type="button"
        onclick={onClose}
        aria-label="Close mute dialog"
        class="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={12} />
      </button>
    </div>

    <div class="space-y-2 p-3">
      <p class="text-[10px] text-muted-foreground">
        Select which dimensions to match. Notifications matching all selected criteria will be
        hidden.
      </p>

      <!-- Project -->
      <label
        class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 hover:bg-secondary"
      >
        <input
          type="checkbox"
          bind:checked={includeProject}
          class="h-3 w-3 rounded border-border accent-primary"
        />
        <span class="text-[11px] text-muted-foreground">Project</span>
        <span
          class="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {notification.repository.split('/').slice(-2).join('/')}
        </span>
      </label>

      <!-- Type -->
      <label
        class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 hover:bg-secondary"
      >
        <input
          type="checkbox"
          bind:checked={includeType}
          class="h-3 w-3 rounded border-border accent-primary"
        />
        <span class="text-[11px] text-muted-foreground">Type</span>
        <span
          class="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}
        </span>
      </label>

      <!-- Status -->
      <label
        class="flex items-center gap-2 rounded px-1.5 py-1.5 {hasStatus
          ? 'cursor-pointer hover:bg-secondary'
          : 'cursor-not-allowed opacity-40'}"
      >
        <input
          type="checkbox"
          bind:checked={includeStatus}
          disabled={!hasStatus}
          class="h-3 w-3 rounded border-border accent-primary"
        />
        <span class="text-[11px] text-muted-foreground">Status</span>
        {#if statusLabel}
          <span
            class="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {statusLabel}
          </span>
        {:else}
          <span class="ml-auto text-[10px] italic text-muted-foreground">n/a</span>
        {/if}
      </label>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
      <button
        type="button"
        onclick={onClose}
        class="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!canConfirm}
        class="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        Mute
      </button>
    </div>
  </div>
</div>
