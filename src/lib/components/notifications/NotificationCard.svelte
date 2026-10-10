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
  import { notificationChips, repoShortName } from '$lib/utils/row-chips';
  import { NOTIFICATION_TYPE_LABELS } from '$lib/types';
  import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
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

  function markReadAnimated(): void {
    if (!notification.unread) return;
    dismissing = true;
    setTimeout(() => markAsRead(notification.id), 350);
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
      ...(notification.unread
        ? [{ label: 'Mark as read', hint: 'M', onclick: markReadAnimated }]
        : []),
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
              onclick: () => {
                dismissing = true;
                setTimeout(() => markAsDone(notification.id), 350);
              }
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
      markReadAnimated();
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
