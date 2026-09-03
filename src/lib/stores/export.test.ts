import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExportDecisionInput } from '$lib/utils/export-decision';

const settingsState = vi.hoisted(() => ({ exportData: true }));
const logInfo = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('./settings.svelte', () => ({ settingsState }));
vi.mock('$lib/utils/storage', () => ({ isTauri: () => true }));
vi.mock('$lib/utils/logger', () => ({ info: logInfo, warn: logWarn }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { evaluateExport, requestExportDelete } from './export.svelte';

function makeInput(overrides: Partial<ExportDecisionInput> = {}): ExportDecisionInput {
  return {
    exportEnabled: true,
    displayName: 'Beacon',
    ttlSeconds: 300,
    notificationsLoaded: true,
    filteredNotifications: [],
    prsLoaded: true,
    filteredPRs: [],
    issuesEnabled: false,
    issuesLoaded: false,
    filteredIssues: [],
    now: new Date('2026-09-02T12:00:00Z'),
    ...overrides
  };
}

describe('evaluateExport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    settingsState.exportData = true;
    invoke.mockClear();
    invoke.mockResolvedValue(undefined);
    logInfo.mockClear();
    logWarn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs a specific skip reason and never invokes the write command', () => {
    evaluateExport(makeInput({ notificationsLoaded: false }));
    vi.runAllTimers();

    expect(invoke).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith('export', 'skipped: notifications not loaded yet');
  });

  it('writes after the debounce and logs success', async () => {
    evaluateExport(makeInput());
    expect(invoke).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('write_export_data', {
      payload: expect.stringContaining('"schemaVersion":1')
    });
    expect(logInfo).toHaveBeenCalledWith('export', 'wrote data.json');
  });

  it('collapses rapid successive calls into a single debounced write', async () => {
    evaluateExport(makeInput());
    evaluateExport(makeInput());
    evaluateExport(makeInput());

    await vi.runAllTimersAsync();

    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('skips the write if the export toggle flips off during the debounce window', async () => {
    evaluateExport(makeInput());
    settingsState.exportData = false;

    await vi.runAllTimersAsync();

    expect(invoke).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith('export', 'skipped: export disabled during debounce');
  });

  it('serializes a delete requested while a write is still in flight, so the delete always lands last (GH-134)', async () => {
    let resolveWrite: (() => void) | undefined;
    invoke.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        })
    );

    evaluateExport(makeInput());
    await vi.advanceTimersByTimeAsync(300); // matches export.svelte.ts's WRITE_DEBOUNCE_MS

    // The debounced write's re-check passed and its invoke is in flight but
    // unresolved — this is the exact window the race in GH-134 landed in.
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('write_export_data', expect.anything());

    settingsState.exportData = false;
    requestExportDelete();

    // The delete must wait for the in-flight write, not race it.
    expect(invoke).toHaveBeenCalledTimes(1);

    resolveWrite?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(2, 'delete_export_data');
    expect(logInfo).toHaveBeenCalledWith('export', 'deleted data.json');
  });

  it('logs a warning when the write command rejects', async () => {
    invoke.mockRejectedValueOnce(new Error('disk full'));

    evaluateExport(makeInput());
    await vi.runAllTimersAsync();

    expect(logWarn).toHaveBeenCalledWith('export', 'failed to write data.json', expect.any(Error));
  });
});
