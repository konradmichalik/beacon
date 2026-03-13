<script lang="ts">
  import { Settings, RefreshCw } from '@lucide/svelte';
  import BeaconIcon from '$lib/components/icons/BeaconIcon.svelte';
  import { getIsLoading, refreshNotifications } from '$lib/stores/notifications.svelte';

  let { onSettingsToggle }: { onSettingsToggle: () => void } = $props();

  let isLoading = $derived(getIsLoading());
</script>

<header class="flex items-center justify-between border-b border-border px-4 py-2.5">
  <div class="flex items-center gap-2">
    <BeaconIcon size={16} class="text-primary" />
    <span class="text-sm font-semibold text-foreground">beacon</span>
  </div>
  <div class="flex items-center gap-0.5">
    <button
      type="button"
      onclick={() => refreshNotifications()}
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
  </div>
</header>
