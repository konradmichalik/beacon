import type { UnifiedIssue } from '$lib/types';

const now = new Date();
const ago = (minutes: number): string => new Date(now.getTime() - minutes * 60_000).toISOString();

export const demoIssues: readonly UnifiedIssue[] = [
  {
    id: 'github-issue-demo-1',
    source: 'github',
    title: 'Dashboard charts flicker on initial load',
    repository: 'acme/frontend',
    url: 'https://github.com/acme/frontend/issues/1204',
    number: 1204,
    author: { login: 'you', avatarUrl: '' },
    createdAt: ago(180),
    updatedAt: ago(5),
    role: 'authored',
    labels: ['bug', 'frontend'],
    commentsCount: 4
  },
  {
    id: 'gitlab-issue-demo-2',
    source: 'gitlab',
    title: 'Investigate elevated latency on ingestion endpoint',
    repository: 'platform/data-layer',
    url: 'https://gitlab.com/platform/data-layer/-/issues/342',
    number: 342,
    author: { login: 'you', avatarUrl: '' },
    createdAt: ago(600),
    updatedAt: ago(45),
    role: 'authored',
    labels: ['performance'],
    commentsCount: 2
  },
  {
    id: 'github-issue-demo-3',
    source: 'github',
    title: 'Add retry-with-backoff to webhook delivery',
    repository: 'acme/api-gateway',
    url: 'https://github.com/acme/api-gateway/issues/889',
    number: 889,
    author: { login: 'sarah-chen', avatarUrl: '' },
    createdAt: ago(1440),
    updatedAt: ago(90),
    role: 'assigned',
    labels: ['enhancement', 'reliability'],
    commentsCount: 7
  },
  {
    id: 'gitlab-issue-demo-4',
    source: 'gitlab',
    title: 'Document new tracing configuration options',
    repository: 'platform/event-bus',
    url: 'https://gitlab.com/platform/event-bus/-/issues/56',
    number: 56,
    author: { login: 'mwilliams', avatarUrl: '' },
    createdAt: ago(2880),
    updatedAt: ago(300),
    role: 'assigned',
    labels: ['docs'],
    commentsCount: 0
  }
];
