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

// Credential shapes that must never be persisted to the debug log, in case a
// token ever ends up in a logged value (e.g. a stray `console.log(config)`).
const SECRET_PATTERNS: readonly RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /gh[posu]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /glpat-[A-Za-z0-9_-]{20,}/g
];

/** Replace anything that looks like a token with a placeholder. */
export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), text);
}

function formatArgs(args: unknown[]): string {
  const joined = args
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
  return redact(joined);
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
