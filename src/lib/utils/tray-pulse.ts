import { isTauri } from '$lib/utils/storage';
import { prefersReducedMotion } from '$lib/utils/motion';

/** Asks the backend to play a short pulse on the menu bar icon. */
export async function pulseTrayIcon(): Promise<void> {
  try {
    if (!isTauri() || prefersReducedMotion()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('pulse_tray_icon');
  } catch {
    // The pulse is decoration, a failure must never surface.
  }
}
