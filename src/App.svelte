<script lang="ts">
  import './app.css';
  import TrayPopup from './lib/components/layout/TrayPopup.svelte';
  import SettingsView from './lib/components/settings/SettingsView.svelte';
  import { initializeConnections, hasAnyServiceConfigured } from './lib/stores/connections.svelte';
  import {
    initializeSettings,
    setPollingChangeCallback,
    setBadgeModeChangeCallback
  } from './lib/stores/settings.svelte';
  import { initializeMuteRules } from './lib/stores/mute-rules.svelte';
  import {
    startPolling,
    stopPolling,
    restartPolling,
    refreshBadge,
    isDemoMode,
    loadDemoData,
    setupNotificationListener
  } from './lib/stores/notifications.svelte';
  import {
    startPRPolling,
    stopPRPolling,
    restartPRPolling,
    loadDemoPRs
  } from './lib/stores/pull-requests.svelte';
  import Toast from './lib/components/ui/Toast.svelte';
  import { onMount } from 'svelte';

  const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings';

  let isInitializing = $state(true);
  let initialTab: 'notifications' | 'settings' = $state('notifications');

  onMount(() => {
    let unlistenNotifications: (() => void) | undefined;

    async function initialize(): Promise<void> {
      try {
        await initializeSettings();
        await initializeMuteRules();

        if (isSettingsWindow) {
          await initializeConnections();
          return;
        }

        setPollingChangeCallback(() => {
          restartPolling();
          restartPRPolling();
        });
        setBadgeModeChangeCallback(refreshBadge);
        await initializeConnections();

        // Listen for notification updates from Rust backend
        unlistenNotifications = await setupNotificationListener();

        if (isDemoMode()) {
          loadDemoData();
          loadDemoPRs();
        } else if (hasAnyServiceConfigured()) {
          startPolling();
          startPRPolling();
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
      stopPRPolling();
      unlistenNotifications?.();
    };
  });
</script>

{#if isInitializing}
  <div class="flex h-screen items-center justify-center bg-background">
    <div
      class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
    ></div>
  </div>
{:else if isSettingsWindow}
  <div class="h-screen overflow-y-auto bg-background">
    <SettingsView />
  </div>
{:else}
  <div class="animate-fade-in">
    <TrayPopup {initialTab} />
  </div>
{/if}
<Toast />
