import { isTauri } from './storage';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let invokeCache: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (!invokeCache) {
    const { invoke } = await import('@tauri-apps/api/core');
    invokeCache = invoke;
  }
  return invokeCache;
}

async function writeToFile(level: LogLevel, source: string, message: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const invoke = await getInvoke();
    await invoke('write_log', { level, source, message });
  } catch {
    // Logging must never break the app
  }
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`;
      try {
        return JSON.stringify(a, null, 2);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

// ── Public API ──────────────────────────────────────────────────

export function info(source: string, ...args: unknown[]): void {
  writeToFile('INFO', source, formatArgs(args));
}

export function warn(source: string, ...args: unknown[]): void {
  writeToFile('WARN', source, formatArgs(args));
}

export function error(source: string, ...args: unknown[]): void {
  writeToFile('ERROR', source, formatArgs(args));
}

// ── Console interceptor ─────────────────────────────────────────

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

let intercepting = false;

export function startConsoleCapture(): void {
  if (intercepting) return;
  intercepting = true;

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    writeToFile('INFO', 'console', formatArgs(args));
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    writeToFile('WARN', 'console', formatArgs(args));
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    writeToFile('ERROR', 'console', formatArgs(args));
  };
}

export function stopConsoleCapture(): void {
  if (!intercepting) return;
  intercepting = false;
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

// ── Log file helpers ────────────────────────────────────────────

export async function clearLog(): Promise<void> {
  if (!isTauri()) return;
  try {
    const invoke = await getInvoke();
    await invoke('clear_log', {});
  } catch {
    // best-effort
  }
}
