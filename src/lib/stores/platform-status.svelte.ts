import type { PlatformStatus } from '$lib/types';
import { isTauri } from '$lib/utils/storage';

interface PlatformStatusEvent {
  github: PlatformStatus | null;
  gitlab: PlatformStatus | null;
}

export const platformStatusState = $state<PlatformStatusEvent>({
  github: null,
  gitlab: null
});

export function updatePlatformStatusFromBackend(payload: PlatformStatusEvent): void {
  platformStatusState.github = payload.github;
  platformStatusState.gitlab = payload.gitlab;
}

export async function setupPlatformStatusListener(): Promise<() => void> {
  if (!isTauri()) return () => {};

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<PlatformStatusEvent>('platform-status-updated', (event) => {
    updatePlatformStatusFromBackend(event.payload);
  });
  return unlisten;
}
