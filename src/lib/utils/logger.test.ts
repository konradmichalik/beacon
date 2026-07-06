import { describe, it, expect } from 'vitest';
import { redact } from './logger';

describe('redact', () => {
  it('redacts an Authorization bearer token', () => {
    expect(redact('Authorization: Bearer ghp_ABCdef0123456789ABCdef0123456789')).toBe(
      'Authorization: [REDACTED]'
    );
  });

  it('redacts a GitHub classic PAT', () => {
    const out = redact('token is ghp_ABCdef0123456789ABCdef0123456789 here');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('ghp_ABCdef');
  });

  it('redacts a GitHub fine-grained PAT', () => {
    const out = redact('github_pat_11ABCDEFG0abcdefghij_KLMNOPqrstuvwx');
    expect(out).toBe('[REDACTED]');
  });

  it('redacts a GitLab PAT', () => {
    const out = redact('using glpat-abcdefghij0123456789 now');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('glpat-abcdef');
  });

  it('leaves ordinary log text unchanged', () => {
    const text = 'fetching notifications since 2026-01-01T00:00:00Z (HTTP 200)';
    expect(redact(text)).toBe(text);
  });

  it('redacts multiple secrets in one string', () => {
    const out = redact('a ghp_ABCdef0123456789ABCdef0123456789 b glpat-abcdefghij0123456789 c');
    expect(out).toBe('a [REDACTED] b [REDACTED] c');
  });
});
