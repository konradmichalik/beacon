let message: string | null = $state(null);
let leaving = $state(false);
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;

export const toastState = {
  get message() {
    return message;
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

export function showToast(text: string, duration = 2000): void {
  clearTimers();
  leaving = false;
  message = text;
  hideTimer = setTimeout(() => {
    leaving = true;
    removeTimer = setTimeout(() => {
      message = null;
      leaving = false;
    }, 200);
  }, duration);
}

export function dismissToast(): void {
  clearTimers();
  leaving = true;
  removeTimer = setTimeout(() => {
    message = null;
    leaving = false;
  }, 200);
}
