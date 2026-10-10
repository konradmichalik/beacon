<script lang="ts">
  import type { UnifiedNotification } from '$lib/types';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import { addMuteRule, isNotificationMuted } from '$lib/stores/mute-rules.svelte';
  import { getNotifications } from '$lib/stores/notifications.svelte';
  import { countMuteMatches, type MuteCriteria } from '$lib/utils/mute-match';
  import { repoShortName } from '$lib/utils/repository';
  import { untrack } from 'svelte';
  import { ListFilter } from '@lucide/svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let { notification, onClose }: { notification: UnifiedNotification; onClose: () => void } =
    $props();

  let includeProject = $state(true);
  let includeType = $state(true);
  let includeStatus = $state(untrack(() => notification.subjectState !== null));
  let includeAuthor = $state(untrack(() => notification.author !== null));
  let hasStatus = $derived(notification.subjectState !== null);
  let hasAuthor = $derived(notification.author !== null);
  let canConfirm = $derived(
    includeProject || includeType || (includeStatus && hasStatus) || (includeAuthor && hasAuthor)
  );

  let statusLabel = $derived.by(() => {
    const s = notification.subjectState;
    if (s === 'merged') return 'Merged';
    if (s === 'closed') return 'Closed';
    if (s === 'open') return 'Open';
    return null;
  });

  let criteria = $derived<MuteCriteria>({
    ...(includeProject && { project: notification.repository }),
    ...(includeType && { type: notification.type }),
    ...(includeStatus && hasStatus && { status: notification.subjectState! }),
    ...(includeAuthor && hasAuthor && { author: notification.author!.login })
  });

  let matchCount = $derived(
    canConfirm
      ? countMuteMatches(
          criteria,
          getNotifications().filter((n) => n.unread && !isNotificationMuted(n))
        )
      : 0
  );

  async function handleConfirm(): Promise<void> {
    await addMuteRule(criteria);
    onClose();
  }

  const rowClass = 'flex h-8 items-center gap-2 border-b border-border text-[12.5px]';
  const valueClass =
    'max-w-[170px] truncate rounded-md bg-muted px-[7px] text-[11.5px] font-medium leading-5 text-muted-foreground';
</script>

<Dialog
  title="Mute notifications like this"
  subtitle="Hides notifications that match all selected criteria."
  {onClose}
>
  <fieldset class="m-0 border-0 px-4 py-0">
    <legend class="sr-only">Criteria</legend>

    <label class="{rowClass} cursor-pointer">
      <input
        type="checkbox"
        bind:checked={includeProject}
        class="h-3.5 w-3.5 rounded border-input accent-primary"
      />
      <span class="flex-1 text-foreground">Project</span>
      <span class={valueClass}>{repoShortName(notification.repository)}</span>
    </label>

    <label class="{rowClass} cursor-pointer">
      <input
        type="checkbox"
        bind:checked={includeType}
        class="h-3.5 w-3.5 rounded border-input accent-primary"
      />
      <span class="flex-1 text-foreground">Type</span>
      <span class={valueClass}
        >{NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}</span
      >
    </label>

    <label class="{rowClass} {hasStatus ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}">
      <input
        type="checkbox"
        bind:checked={includeStatus}
        disabled={!hasStatus}
        class="h-3.5 w-3.5 rounded border-input accent-primary"
      />
      <span class="flex-1 text-foreground">Status</span>
      {#if statusLabel}
        <span class={valueClass}>{statusLabel}</span>
      {:else}
        <span class="text-xs text-subtlest">Not available</span>
      {/if}
    </label>

    <label class="{rowClass} {hasAuthor ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}">
      <input
        type="checkbox"
        bind:checked={includeAuthor}
        disabled={!hasAuthor}
        class="h-3.5 w-3.5 rounded border-input accent-primary"
      />
      <span class="flex-1 text-foreground">Author</span>
      {#if notification.author}
        <span class={valueClass}>@{notification.author.login}</span>
      {:else}
        <span class="text-xs text-subtlest">Not available</span>
      {/if}
    </label>
  </fieldset>

  <p
    class="mx-4 mt-2.5 flex items-center gap-1.5 rounded-lg bg-brand-bg px-2.5 py-2 text-xs font-medium text-accent-foreground"
    aria-live="polite"
  >
    <ListFilter size={13} />
    {#if canConfirm}
      Matches {matchCount}
      {matchCount === 1 ? 'notification' : 'notifications'} in your inbox
    {:else}
      Select at least one criterion
    {/if}
  </p>

  {#snippet footer()}
    <Button onclick={onClose}>Cancel</Button>
    <Button variant="primary" onclick={handleConfirm} disabled={!canConfirm}>Mute</Button>
  {/snippet}
</Dialog>
