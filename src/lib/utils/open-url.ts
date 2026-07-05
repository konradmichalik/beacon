import { isTauri } from './storage';
import { warn as logWarn } from './logger';

/**
 * Whether a URL is safe to open externally. Only `http`/`https` are allowed —
 * schemes like `file:`, `javascript:` or custom app schemes are refused, since
 * these URLs come from external APIs (notification/PR targets, self-hosted
 * GitLab) and could otherwise launch arbitrary handlers.
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Open an external URL, refusing anything that is not http(s). */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isSafeExternalUrl(url)) {
    logWarn('open-url', `refused to open non-http(s) URL: ${url}`);
    return;
  }
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
