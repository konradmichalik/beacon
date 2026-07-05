import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl } from './open-url';

describe('isSafeExternalUrl', () => {
  it('accepts https and http URLs', () => {
    expect(isSafeExternalUrl('https://github.com/owner/repo/pull/1')).toBe(true);
    expect(isSafeExternalUrl('http://localhost:8080/path')).toBe(true);
  });

  it('rejects file: URLs', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects custom schemes', () => {
    expect(isSafeExternalUrl('beacon://open')).toBe(false);
    expect(isSafeExternalUrl('vscode://file/x')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
  });
});
