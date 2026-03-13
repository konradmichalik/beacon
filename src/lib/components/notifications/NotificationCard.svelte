<script lang="ts">
  import type { UnifiedNotification } from '$lib/types';
  import { markAsRead, markAsUnread, getLastSeenAt } from '$lib/stores/notifications.svelte';
  import { timeAgo } from '$lib/utils/time';
  import { isTauri } from '$lib/utils/storage';
  import GitHubIcon from '$lib/components/icons/GitHubIcon.svelte';
  import GitLabIcon from '$lib/components/icons/GitLabIcon.svelte';
  import { CircleCheck, GitMerge, CircleDot, AtSign, MessageSquare, Eye, GitPullRequest, UserCheck, ShieldCheck, Tag, Users, Bell, PenLine, AlertTriangle, TrainFront, UserPlus, ExternalLink, CheckCheck, ClipboardCopy, CircleDashed } from '@lucide/svelte';

  let { notification }: { notification: UnifiedNotification } = $props();

  let dismissing = $state(false);
  let timeLabel = $derived(timeAgo(notification.updatedAt));
  let repoShort = $derived(notification.repository.split('/').slice(-2).join('/'));

  const avatarColors = ['#bf616a', '#d08770', '#ebcb8b', '#a3be8c', '#88c0d0', '#5e81ac', '#b48ead'];
  let avatarFailed = $state(false);
  let avatarInitial = $derived(notification.author?.login?.charAt(0).toUpperCase() ?? '');
  let avatarColor = $derived.by(() => {
    const name = notification.author?.login ?? '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  });
  let isNew = $derived.by(() => {
    const seen = getLastSeenAt();
    if (!seen) return false;
    return notification.unread && notification.updatedAt > seen;
  });

  const typeConfig: Record<string, { short: string; full: string }> = {
    issue: { short: 'Issue', full: 'Issue' },
    pull_request: { short: 'PR', full: 'Pull Request' },
    merge_request: { short: 'MR', full: 'Merge Request' },
    review: { short: 'Review', full: 'Review' },
    pipeline: { short: 'Pipeline', full: 'Pipeline' },
    release: { short: 'Release', full: 'Release' },
    discussion: { short: 'Discussion', full: 'Discussion' },
    other: { short: 'Other', full: 'Other' }
  };

  let typeInfo = $derived(typeConfig[notification.type] ?? { short: notification.type, full: notification.type });

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
    member_access_requested: { label: 'Access requested', icon: UserPlus }
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
    if (s === 'merged') return { label: 'Merged', class: 'text-discovery', icon: GitMerge };
    if (s === 'closed') return { label: 'Closed', class: 'text-destructive', icon: CircleCheck };
    if (s === 'open') return { label: 'Open', class: 'text-success-text', icon: CircleDot };
    return null;
  });

  async function openUrl(): Promise<void> {
    if (isTauri()) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(notification.url);
    } else {
      window.open(notification.url, '_blank');
    }
  }

  function handleClick(): void {
    if (dismissing) return;
    openUrl();
    if (notification.unread) {
      dismissing = true;
      setTimeout(() => markAsRead(notification.id), 350);
    }
  }

  let contextMenu: { x: number; y: number } | null = $state(null);

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const menuHeight = 100; // approximate max height of context menu
    const y = event.clientY + menuHeight > window.innerHeight
      ? event.clientY - menuHeight
      : event.clientY;
    contextMenu = { x: event.clientX, y };

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

  function handleContextMarkUnread(): void {
    closeContextMenu(() => markAsUnread(notification.id));
  }
</script>

<div
  class="overflow-hidden transition-all duration-300 ease-in-out {dismissing ? 'max-h-0 border-b-0' : 'max-h-40 border-b border-border/60'}"
  style={dismissing ? 'margin-top: 0; margin-bottom: 0; padding-top: 0; padding-bottom: 0;' : ''}
>
<button
  type="button"
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
  class="group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 ease-in-out hover:bg-secondary/40 {notification.unread ? '' : 'opacity-45'} {notification.subjectState === 'closed' || notification.subjectState === 'merged' ? 'opacity-60' : ''} {dismissing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}"
>
  <!-- New-since-last-open indicator -->
  {#if isNew}
    <span class="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"></span>
  {/if}

  <!-- Avatar with username tooltip -->
  <div class="group/avatar relative mt-0.5 flex-shrink-0">
    {#if notification.author?.avatarUrl && !avatarFailed}
      <img
        src={notification.author.avatarUrl}
        alt={notification.author.login}
        class="h-8 w-8 rounded-full"
        onerror={() => avatarFailed = true}
      />
    {:else if notification.author}
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white"
        style="background-color: {avatarColor}"
      >
        {avatarInitial}
      </div>
    {:else}
      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {#if notification.source === 'github'}
          <GitHubIcon size={14} />
        {:else}
          <GitLabIcon size={14} />
        {/if}
      </div>
    {/if}
    {#if notification.author}
      <span class="pointer-events-none absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 shadow-sm transition-opacity group-hover/avatar:opacity-100">
        {notification.author.login}
      </span>
    {/if}
  </div>

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
      <span title={typeInfo.full} class="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {typeInfo.short}
      </span>
      {#if stateInfo}
        {@const StateIcon = stateInfo.icon}
        <span class="flex shrink-0 items-center gap-0.5 text-[10px] font-medium {stateInfo.class}">
          <StateIcon size={10} />
          {stateInfo.label}
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
    {#if notification.unread}
      <button
        type="button"
        onclick={handleContextMarkRead}
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
      >
        <CheckCheck size={12} />
        Mark as read
      </button>
    {:else}
      <button
        type="button"
        onclick={handleContextMarkUnread}
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
      >
        <CircleDashed size={12} />
        Mark as unread
      </button>
    {/if}
  </div>
{/if}
