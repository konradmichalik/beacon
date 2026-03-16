import { isTauri } from '$lib/utils/storage';

export async function sendNotification(title: string, body: string): Promise<void> {
  if (!isTauri()) return;

  try {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification: send
    } = await import('@tauri-apps/plugin-notification');

    let permitted = await isPermissionGranted();
    if (!permitted) {
      const result = await requestPermission();
      permitted = result === 'granted';
    }
    if (!permitted) return;

    send({ title, body });
  } catch {
    // Notification is best-effort
  }
}
