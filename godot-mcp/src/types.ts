export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  source: 'Editor' | 'Game';
}

export interface RuntimeError {
  timestamp: string;
  type: string;
  message: string;
  file: string;
  line: number;
  stackTrace: string[];
}

export interface GameStatus {
  status: 'running' | 'stopped' | 'starting';
  pid: number | null;
  startTime: string | null;
}

export interface GetLogsParams {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  limit?: number;
  offset?: number;
}

export interface RunGameParams {
  scene_path?: string;
}

export interface GetRuntimeErrorsParams {
  clear?: boolean;
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
