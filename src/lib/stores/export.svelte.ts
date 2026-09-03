import { settingsState } from './settings.svelte';
import { getVisibleNotifications, getHasLoadedOnce } from './notifications.svelte';
import { getFilteredPRs, getPRHasLoadedOnce } from './pull-requests.svelte';
import { getFilteredIssues, getIssueHasLoadedOnce } from './issues.svelte';
import { decideExport } from '$lib/utils/export-decision';
import type { ExportDecisionInput } from '$lib/utils/export-decision';
import { isTauri } from '$lib/utils/storage';
import { info as logInfo, warn as logWarn } from '$lib/utils/logger';

const LOG_SOURCE = 'export';
const WRITE_DEBOUNCE_MS = 300;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingWrite(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

// write_export_data and delete_export_data are two independent IPC calls; without
// this queue a disable landing between the debounced write's re-check and its
// invoke resolving could race the delete, leaving a stale data.json on disk if
// the write happens to land after it (GH-134). Chaining both through the same
// promise enforces the order they were requested in, regardless of which IPC
// round-trip happens to finish first.
let ipcQueue: Promise<void> = Promise.resolve();

function enqueueIpc(task: () => Promise<void>): void {
  ipcQueue = ipcQueue.then(task, task);
}

async function performWrite(payload: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_export_data', { payload });
    logInfo(LOG_SOURCE, 'wrote data.json');
  } catch (error) {
    logWarn(LOG_SOURCE, 'failed to write data.json', error);
  }
}

async function performDelete(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_export_data');
    logInfo(LOG_SOURCE, 'deleted data.json');
  } catch (error) {
    logWarn(LOG_SOURCE, 'failed to delete data.json', error);
  }
}

/**
 * Deletes data.json, serialized against any write still in flight so it can
 * never be undone by a stale write that was already on its way to disk. Call
 * this instead of invoking `delete_export_data` directly (e.g. from the
 * export-toggle callback in App.svelte).
 */
export function requestExportDelete(): void {
  clearPendingWrite();
  enqueueIpc(performDelete);
}

/**
 * Runs the write/skip decision for one snapshot of store state and, when a
 * write is due, schedules it after a short debounce so a burst of poll
 * updates collapses into a single write (mirrors the debounce this replaced
 * in TrayPopup.svelte). Exported standalone so tests can drive it without
 * the Svelte effect runtime.
 */
export function evaluateExport(input: ExportDecisionInput): void {
  clearPendingWrite();
  const decision = decideExport(input);
  if (decision.action === 'skip') {
    logInfo(LOG_SOURCE, `skipped: ${decision.reason}`);
    return;
  }

  const payload = JSON.stringify(decision.snapshot);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    // Re-checked here: this callback can no longer be canceled once it
    // fires, so if the user disabled the export during the debounce window,
    // a stale write must not resurrect the file right after a delete ran
    // (see setExportDataChangeCallback in App.svelte). Routing the write
    // through the same ipcQueue as requestExportDelete additionally covers
    // the narrower race where a disable lands after this check but before
    // the write's own invoke resolves.
    if (!settingsState.exportData) {
      logInfo(LOG_SOURCE, 'skipped: export disabled during debounce');
      return;
    }
    enqueueIpc(() => performWrite(payload));
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Wires the export effect at the store level (GH-127) so it keeps running
 * for the lifetime of the tray window's JS context, independent of whether
 * any popup component happens to be mounted. Previously this effect lived in
 * TrayPopup.svelte and read that component's local filter state, but for a
 * menu bar app the popup is closed almost all the time while the Rust poll
 * keeps running in the background — coupling a background export to a
 * popup's own UI state meant it only ever wrote while someone was actively
 * looking at the popup with those exact filters applied. This now reads the
 * stores' unfiltered aggregate state directly, which is what "what's my
 * overall status" export data should reflect anyway.
 *
 * Call once (from App.svelte's onMount, not the settings window) and call
 * the returned cleanup on teardown.
 */
export function initExportEffect(): () => void {
  return $effect.root(() => {
    $effect(() => {
      const exportEnabled = settingsState.exportData;
      const filteredNotifications = getVisibleNotifications();
      const notificationsLoaded = getHasLoadedOnce();
      const filteredPRs = getFilteredPRs();
      const prsLoaded = getPRHasLoadedOnce();
      const issuesEnabled = settingsState.enableIssues;
      const filteredIssues = issuesEnabled ? getFilteredIssues('all', 'assigned') : [];
      const issuesLoaded = getIssueHasLoadedOnce();
      const ttlSeconds = settingsState.pollingInterval;

      evaluateExport({
        exportEnabled,
        displayName: __APP_NAME__,
        ttlSeconds,
        notificationsLoaded,
        filteredNotifications,
        prsLoaded,
        filteredPRs,
        issuesEnabled,
        issuesLoaded,
        filteredIssues
      });
    });

    return clearPendingWrite;
  });
}
