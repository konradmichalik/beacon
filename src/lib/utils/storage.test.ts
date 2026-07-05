import { describe, it, expect } from 'vitest';
import { isSensitiveStorageKey } from './storage';

describe('isSensitiveStorageKey', () => {
  it('flags the token-bearing config keys', () => {
    expect(isSensitiveStorageKey('github-config')).toBe(true);
    expect(isSensitiveStorageKey('gitlab-config')).toBe(true);
  });

  it('does not flag non-sensitive keys', () => {
    expect(isSensitiveStorageKey('settings')).toBe(false);
    expect(isSensitiveStorageKey('mute-rules')).toBe(false);
    expect(isSensitiveStorageKey('starred-prs')).toBe(false);
    expect(isSensitiveStorageKey('')).toBe(false);
  });
});
