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
  import { timeAgo } from '$lib/utils/time';
  import { openExternalUrl } from '$lib/utils/open-url';
  import { clampMenuPosition, menuPositionFromElement } from '$lib/utils/context-menu';
  import { parseGitLabTargetUrl } from '$lib/utils/gitlab-target';
  import { isSyntheticNotification } from '$lib/utils/synthetic-notifications';
  import { getGitLabConfig } from '$lib/stores/connections.svelte';
  import { focusTrap } from '$lib/actions/focusTrap';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import {
    CircleCheck,
    GitMerge,
    CircleDot,
    AtSign,
    MessageSquare,
    Eye,
    GitPullRequest,
    UserCheck,
    ShieldCheck,
    Tag,
    Users,
    Bell,
    PenLine,
    AlertTriangle,
    CircleX,
    TrainFront,
    UserPlus,
    ExternalLink,
    CheckCheck,
    ClipboardCopy,
    BellOff,
    BellMinus,
    FileEdit,
    Archive,
    AlarmClock,
    Sparkles
  } from '@lucide/svelte';
  import MuteModal from './MuteModal.svelte';
  import SnoozeModal from './SnoozeModal.svelte';

  let { notification }: { notification: UnifiedNotification } = $props();

  let dismissing = $state(false);
  let timeLabel = $derived(timeAgo(notification.updatedAt));
  let repoShort = $derived(notification.repository.split('/').slice(-2).join('/'));

  let isNew = $derived.by(() => {
    const seen = getLastSeenAt();
    if (!seen) return false;
    return notification.unread && notification.updatedAt > seen;
  });

  const defaultBadge = 'bg-secondary text-muted-foreground';
  const typeConfig: Record<string, { short: string; full: string; badge?: string }> = {
    issue: { short: 'Issue', full: 'Issue', badge: 'bg-success-text/10 text-success-text' },
    pull_request: {
      short: 'PR',
      full: 'Pull Request',
      badge: 'bg-accent-foreground/10 text-accent-foreground'
    },
    merge_request: {
      short: 'MR',
      full: 'Merge Request',
      badge: 'bg-accent-foreground/10 text-accent-foreground'
    },
    review: { short: 'Review', full: 'Review', badge: 'bg-discovery/10 text-discovery' },
    pipeline: { short: 'Pipeline', full: 'Pipeline' },
    release: { short: 'Release', full: 'Release' },
    discussion: { short: 'Discussion', full: 'Discussion' },
    other: { short: 'Other', full: 'Other' }
  };

  let typeInfo = $derived.by(() => {
    const config = typeConfig[notification.type];
    return {
      short: config?.short ?? notification.type,
      full: config?.full ?? notification.type,
      badge: config?.badge ?? defaultBadge
    };
  });

  const reasonMap: Record<string, { label: string; icon: typeof AtSign }> = {
    mention: { label: 'Mentioned', icon: AtSign },
    comment: { label: 'Commented', icon: MessageSquare },
    review_requested: { label: 'Review requested', icon: Eye },
    review_submitted: { label: 'Review submitted', icon: Eye },
    change_requested: { label: 'Changes requested', icon: PenLine },
    assign: { label: 'Assigned', icon: UserCheck },
    subscribed: { label: 'Subscribed', icon: Bell },
    state_change: { label: 'State changed', icon: GitPullRequest },
    ci_activity: { label: 'CI activity', icon: GitPullRequest },
    approved: { label: 'Approved', icon: ShieldCheck },
    approval_requested: { label: 'Approval requested', icon: ShieldCheck },
    security_alert: { label: 'Security alert', icon: ShieldCheck },
    team_mention: { label: 'Team mentioned', icon: Users },
    author: { label: 'Authored', icon: Tag },
    unmergeable: { label: 'Unmergeable', icon: AlertTriangle },
    merge_train_removed: { label: 'Merge train removed', icon: TrainFront },
    member_access_requested: { label: 'Access requested', icon: UserPlus },
    ready_for_review: { label: 'Ready for review', icon: GitPullRequest },
    mergeable: { label: 'Ready to merge', icon: GitMerge },
    ci_failed: { label: 'CI failed', icon: CircleX }
  };

  let reasonInfo = $derived.by(() => {
    const mapped = reasonMap[notification.reason];
    if (mapped) return mapped;
    if (notification.reason) {
      // Fallback: capitalize the raw reason
      const label = notification.reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
      return { label, icon: Bell };
    }
    return null;
  });

  let stateInfo = $derived.by(() => {
    const s = notification.subjectState;
    if (s === 'merged')
      return {
        label: 'Merged',
        class: 'bg-discovery/10 text-discovery',
        icon: GitMerge
      };
    if (s === 'closed')
      return {
        label: 'Closed',
        class: 'bg-destructive/10 text-destructive',
        icon: CircleCheck
      };
    if (s === 'open')
      return {
        label: 'Open',
        class: 'bg-success-text/10 text-success-text',
        icon: CircleDot
      };
    return null;
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
    : 'max-h-40 border-b border-border/60'}"
  style={dismissing ? 'margin-top: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0;' : ''}
>
  <button
    type="button"
    tabindex={-1}
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    class="group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 ease-in-out hover:bg-surface-hovered {notification.unread
      ? ''
      : 'opacity-45'} {notification.subjectState === 'closed' ||
    notification.subjectState === 'merged'
      ? 'opacity-60'
      : ''} {dismissing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}"
  >
    <!-- New-since-last-open indicator -->
    {#if isNew}
      <span class="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
    {/if}

    <!-- Avatar with username tooltip -->
    <Avatar author={notification.author} source={notification.source} />

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Row 1: Source icon + repo -->
      <div class="flex items-center gap-1.5">
        {#if notification.source === 'github'}
          <GitHubIcon size={11} class="flex-shrink-0 text-muted-foreground/70" />
        {:else}
          <GitLabIcon size={11} class="flex-shrink-0 text-muted-foreground/70" />
        {/if}
        <span class="truncate text-[11px] text-muted-foreground">{repoShort}</span>
      </div>

      <!-- Row 2: Title -->
      <p class="mt-0.5 truncate text-[13px] font-medium leading-snug text-foreground">
        {notification.title}
      </p>

      <!-- Row 3: Type badge + state + time (right-aligned) -->
      <div class="mt-1 flex items-center gap-1.5">
        <span
          title={typeInfo.full}
          class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {typeInfo.badge}"
        >
          {typeInfo.short}
        </span>
        {#if isSyntheticNotification(notification)}
          <span
            title="Detected locally by Beacon — GitHub/GitLab did not send this notification"
            class="flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          >
            <Sparkles size={10} />
            Beacon
          </span>
        {/if}
        {#if stateInfo}
          {@const StateIcon = stateInfo.icon}
          <span
            class="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium {stateInfo.class}"
          >
            <StateIcon size={10} />
            {stateInfo.label}
          </span>
        {/if}
        {#if notification.draft}
          <span
            title="Draft — work in progress"
            class="flex shrink-0 items-center gap-0.5 rounded border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
          >
            <FileEdit size={10} />
            Draft
          </span>
        {/if}
        {#if reasonInfo}
          {@const ReasonIcon = reasonInfo.icon}
          <span class="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
            <ReasonIcon size={9} />
            {reasonInfo.label}
          </span>
        {/if}
        <span class="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeLabel}</span>
      </div>
    </div>
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
