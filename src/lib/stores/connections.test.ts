import { describe, it, expect, vi, beforeEach } from 'vitest';

const safeFetch = vi.fn();
vi.mock('$lib/utils/fetch', () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }));

const getStorageItem = vi.fn();
const setStorageItem = vi.fn();
const removeStorageItem = vi.fn();
vi.mock('$lib/utils/storage', () => ({
  getStorageItem: (...args: unknown[]) => getStorageItem(...args),
  setStorageItem: (...args: unknown[]) => setStorageItem(...args),
  removeStorageItem: (...args: unknown[]) => removeStorageItem(...args),
  isTauri: () => true
}));

const setToken = vi.fn();
const getToken = vi.fn();
const deleteToken = vi.fn();
vi.mock('$lib/utils/keychain', () => ({
  buildKeychainAccount: (username: string, host: string) => `${username}@${host}`,
  setToken: (...args: unknown[]) => setToken(...args),
  getToken: (...args: unknown[]) => getToken(...args),
  deleteToken: (...args: unknown[]) => deleteToken(...args)
}));

import {
  connectGitHubWithPAT,
  connectGitLabWithPAT,
  disconnectService,
  initializeConnections,
  connectionsState
} from './connections.svelte';

beforeEach(() => {
  safeFetch.mockReset();
  getStorageItem.mockReset().mockResolvedValue(null);
  setStorageItem.mockReset().mockResolvedValue(undefined);
  removeStorageItem.mockReset().mockResolvedValue(undefined);
  setToken.mockReset().mockResolvedValue(undefined);
  getToken.mockReset().mockResolvedValue(null);
  deleteToken.mockReset().mockResolvedValue(undefined);
});

describe('connectGitHubWithPAT', () => {
  it('persists a stored config with no token, keyed by the resolved Keychain account', async () => {
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) });

    await connectGitHubWithPAT('ghp_abc123');

    expect(setToken).toHaveBeenCalledWith('github', 'octocat@github.com', 'ghp_abc123');
    expect(setStorageItem).toHaveBeenCalledWith('github-config', {
      type: 'pat',
      username: 'octocat',
      keychainAccount: 'octocat@github.com'
    });
    expect(connectionsState.github.status).toBe('connected');
    expect(connectionsState.github.error).toBeNull();
  });

  it('stays connected with a warning when the Keychain write fails, and never persists anything', async () => {
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) });
    setToken.mockRejectedValue(new Error('denied'));

    await connectGitHubWithPAT('ghp_abc123');

    expect(connectionsState.github.status).toBe('connected');
    expect(connectionsState.github.error).toMatch(/Keychain/);
    expect(setStorageItem).not.toHaveBeenCalled();
  });
});

describe('connectGitLabWithPAT', () => {
  it('derives the Keychain account host from a self-hosted base URL, not gitlab.com', async () => {
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ username: 'kmichalik' }) });

    await connectGitLabWithPAT('glpat-xyz', 'https://gitlab.example.com');

    expect(setToken).toHaveBeenCalledWith('gitlab', 'kmichalik@gitlab.example.com', 'glpat-xyz');
    expect(setStorageItem).toHaveBeenCalledWith(
      'gitlab-config',
      expect.objectContaining({ keychainAccount: 'kmichalik@gitlab.example.com' })
    );
  });

  it('keeps a non-default port in the Keychain account, so same-host instances on different ports do not collide', async () => {
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ username: 'kmichalik' }) });

    await connectGitLabWithPAT('glpat-a', 'https://gitlab.example.com:8080');
    expect(setToken).toHaveBeenCalledWith('gitlab', 'kmichalik@gitlab.example.com:8080', 'glpat-a');

    await connectGitLabWithPAT('glpat-b', 'https://gitlab.example.com:9090');
    expect(setToken).toHaveBeenCalledWith('gitlab', 'kmichalik@gitlab.example.com:9090', 'glpat-b');
  });
});

describe('initializeConnections', () => {
  it('resolves the token via getToken for an already-migrated config', async () => {
    getStorageItem.mockImplementation(async (key: string) =>
      key === 'github-config'
        ? { type: 'pat', username: 'octocat', keychainAccount: 'octocat@github.com' }
        : null
    );
    getToken.mockResolvedValue('ghp_resolved');
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) });

    await initializeConnections();

    expect(getToken).toHaveBeenCalledWith('github', 'octocat@github.com');
    expect(safeFetch).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({ headers: { Authorization: 'Bearer ghp_resolved' } })
    );
    expect(connectionsState.github.status).toBe('connected');
  });

  it('falls back to an inline legacy token without calling getToken', async () => {
    getStorageItem.mockImplementation(async (key: string) =>
      key === 'github-config' ? { type: 'pat', username: 'octocat', token: 'ghp_legacy' } : null
    );
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) });

    await initializeConnections();

    expect(getToken).not.toHaveBeenCalled();
    expect(safeFetch).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({ headers: { Authorization: 'Bearer ghp_legacy' } })
    );
  });

  it('leaves a legacy config on disk untouched when migrating it to the Keychain fails', async () => {
    getStorageItem.mockImplementation(async (key: string) =>
      key === 'github-config' ? { type: 'pat', username: 'octocat', token: 'ghp_legacy' } : null
    );
    safeFetch.mockResolvedValue({ ok: true, json: async () => ({ login: 'octocat' }) });
    setToken.mockRejectedValue(new Error('denied'));

    await initializeConnections();

    // The still-working legacy token must survive on disk so migration can
    // retry next launch, instead of being replaced by a keychainAccount
    // pointer to a token that was never actually saved.
    expect(setStorageItem).not.toHaveBeenCalled();
    expect(connectionsState.github.status).toBe('connected');
  });

  it('surfaces an error state when neither an inline token nor a Keychain token is available', async () => {
    getStorageItem.mockImplementation(async (key: string) =>
      key === 'github-config'
        ? { type: 'pat', username: 'octocat', keychainAccount: 'octocat@github.com' }
        : null
    );
    getToken.mockResolvedValue(null);

    await initializeConnections();

    expect(safeFetch).not.toHaveBeenCalled();
    expect(connectionsState.github.status).toBe('error');
    expect(connectionsState.github.error).toMatch(/Keychain/);
  });
});

describe('disconnectService', () => {
  it('deletes the Keychain item for the stored account and clears the config', async () => {
    getStorageItem.mockResolvedValue({
      type: 'pat',
      username: 'octocat',
      keychainAccount: 'octocat@github.com'
    });

    await disconnectService('github');

    expect(deleteToken).toHaveBeenCalledWith('github', 'octocat@github.com');
    expect(removeStorageItem).toHaveBeenCalledWith('github-config');
    expect(connectionsState.github.status).toBe('disconnected');
  });

  it('still clears the config when deleteToken rejects', async () => {
    getStorageItem.mockResolvedValue({
      type: 'pat',
      username: 'octocat',
      keychainAccount: 'octocat@github.com'
    });
    deleteToken.mockRejectedValue(new Error('locked'));

    await disconnectService('github');

    expect(removeStorageItem).toHaveBeenCalledWith('github-config');
    expect(connectionsState.github.status).toBe('disconnected');
  });
});
