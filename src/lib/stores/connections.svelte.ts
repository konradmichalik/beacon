import { safeFetch } from '$lib/utils/fetch';
import type {
  AllConnectionsState,
  ServiceState,
  GitHubConnectionConfig,
  GitLabConnectionConfig,
  StoredGitHubConnectionConfig,
  StoredGitLabConnectionConfig,
  ServiceId
} from '$lib/types';
import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/utils/storage';
import { normalizeGitLabBaseUrl } from '$lib/utils/gitlab-url';
import { buildKeychainAccount, setToken, getToken, deleteToken } from '$lib/utils/keychain';

const KEYCHAIN_SAVE_FAILED =
  'Connected, but the token could not be saved to the Keychain — you will need to reconnect after restarting Beacon.';

// A config read back from `settings.json` before the Keychain migration ran
// (e.g. the write succeeded but the Keychain write that has to precede it
// failed) still carries the token inline instead of a `keychainAccount`
// pointer. `initializeConnections` falls back to it rather than treating the
// connection as lost.
type PersistedGitHubConfig = StoredGitHubConnectionConfig | GitHubConnectionConfig;
type PersistedGitLabConfig = StoredGitLabConnectionConfig | GitLabConnectionConfig;

const STORAGE_KEYS = {
  GITHUB_CONFIG: 'github-config',
  GITLAB_CONFIG: 'gitlab-config'
} as const;

function createInitialServiceState(): ServiceState {
  return { status: 'disconnected', error: null, lastChecked: null };
}

export const connectionsState = $state<AllConnectionsState>({
  github: createInitialServiceState(),
  gitlab: createInitialServiceState()
});

let githubConfig: GitHubConnectionConfig | null = $state(null);
let gitlabConfig: GitLabConnectionConfig | null = $state(null);

export function getGitHubConfig(): GitHubConnectionConfig | null {
  return githubConfig;
}

export function getGitLabConfig(): GitLabConnectionConfig | null {
  return gitlabConfig;
}

declare const __DEMO_MODE__: boolean;

export function hasAnyServiceConfigured(): boolean {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot URL check, not reactive state
  if (__DEMO_MODE__ || new URLSearchParams(window.location.search).has('demo')) return true;
  return (
    connectionsState.github.status === 'connected' || connectionsState.gitlab.status === 'connected'
  );
}

export function isServiceConnected(service: ServiceId): boolean {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot URL check, not reactive state
  if (__DEMO_MODE__ || new URLSearchParams(window.location.search).has('demo')) return true;
  return connectionsState[service].status === 'connected';
}

// --- GitHub ---

export async function connectGitHubWithPAT(token: string): Promise<void> {
  connectionsState.github = { status: 'connecting', error: null, lastChecked: null };
  try {
    const response = await safeFetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`GitHub auth failed: ${response.status}`);

    const user = (await response.json()) as { login: string };
    const config: GitHubConnectionConfig = { type: 'pat', token, username: user.login };
    githubConfig = config;

    const account = buildKeychainAccount(user.login, 'github.com');
    let keychainError: string | null = null;
    try {
      await setToken('github', account, token);
    } catch {
      keychainError = KEYCHAIN_SAVE_FAILED;
    }

    // Only persist the Keychain-only shape once the Keychain write actually
    // succeeded. `initializeConnections` can call this with a legacy inline
    // token still on disk (pre-migration); overwriting that working config
    // with a `keychainAccount` pointer to a token that was never saved would
    // turn a still-usable connection into one that needs reconnecting.
    if (!keychainError) {
      const stored: StoredGitHubConnectionConfig = {
        type: 'pat',
        username: user.login,
        keychainAccount: account
      };
      await setStorageItem(STORAGE_KEYS.GITHUB_CONFIG, stored);
    }

    connectionsState.github = {
      status: 'connected',
      error: keychainError,
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    connectionsState.github = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: null
    };
  }
}

// --- GitLab ---

