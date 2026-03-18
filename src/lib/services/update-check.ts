import { safeFetch } from '$lib/utils/fetch';

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

export interface UpdateCheckResult {
  status: UpdateStatus;
  latestVersion?: string;
  releaseUrl?: string;
  error?: string;
}

const RELEASES_API = 'https://api.github.com/repos/konradmichalik/beacon/releases/latest';

function compareVersions(current: string, latest: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const a = parse(current);
  const b = parse(latest);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateCheckResult> {
  try {
    const response = await safeFetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    });

    if (!response.ok) {
      return { status: 'error', error: `GitHub API returned ${response.status}` };
    }

    const data = await response.json();
    const latestVersion = data.tag_name as string;
    const releaseUrl = data.html_url as string;

    const cmp = compareVersions(currentVersion, latestVersion);

    if (cmp > 0) {
      return { status: 'update-available', latestVersion, releaseUrl };
    }

    return { status: 'up-to-date', latestVersion };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
