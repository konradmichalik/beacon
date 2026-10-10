import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const isTauri = vi.fn();
vi.mock('$lib/utils/storage', () => ({ isTauri: () => isTauri() }));

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

import { pulseTrayIcon } from './tray-pulse';

function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({ matches: reduce && query.includes('reduce') })
  });
}

describe('pulseTrayIcon', () => {
  beforeEach(() => {
    isTauri.mockReturnValue(true);
    invoke.mockReset().mockResolvedValue(undefined);
    stubReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the backend for a pulse', async () => {
    await pulseTrayIcon();
    expect(invoke).toHaveBeenCalledWith('pulse_tray_icon');
  });

  it('does nothing outside the desktop app', async () => {
    isTauri.mockReturnValue(false);
    await pulseTrayIcon();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does nothing under Reduce Motion', async () => {
    stubReducedMotion(true);
    await pulseTrayIcon();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not throw where there is no window at all', async () => {
    isTauri.mockImplementation(() => {
      throw new ReferenceError('window is not defined');
    });
    await expect(pulseTrayIcon()).resolves.toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('swallows a failing command, the pulse is decoration', async () => {
    invoke.mockRejectedValue(new Error('no tray'));
    await expect(pulseTrayIcon()).resolves.toBeUndefined();
  });
});
