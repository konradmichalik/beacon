export type LogoMotion = 'open' | 'pulse';

// The animation class has to be removed for a frame before it can play again.
const RESTART_GAP_MS = 30;

let kind: LogoMotion | null = $state(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export const logoMotion = {
  get kind() {
    return kind;
  }
};

export function playLogo(next: LogoMotion): void {
  if (timer) clearTimeout(timer);
  kind = null;
  timer = setTimeout(() => {
    kind = next;
    timer = null;
  }, RESTART_GAP_MS);
}
