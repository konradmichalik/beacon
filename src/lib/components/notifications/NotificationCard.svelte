<script lang="ts">
  import type { UnifiedNotification } from '$lib/types';
  import {
    markAsRead,
    markAsDone,
    markAllAsRead,
    getLastSeenAt,
    getUnreadIdsByAuthor,
    unsubscribeFromNotification
  } from '$lib/stores/notifications.svelte';
  import { snoozeNotification } from '$lib/stores/snooze.svelte';
  import { timeShort } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import { clampMenuPosition, menuPositionFromElement } from '$lib/utils/context-menu';
  import { parseGitLabTargetUrl } from '$lib/utils/gitlab-target';
  import { isSyntheticNotification } from '$lib/utils/synthetic-notifications';
  import { getGitLabConfig } from '$lib/stores/connections.svelte';
  import { focusTrap } from '$lib/actions/focusTrap';
  import ListRow from '$lib/components/ui/ListRow.svelte';
  import { notificationChips, repoShortName } from '$lib/utils/row-chips';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import {
    ExternalLink,
    CheckCheck,
    ClipboardCopy,
    BellOff,
    BellMinus,
    Archive,
    AlarmClock
  } from '@lucide/svelte';
  import MuteModal from './MuteModal.svelte';
  import SnoozeModal from './SnoozeModal.svelte';

  let { notification }: { notification: UnifiedNotification } = $props();

  let dismissing = $state(false);
  let timeLabel = $derived(timeShort(notification.updatedAt));
  let repoLine = $derived(
    `${repoShortName(notification.repository)} · ${NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}`
  );
  let chips = $derived(notificationChips(notification));

  let isNew = $derived.by(() => {
    const seen = getLastSeenAt();
    if (!seen) return false;
    return notification.unread && notification.updatedAt > seen;
  });

  async function openUrl(): Promise<void> {
    await openExternalUrl(notification.url);
  }

  function handleClick(event?: MouseEvent): void {
    if (dismissing) return;
    openUrl();
    if (notification.unread && !event?.altKey) {
      dismissing = true;
      setTimeout(() => markAsRead(notification.id), 350);
    }
  }

  let contextMenu: { x: number; y: number } | null = $state(null);
  let showMuteModal = $state(false);
  let showSnoozeModal = $state(false);

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    contextMenu = clampMenuPosition(event, { width: 240, height: 254 });

    function close() {
      contextMenu = null;
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    }
    // Close on next click or right-click anywhere
    requestAnimationFrame(() => {
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
    });
  }

  function closeContextMenu(action: () => void): void {
    contextMenu = null;
    action();
  }

  function handleContextOpen(): void {
    closeContextMenu(() => handleClick());
  }

  function handleContextCopyLink(): void {
    closeContextMenu(() => navigator.clipboard.writeText(notification.url));
  }

  function handleContextMarkRead(): void {
    closeContextMenu(() => {
      if (!notification.unread) return;
      dismissing = true;
      setTimeout(() => markAsRead(notification.id), 350);
    });
  }

  function handleContextMute(): void {
    closeContextMenu(() => (showMuteModal = true));
  }

  function handleContextSnooze(): void {
    closeContextMenu(() => (showSnoozeModal = true));
  }

  function handleSnoozeShortcut(): void {
    dismissing = true;
    setTimeout(() => snoozeNotification(notification, 'tomorrow', true), 350);
  }

  // GitHub threads can always be unsubscribed from. GitLab todos need an iid
  // parsed out of the target URL, which only works for merge requests and
  // issues — pipelines and other target types have no unsubscribe endpoint.
  // Synthetic entries have no server-side thread — GitHub/GitLab never
  // sent this notification, so there is nothing to unsubscribe from or
  // mark done there.
  let canUnsubscribe = $derived(
    !isSyntheticNotification(notification) &&
      (notification.source === 'github' ||
        (notification.source === 'gitlab' &&
          parseGitLabTargetUrl(notification.url, getGitLabConfig()?.baseUrl ?? '') !== null))
  );

  function handleContextUnsubscribe(): void {
    closeContextMenu(() => {
      unsubscribeFromNotification(notification.id);
    });
  }

  function handleContextMarkDone(): void {
    closeContextMenu(() => {
      dismissing = true;
      setTimeout(() => markAsDone(notification.id), 350);
    });
  }

  let unreadIdsByAuthor = $derived.by(() => {
    const login = notification.author?.login;
    if (!login) return null;
    const ids = getUnreadIdsByAuthor(login, notification.source);
    return ids.size > 1 ? ids : null;
  });

  function handleContextMarkAllByAuthor(): void {
    closeContextMenu(() => {
      if (!unreadIdsByAuthor) return;
      markAllAsRead(unreadIdsByAuthor);
    });
  }

  function handleCardKeydown(e: KeyboardEvent): void {
    if (e.key === 'F10' && e.shiftKey) {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      contextMenu = menuPositionFromElement(rect, { width: 240, height: 254 });
      function close() {
        contextMenu = null;
        window.removeEventListener('click', close);
        window.removeEventListener('contextmenu', close);
      }
      requestAnimationFrame(() => {
        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    } else if (e.key === 'm' && notification.unread) {
      e.preventDefault();
      dismissing = true;
      setTimeout(() => markAsRead(notification.id), 350);
    } else if (e.key === 'z') {
      e.preventDefault();
      handleSnoozeShortcut();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  data-roving-item
  tabindex="-1"
  onkeydown={handleCardKeydown}
  class="overflow-hidden outline-none transition-all duration-300 ease-in-out focus:bg-surface-hovered focus:shadow-[inset_3px_0_0_var(--ds-border-focused)] {dismissing
    ? 'max-h-0 border-b-0'
    : 'max-h-40 border-b border-border'}"
  style={dismissing ? 'margin-top: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0;' : ''}
>
  <button
    type="button"
    tabindex={-1}
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    class="group relative block w-full text-left transition-all duration-200 ease-in-out hover:bg-surface-hovered {dismissing
      ? 'translate-x-full opacity-0'
      : 'translate-x-0 opacity-100'}"
  >
    <ListRow
      author={notification.author}
      source={notification.source}
      {repoLine}
      title={notification.title}
      time={timeLabel}
      weight={notification.unread ? 'semibold' : 'normal'}
      {isNew}
      {chips}
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
      onclick={handleContextOpen}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <ExternalLink size={12} />
      Open
    </button>
    <button
      type="button"
      onclick={handleContextCopyLink}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <ClipboardCopy size={12} />
      Copy link
    </button>
    <button
      type="button"
      onclick={handleContextMute}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <BellOff size={12} />
      Mute…
    </button>
    <button
      type="button"
      onclick={handleContextSnooze}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
    >
      <AlarmClock size={12} />
      Snooze…
    </button>
    {#if canUnsubscribe}
      <button
        type="button"
        onclick={handleContextUnsubscribe}
        title="Tells GitHub/GitLab to stop notifying you about this thread — unlike Mute, this is not just hidden locally"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
      >
        <BellMinus size={12} />
        Unsubscribe
      </button>
    {/if}
    <div class="mx-2 my-0.5 border-t border-border"></div>
    {#if notification.unread}
      <button
        type="button"
        onclick={handleContextMarkRead}
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
      >
        <CheckCheck size={12} />
        Mark as read
      </button>
    {/if}
    {#if unreadIdsByAuthor && notification.author}
      <button
        type="button"
        onclick={handleContextMarkAllByAuthor}
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
      >
        <CheckCheck size={12} />
        Mark all from @{notification.author.login} as read ({unreadIdsByAuthor.size})
      </button>
    {/if}
    {#if notification.source === 'github' && !isSyntheticNotification(notification)}
      <button
        type="button"
        onclick={handleContextMarkDone}
        title="Removes the thread from your GitHub notification inbox — cannot be undone"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
      >
        <Archive size={12} />
        Mark as done
      </button>
    {/if}
  </div>
{/if}

{#if showMuteModal}
  <MuteModal {notification} onClose={() => (showMuteModal = false)} />
{/if}

{#if showSnoozeModal}
  <SnoozeModal {notification} onClose={() => (showSnoozeModal = false)} />
{/if}
