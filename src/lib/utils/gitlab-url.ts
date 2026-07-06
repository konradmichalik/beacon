/**
 * Validate and normalize a user-provided GitLab base URL.
 *
 * The Personal Access Token is sent to this URL, so it must not be transmitted
 * over plaintext HTTP. HTTPS is enforced for every host except loopback
 * addresses, where HTTP is allowed for local development instances.
 *
 * Returns the normalized origin + path (no trailing slash, no query/hash) or
 * throws an Error with a user-facing message.
 */
export function normalizeGitLabBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('GitLab URL is required');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid GitLab URL (e.g. https://gitlab.com)');
  }

  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error('GitLab URL must use HTTPS');
  }

  const path = url.pathname.replace(/\/$/, '');
  return `${url.origin}${path}`;
}
