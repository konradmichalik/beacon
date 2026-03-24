<script lang="ts">
  import './app.css';
  import TrayPopup from './lib/components/layout/TrayPopup.svelte';
  import SettingsView from './lib/components/settings/SettingsView.svelte';
  import { initializeConnections, hasAnyServiceConfigured } from './lib/stores/connections.svelte';
  import {
    settingsState,
    initializeSettings,
    setPollingChangeCallback,
    setBadgeModeChangeCallback,
    setDebugLogChangeCallback
  } from './lib/stores/settings.svelte';
  import { initializeMuteRules } from './lib/stores/mute-rules.svelte';
  import { loadStarredPRs } from './lib/stores/starred-prs.svelte';
  import {
    startPolling,
    stopPolling,
    restartPolling,
    refreshBadge,
    isDemoMode,
    loadDemoData,
    setupNotificationListener,
    loadPersistedReadIds
  } from './lib/stores/notifications.svelte';
  import {
    startPRPolling,
    stopPRPolling,
    restartPRPolling,
    loadDemoPRs
  } from './lib/stores/pull-requests.svelte';
  import Toast from './lib/components/ui/Toast.svelte';
  import { startConsoleCapture, stopConsoleCapture, info as logInfo } from './lib/utils/logger';
  import { onMount } from 'svelte';

  const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings';

  let isInitializing = $state(true);
  let initialTab: 'notifications' | 'settings' = $state('notifications');

  onMount(() => {
    let unlistenNotifications: (() => void) | undefined;

    async function initialize(): Promise<void> {
      try {
        await initializeSettings();

        if (settingsState.debugLog) {
          startConsoleCapture();
          logInfo('app', 'frontend initializing (debug log enabled)');
        }
        await initializeMuteRules();
        await loadStarredPRs();

        if (isSettingsWindow) {
          await initializeConnections();
          return;
        }

        setPollingChangeCallback(() => {
          restartPolling();
          restartPRPolling();
        });
        setBadgeModeChangeCallback(refreshBadge);
        setDebugLogChangeCallback((enabled) => {
          if (enabled) {
            startConsoleCapture();
            logInfo('app', 'debug log enabled');
          } else {
            logInfo('app', 'debug log disabled');
            stopConsoleCapture();
          }
        });
        await initializeConnections();

        // Restore persisted read state before listening for updates
        await loadPersistedReadIds();

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
