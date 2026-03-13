<script lang="ts">
  import './app.css';
  import TrayPopup from './lib/components/layout/TrayPopup.svelte';
  import {
    initializeConnections,
    hasAnyServiceConfigured
  } from './lib/stores/connections.svelte';
  import { initializeSettings, setPollingChangeCallback, setBadgeModeChangeCallback, setNotifyChangeCallback } from './lib/stores/settings.svelte';
  import { startPolling, stopPolling, restartPolling, refreshBadge, isDemoMode, loadDemoData } from './lib/stores/notifications.svelte';
  import { startSummaryTimer, stopSummaryTimer } from './lib/services/desktop-notifications';
  import { onMount } from 'svelte';

  let isInitializing = $state(true);
  let initialTab: 'notifications' | 'settings' = $state('notifications');

  onMount(() => {
    async function initialize(): Promise<void> {
      try {
        await initializeSettings();
        setPollingChangeCallback(restartPolling);
        setBadgeModeChangeCallback(refreshBadge);
        setNotifyChangeCallback(startSummaryTimer);
        await initializeConnections();

        if (isDemoMode()) {
          loadDemoData();
        } else if (hasAnyServiceConfigured()) {
          startPolling();
          startSummaryTimer();
        } else {
          initialTab = 'settings';
        }
      } finally {
        isInitializing = false;
      }
    }

    initialize();

    return () => {
      stopPolling();
      stopSummaryTimer();
    };
  });
</script>

{#if isInitializing}
  <div class="flex h-screen items-center justify-center bg-background">
    <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
  </div>
{:else}
  <div class="animate-fade-in">
    <TrayPopup {initialTab} />
  </div>
{/if}
