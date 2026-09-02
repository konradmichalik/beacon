export type ExportViewState = 'ok' | 'warn' | 'critical' | 'idle';

export interface ExportView {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly progress?: number;
  readonly state?: ExportViewState;
  readonly trend?: readonly number[];
}

export interface ExportSnapshotV1 {
  readonly schemaVersion: 1;
  readonly app: string;
  readonly displayName: string;
  readonly updatedAt: string;
  readonly ttlSeconds: number;
  readonly views: readonly ExportView[];
}
