<script lang="ts">
  import { Settings, RefreshCw, Power } from '@lucide/svelte';
  import { isTauri } from '$lib/utils/storage';
  import BeaconLogo from '$lib/components/icons/BeaconLogo.svelte';
  import { getIsLoading, refreshNotifications } from '$lib/stores/notifications.svelte';
  import { getIsPRLoading, refreshPullRequests } from '$lib/stores/pull-requests.svelte';
  import type { ViewTab } from './ViewTabs.svelte';

  let {
    onSettingsToggle,
    onQuit,
    activeView = 'notifications'
  }: { onSettingsToggle: () => void; onQuit?: () => void; activeView?: ViewTab } = $props();

  let isLoading = $derived(activeView === 'notifications' ? getIsLoading() : getIsPRLoading());

  function handleRefresh(): void {
    if (activeView === 'notifications') {
      refreshNotifications();
    } else {
      refreshPullRequests();
    }
  }

  async function handleQuit(): Promise<void> {
    if (onQuit) {
      onQuit();
      return;
    }
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('quit_app');
    }
  }
</script>

<header class="flex items-center justify-between px-4 pt-2">
  <div class="flex items-center">
    <BeaconLogo height={18} class="text-foreground" />
  </div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={handleRefresh}
      disabled={isLoading}
      class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
      title="Refresh"
    >
      <RefreshCw size={14} class={isLoading ? 'animate-spin' : ''} />
    </button>
    <button
      type="button"
      onclick={onSettingsToggle}
      class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      title="Settings"
    >
      <Settings size={15} />
    </button>
    <button
      type="button"
      onclick={handleQuit}
      class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/80 hover:text-white"
      title="Quit Beacon"
    >
      <Power size={14} />
    </button>
  </div>
</header>
