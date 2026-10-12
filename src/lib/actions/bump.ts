import { motionMs } from '$lib/utils/motion';

const SWELL_MS = 180;

/** Makes an element swell once whenever the value it shows changes. */
export function bump(node: HTMLElement, value: unknown): { update(next: unknown): void } {
  let last = value;
  return {
    update(next) {
      if (next === last) return;
      last = next;
      const duration = motionMs(SWELL_MS);
      if (duration === 0) return;
      node.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
        { duration, easing: 'ease-out' }
      );
    }
  };
}
