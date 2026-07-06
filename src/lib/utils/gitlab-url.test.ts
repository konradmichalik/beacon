import { describe, it, expect } from 'vitest';
import { normalizeGitLabBaseUrl } from './gitlab-url';

describe('normalizeGitLabBaseUrl', () => {
  it('accepts and returns a plain https URL unchanged', () => {
    expect(normalizeGitLabBaseUrl('https://gitlab.com')).toBe('https://gitlab.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeGitLabBaseUrl('  https://gitlab.com  ')).toBe('https://gitlab.com');
  });

  it('strips a trailing slash', () => {
    expect(normalizeGitLabBaseUrl('https://gitlab.com/')).toBe('https://gitlab.com');
  });

  it('preserves a sub-path but drops its trailing slash', () => {
    expect(normalizeGitLabBaseUrl('https://example.com/gitlab/')).toBe(
      'https://example.com/gitlab'
    );
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeGitLabBaseUrl('https://example.com/gitlab//')).toBe(
      'https://example.com/gitlab'
    );
  });

  it('drops query string and hash', () => {
    expect(normalizeGitLabBaseUrl('https://gitlab.com/?foo=bar#x')).toBe('https://gitlab.com');
  });

  it('rejects plaintext http for a remote host', () => {
    expect(() => normalizeGitLabBaseUrl('http://gitlab.example.com')).toThrow(/HTTPS/);
  });

  it('allows http for localhost', () => {
    expect(normalizeGitLabBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });

  it('allows http for 127.0.0.1', () => {
    expect(normalizeGitLabBaseUrl('http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000');
  });

  it('rejects a non-URL string', () => {
    expect(() => normalizeGitLabBaseUrl('not a url')).toThrow(/valid GitLab URL/);
  });

  it('rejects an empty string', () => {
    expect(() => normalizeGitLabBaseUrl('   ')).toThrow(/required/);
  });

  it('rejects a non-http(s) scheme', () => {
    expect(() => normalizeGitLabBaseUrl('ftp://gitlab.com')).toThrow(/HTTPS/);
    expect(() => normalizeGitLabBaseUrl('file:///etc/passwd')).toThrow(/HTTPS/);
  });
});
