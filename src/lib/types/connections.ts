export type ServiceId = 'github' | 'gitlab';

export interface GitHubConnectionConfig {
  readonly type: 'pat';
  readonly token: string;
  readonly username: string;
}

export interface GitLabConnectionConfig {
  readonly type: 'pat';
  readonly token: string;
  readonly baseUrl: string;
  readonly username: string;
}

export type ConnectionConfig = GitHubConnectionConfig | GitLabConnectionConfig;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServiceState {
  readonly status: ConnectionStatus;
  readonly error: string | null;
  readonly lastChecked: string | null;
}

export interface AllConnectionsState {
  github: ServiceState;
  gitlab: ServiceState;
}

export type PlatformStatusIndicator = 'ok' | 'degraded' | 'down';

export interface PlatformStatus {
  readonly indicator: PlatformStatusIndicator;
  readonly description: string;
}
