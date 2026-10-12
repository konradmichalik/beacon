import type { Component } from 'svelte';
import {
  AlertTriangle,
  AtSign,
  Bell,
  CircleCheck,
  CircleCheckBig,
  CircleX,
  Eye,
  FileEdit,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader,
  MessageSquare,
  PenLine,
  ShieldCheck,
  TrainFront,
  UserCheck,
  UserPlus,
  Users
} from '@lucide/svelte';
import type { RowIcon } from '$lib/utils/row-chips';

export const ROW_ICONS: Record<RowIcon, Component<{ size?: number; class?: string }>> = {
  merge: GitMerge,
  eye: Eye,
  at: AtSign,
  pen: PenLine,
  x: CircleX,
  check: CircleCheck,
  'check-big': CircleCheckBig,
  shield: ShieldCheck,
  message: MessageSquare,
  'user-check': UserCheck,
  users: Users,
  bell: Bell,
  'file-edit': FileEdit,
  alert: AlertTriangle,
  train: TrainFront,
  'user-plus': UserPlus,
  'pull-request': GitPullRequest,
  loader: Loader,
  branch: GitBranch
};
