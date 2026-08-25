import type { NotificationType, UnifiedNotification } from '$lib/types';

export type FilterTokenKind = 'repo' | 'org' | 'author' | 'type' | 'text';

export interface FilterToken {
  readonly negate: boolean;
  readonly kind: FilterTokenKind;
  readonly value: string;
}

const TYPE_ALIASES: Record<string, NotificationType> = {
  pr: 'pull_request',
  mr: 'merge_request',
  issue: 'issue',
  pull_request: 'pull_request',
  merge_request: 'merge_request',
  review: 'review',
  pipeline: 'pipeline',
  release: 'release',
  discussion: 'discussion',
  other: 'other'
};

const QUALIFIER_KINDS = new Set<FilterTokenKind>(['repo', 'org', 'author', 'type']);

function toToken(raw: string): FilterToken {
  const negate = raw.startsWith('-');
  const body = negate ? raw.slice(1) : raw;
  const separatorIndex = body.indexOf(':');

  if (separatorIndex > 0) {
    const key = body.slice(0, separatorIndex).toLowerCase();
    const value = body.slice(separatorIndex + 1);
    if (QUALIFIER_KINDS.has(key as FilterTokenKind) && value.length > 0) {
      return { negate, kind: key as FilterTokenKind, value };
    }
  }

  return { negate, kind: 'text', value: body };
}

export function parseFilterQuery(query: string): FilterToken[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((raw) => raw.length > 0)
    .map(toToken);
}

function matchesToken(notification: UnifiedNotification, token: FilterToken): boolean {
  const value = token.value.toLowerCase();

  switch (token.kind) {
    case 'repo':
      return notification.repository.toLowerCase() === value;
    case 'org':
      return notification.repository.toLowerCase().split('/')[0] === value;
    case 'author':
      return notification.author !== null && notification.author.login.toLowerCase() === value;
    case 'type':
      return notification.type === TYPE_ALIASES[value];
    case 'text':
      return notification.title.toLowerCase().includes(value);
  }
}

export function matchesFilterTokens(
  notification: UnifiedNotification,
  tokens: readonly FilterToken[]
): boolean {
  return tokens.every((token) => {
    const isMatch = matchesToken(notification, token);
    return token.negate ? !isMatch : isMatch;
  });
}

export function filterByQuery(
  notifications: readonly UnifiedNotification[],
  query: string
): UnifiedNotification[] {
  const tokens = parseFilterQuery(query);
  if (tokens.length === 0) return [...notifications];
  return notifications.filter((n) => matchesFilterTokens(n, tokens));
}
