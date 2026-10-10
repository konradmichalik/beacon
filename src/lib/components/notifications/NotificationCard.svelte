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
  import {
    clampMenuPosition,
    menuPositionFromElement,
    menuSize,
    type MenuEntry
  } from '$lib/utils/context-menu';
  import { parseGitLabTargetUrl } from '$lib/utils/gitlab-target';
  import { isSyntheticNotification } from '$lib/utils/synthetic-notifications';
  import { getGitLabConfig } from '$lib/stores/connections.svelte';
  import ListRow from '$lib/components/ui/ListRow.svelte';
  import { notificationChips } from '$lib/utils/row-chips';
  import { repoShortName } from '$lib/utils/repository';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
  import MuteModal from './MuteModal.svelte';
  import SnoozeModal from './SnoozeModal.svelte';

  let { notification }: { notification: UnifiedNotification } = $props();

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
    openUrl();
    if (notification.unread && !event?.altKey) markAsRead(notification.id);
  }

  let contextMenu: { x: number; y: number } | null = $state(null);
  let showMuteModal = $state(false);
  let showSnoozeModal = $state(false);

  function markReadNow(): void {
    if (notification.unread) markAsRead(notification.id);
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

  let unreadIdsByAuthor = $derived.by(() => {
    const login = notification.author?.login;
    if (!login) return null;
    const ids = getUnreadIdsByAuthor(login, notification.source);
    return ids.size > 1 ? ids : null;
  });

  let menuEntries = $derived.by<MenuEntry[]>(() => {
    const authorIds = unreadIdsByAuthor;
    const author = notification.author;
    const readActions: MenuEntry[] = [
      ...(notification.unread ? [{ label: 'Mark as read', hint: 'M', onclick: markReadNow }] : []),
      ...(authorIds && author
        ? [
            {
              label: `Mark all from @${author.login} as read (${authorIds.size})`,
              onclick: () => markAllAsRead(authorIds)
            }
          ]
        : []),
      ...(notification.source === 'github' && !isSyntheticNotification(notification)
        ? [
            {
              label: 'Mark as done',
              title: 'Removes the thread from your GitHub notification inbox — cannot be undone',
              onclick: () => markAsDone(notification.id)
            }
          ]
        : [])
    ];
    return [
      { label: 'Open', hint: '↵', onclick: () => handleClick() },
      { label: 'Copy link', onclick: () => navigator.clipboard.writeText(notification.url) },
      { label: 'Mute…', onclick: () => (showMuteModal = true) },
      { label: 'Snooze…', onclick: () => (showSnoozeModal = true) },
      ...(canUnsubscribe
        ? [
            {
              label: 'Unsubscribe',
              title:
                'Tells GitHub/GitLab to stop notifying you about this thread — unlike Mute, this is not just hidden locally',
              onclick: () => unsubscribeFromNotification(notification.id)
            }
          ]
        : []),
      ...(readActions.length > 0 ? ['divider' as const, ...readActions] : [])
    ];
  });

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
      handleClick();
    } else if (e.key === 'm' && notification.unread) {
      e.preventDefault();
      markReadNow();
    } else if (e.key === 'z') {
      e.preventDefault();
      snoozeNotification(notification, 'tomorrow', true);
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
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    class="group relative block w-full text-left transition-colors hover:bg-surface-hovered"
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
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    entries={menuEntries}
    onClose={() => (contextMenu = null)}
  />
{/if}

{#if showMuteModal}
  <MuteModal {notification} onClose={() => (showMuteModal = false)} />
{/if}

{#if showSnoozeModal}
  <SnoozeModal {notification} onClose={() => (showSnoozeModal = false)} />
{/if}
