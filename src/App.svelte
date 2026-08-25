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
    setGlobalShortcutChangeCallback,
    setDebugLogChangeCallback,
    setIssuesChangeCallback,
    listenForExternalSettingsChanges
  } from './lib/stores/settings.svelte';
  import {
    initializeMuteRules,
    setMuteRulesChangeCallback,
    listenForExternalMuteRuleChanges
  } from './lib/stores/mute-rules.svelte';
  import { initializeSnoozed, setSnoozeChangeCallback } from './lib/stores/snooze.svelte';
  import { loadStarredPRs } from './lib/stores/starred-prs.svelte';
  import {
    startPolling,
    stopPolling,
    restartPolling,
    refreshBadge,
    isDemoMode,
    loadDemoData,
    setupNotificationListener,
    loadPersistedReadIds,
    loadPersistedDismissedIds,
    loadPersistedSyntheticNotifications
  } from './lib/stores/notifications.svelte';
  import { setupPlatformStatusListener } from './lib/stores/platform-status.svelte';
  import {
    startPRPolling,
    stopPRPolling,
    restartPRPolling,
    loadDemoPRs
  } from './lib/stores/pull-requests.svelte';
  import { startIssuePolling, stopIssuePolling, loadDemoIssues } from './lib/stores/issues.svelte';
  import Toast from './lib/components/ui/Toast.svelte';
  import { startConsoleCapture, stopConsoleCapture, info as logInfo } from './lib/utils/logger';
  import { onMount } from 'svelte';

  const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings';

  let isInitializing = $state(true);
  let initialTab: 'notifications' | 'settings' = $state('notifications');

  onMount(() => {
    let unlistenNotifications: (() => void) | undefined;
    let unlistenSettings: (() => void) | undefined;
    let unlistenMuteRules: (() => void) | undefined;
    let unlistenPlatformStatus: (() => void) | undefined;

    async function initialize(): Promise<void> {
      try {
        // Registered before any other await so a status event emitted while
        // the rest of init is still running isn't missed until the next poll.
        unlistenPlatformStatus = await setupPlatformStatusListener();

        await initializeSettings();

        if (settingsState.debugLog) {
          startConsoleCapture();
          logInfo('app', 'frontend initializing (debug log enabled)');
        }
        await initializeMuteRules();
        // Both windows render the mute-rule editor, so both need to follow the
        // other's edits. Only the tray window gets the badge callback below.
        unlistenMuteRules = await listenForExternalMuteRuleChanges();
        await initializeSnoozed();
        await loadStarredPRs();

        if (isSettingsWindow) {
          await initializeConnections();
          return;
        }

        const { invoke } = await import('@tauri-apps/api/core');

        // If user disabled the global shortcut, unregister it (Rust registers by default)
        if (!settingsState.globalShortcut) {
          await invoke('unregister_global_shortcut');
        }
        setGlobalShortcutChangeCallback(async (enabled) => {
          await invoke(enabled ? 'register_global_shortcut' : 'unregister_global_shortcut');
        });

        setPollingChangeCallback(() => {
          restartPolling();
          restartPRPolling();
          if (settingsState.enableIssues) startIssuePolling();
        });
        setBadgeModeChangeCallback(refreshBadge);
        setMuteRulesChangeCallback(refreshBadge);
        setSnoozeChangeCallback(refreshBadge);
        setIssuesChangeCallback((enabled) => {
          if (enabled && hasAnyServiceConfigured()) {
            startIssuePolling();
          } else {
            stopIssuePolling();
          }
        });
        unlistenSettings = await listenForExternalSettingsChanges();
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

        // Restore persisted read/dismissed state before listening for updates
        await loadPersistedReadIds();
        await loadPersistedDismissedIds();
        await loadPersistedSyntheticNotifications();

        // Listen for notification updates from Rust backend
        unlistenNotifications = await setupNotificationListener();

        if (isDemoMode()) {
          loadDemoData();
          loadDemoPRs();
          loadDemoIssues();
        } else if (hasAnyServiceConfigured()) {
          startPolling();
          startPRPolling();
          if (settingsState.enableIssues) startIssuePolling();
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
      stopIssuePolling();
      unlistenNotifications?.();
      unlistenSettings?.();
      unlistenMuteRules?.();
      unlistenPlatformStatus?.();
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
