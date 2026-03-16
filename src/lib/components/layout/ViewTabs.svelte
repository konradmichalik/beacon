<script lang="ts">
  import { getUnreadCount } from '$lib/stores/notifications.svelte';
  import { getPRCount } from '$lib/stores/pull-requests.svelte';
  import { Bell, GitPullRequest } from '@lucide/svelte';

  export type ViewTab = 'notifications' | 'pull-requests';

  let {
    activeTab,
    onTabChange
  }: {
    activeTab: ViewTab;
    onTabChange: (tab: ViewTab) => void;
  } = $props();

  let unreadCount = $derived(getUnreadCount());
  let prCount = $derived(getPRCount());

  const tabs: { id: ViewTab; label: string; icon: typeof Bell; getCount: () => number }[] = [
    { id: 'notifications', label: 'Notifications', icon: Bell, getCount: () => unreadCount },
    { id: 'pull-requests', label: 'My PRs', icon: GitPullRequest, getCount: () => prCount }
  ];
</script>

<div class="flex justify-center gap-1 border-b border-border px-4 pt-0.5 pb-0">
  {#each tabs as tab (tab.id)}
    {@const TabIcon = tab.icon}
    {@const count = tab.getCount()}
    <button
      type="button"
      onclick={() => onTabChange(tab.id)}
      class="flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-[11px] font-medium transition-colors
        {activeTab === tab.id
        ? 'bg-card text-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'}"
    >
      <TabIcon size={11} />
      {tab.label}
      {#if count > 0}
        <span
          class="rounded-full px-1.5 py-px text-[9px] font-semibold leading-tight
            {activeTab === tab.id
            ? 'bg-primary/15 text-primary'
            : 'bg-secondary/80 text-muted-foreground'}"
        >
          {count}
        </span>
      {/if}
    </button>
  {/each}
</div>
