import type { NotifySound } from '$lib/stores/settings.svelte';
import { isTauri } from '$lib/utils/storage';

let cachedAudio: HTMLAudioElement | null = null;
let cachedSound: string | null = null;

export function playNotificationSound(sound: NotifySound): void {
  if (sound === 'none') return;

  if (isTauri()) {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('play_sound', { sound }).catch(() => {});
    });
    return;
  }

  // Fallback for web/demo mode
  const src = `/sounds/${sound}.mp3`;

  if (cachedSound === sound && cachedAudio) {
    cachedAudio.currentTime = 0;
    cachedAudio.play().catch(() => {});
    return;
  }

  cachedAudio?.pause();
  cachedAudio = new Audio(src);
  cachedSound = sound;
  cachedAudio.play().catch(() => {});
}