export async function connectGitLabWithPAT(token: string, baseUrl: string): Promise<void> {
  connectionsState.gitlab = { status: 'connecting', error: null, lastChecked: null };

  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = normalizeGitLabBaseUrl(baseUrl);
  } catch (error) {
    connectionsState.gitlab = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Invalid GitLab URL',
      lastChecked: null
    };
    return;
  }

  try {
    const url = `${normalizedBaseUrl}/api/v4/user`;
    const response = await safeFetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`GitLab auth failed: ${response.status}`);

    const user = (await response.json()) as { username: string };
    const config: GitLabConnectionConfig = {
      type: 'pat',
      token,
      baseUrl: normalizedBaseUrl,
      username: user.username
    };
    gitlabConfig = config;

    // `.host` (not `.hostname`) so two self-hosted instances on the same
    // host but different ports don't collapse onto one Keychain account.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-shot URL parse, not reactive state
    const account = buildKeychainAccount(user.username, new URL(normalizedBaseUrl).host);
    let keychainError: string | null = null;
    try {
      await setToken('gitlab', account, token);
    } catch {
      keychainError = KEYCHAIN_SAVE_FAILED;
    }

    // See the matching comment in connectGitHubWithPAT.
    if (!keychainError) {
      const stored: StoredGitLabConnectionConfig = {
        type: 'pat',
        baseUrl: normalizedBaseUrl,
        username: user.username,
        keychainAccount: account
      };
      await setStorageItem(STORAGE_KEYS.GITLAB_CONFIG, stored);
    }

    connectionsState.gitlab = {
      status: 'connected',
      error: keychainError,
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    connectionsState.gitlab = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: null
    };
  }
}

// --- Common ---

export async function disconnectService(service: ServiceId): Promise<void> {
  if (service === 'github') {
    const stored = await getStorageItem<PersistedGitHubConfig>(STORAGE_KEYS.GITHUB_CONFIG);
    if (stored && 'keychainAccount' in stored) {
      // Never block disconnect on the Keychain — a denied prompt here would
      // trap the user in a connection they can't remove.
      await deleteToken('github', stored.keychainAccount).catch(() => {});
    }
    githubConfig = null;
    await removeStorageItem(STORAGE_KEYS.GITHUB_CONFIG);
  } else {
    const stored = await getStorageItem<PersistedGitLabConfig>(STORAGE_KEYS.GITLAB_CONFIG);
    if (stored && 'keychainAccount' in stored) {
      await deleteToken('gitlab', stored.keychainAccount).catch(() => {});
    }
    gitlabConfig = null;
    await removeStorageItem(STORAGE_KEYS.GITLAB_CONFIG);
  }
  connectionsState[service] = createInitialServiceState();
}

export async function initializeConnections(): Promise<void> {
  const storedGitHub = await getStorageItem<PersistedGitHubConfig>(STORAGE_KEYS.GITHUB_CONFIG);
  if (storedGitHub) {
    const token =
      'token' in storedGitHub
        ? storedGitHub.token
        : await getToken('github', storedGitHub.keychainAccount);
    if (token) {
      await connectGitHubWithPAT(token);
    } else {
      connectionsState.github = {
        status: 'error',
        error:
          'GitHub token not found in the Keychain — reconnect to continue receiving notifications.',
        lastChecked: null
      };
    }
  }

  const storedGitLab = await getStorageItem<PersistedGitLabConfig>(STORAGE_KEYS.GITLAB_CONFIG);
  if (storedGitLab) {
    const token =
      'token' in storedGitLab
        ? storedGitLab.token
        : await getToken('gitlab', storedGitLab.keychainAccount);
    if (token) {
      await connectGitLabWithPAT(token, storedGitLab.baseUrl);
    } else {
      connectionsState.gitlab = {
        status: 'error',
        error:
          'GitLab token not found in the Keychain — reconnect to continue receiving notifications.',
        lastChecked: null
      };
    }
  }
}
