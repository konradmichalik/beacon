import { safeFetch } from '$lib/utils/fetch';
import type {
  AllConnectionsState,
  ServiceState,
  GitHubConnectionConfig,
  GitLabConnectionConfig,
  ServiceId
} from '$lib/types';
import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/utils/storage';

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

export function hasAnyServiceConfigured(): boolean {
  return (
    connectionsState.github.status === 'connected' || connectionsState.gitlab.status === 'connected'
  );
}

export function isServiceConnected(service: ServiceId): boolean {
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
    await setStorageItem(STORAGE_KEYS.GITHUB_CONFIG, config);
    connectionsState.github = {
      status: 'connected',
      error: null,
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
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v4/user`;
    const response = await safeFetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`GitLab auth failed: ${response.status}`);

    const user = (await response.json()) as { username: string };
    const config: GitLabConnectionConfig = { type: 'pat', token, baseUrl, username: user.username };
    gitlabConfig = config;
    await setStorageItem(STORAGE_KEYS.GITLAB_CONFIG, config);
    connectionsState.gitlab = {
      status: 'connected',
      error: null,
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
    githubConfig = null;
    await removeStorageItem(STORAGE_KEYS.GITHUB_CONFIG);
  } else {
    gitlabConfig = null;
    await removeStorageItem(STORAGE_KEYS.GITLAB_CONFIG);
  }
  connectionsState[service] = createInitialServiceState();
}

export async function initializeConnections(): Promise<void> {
  const storedGitHub = await getStorageItem<GitHubConnectionConfig>(STORAGE_KEYS.GITHUB_CONFIG);
  if (storedGitHub) {
    await connectGitHubWithPAT(storedGitHub.token);
  }

  const storedGitLab = await getStorageItem<GitLabConnectionConfig>(STORAGE_KEYS.GITLAB_CONFIG);
  if (storedGitLab) {
    await connectGitLabWithPAT(storedGitLab.token, storedGitLab.baseUrl);
  }
}
