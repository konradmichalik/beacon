export interface ToastAction {
  readonly label: string;
  readonly onAction: () => void;
}

export interface ToastOptions {
  readonly duration?: number;
  readonly action?: ToastAction;
}

const DEFAULT_DURATION_MS = 3600;
const LEAVE_MS = 200;

let message: string | null = $state(null);
let action: ToastAction | null = $state(null);
let leaving = $state(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;

export const toastState = {
  get message() {
    return message;
  },
  get action() {
    return action;
  },
  get leaving() {
    return leaving;
  }
};

function clearTimers(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (removeTimer) {
    clearTimeout(removeTimer);
    removeTimer = null;
  }
}

function remove(): void {
  message = null;
  action = null;
  leaving = false;
}

export function showToast(text: string, options: ToastOptions = {}): void {
  clearTimers();
  leaving = false;
  message = text;
  action = options.action ?? null;
  hideTimer = setTimeout(dismissToast, options.duration ?? DEFAULT_DURATION_MS);
}

export function dismissToast(): void {
  clearTimers();
  leaving = true;
  removeTimer = setTimeout(remove, LEAVE_MS);
}

/** Runs the toast's action, if it has one, and closes the toast. */
export function runToastAction(): void {
  const current = action;
  if (!current) return;
  current.onAction();
  dismissToast();
}
