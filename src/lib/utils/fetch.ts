import { isTauri } from './storage';

let tauriFetch: typeof globalThis.fetch | null = null;

/**
 * CORS-safe fetch: uses Tauri HTTP plugin (Rust-side) in desktop mode,
 * falls back to native browser fetch otherwise.
 */
export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    if (!tauriFetch) {
      const mod = await import('@tauri-apps/plugin-http');
      tauriFetch = mod.fetch;
    }
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}
