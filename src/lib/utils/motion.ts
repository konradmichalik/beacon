import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

const STAGGER_MS = 30;
const MAX_STAGGERED = 7;
const SWIPE_DISTANCE_PX = 36;
const TAB_DIRECTION_MEMORY_MS = 600;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Svelte transitions bypass the CSS reduced-motion rule, so they ask here. */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

export function staggerDelay(index: number): number {
  return motionMs(Math.min(index, MAX_STAGGERED) * STAGGER_MS);
}

// `u` is the progress of the transition from 0 (untouched) to 1 (gone).

export function swipeStyle(u: number, height: number): string {
  const move = Math.min(1, u / 0.55);
  const collapse = Math.max(0, (u - 0.4) / 0.6);
  return `transform: translateX(${move * SWIPE_DISTANCE_PX}px); opacity: ${1 - move}; height: ${height * (1 - collapse)}px; overflow: hidden;`;
}

export function riseStyle(u: number, x: number, y: number): string {
  return `opacity: ${1 - u}; transform: translate(${x * u}px, ${y * u}px);`;
}

export function popStyle(u: number): string {
  return `opacity: ${1 - u}; transform: scale(${1 - 0.04 * u}) translateY(${-4 * u}px);`;
}

// The list slides in from the side the tab change came from. A poll that adds
// rows later must not inherit it, so the direction is forgotten after a moment.
let tabDirection: -1 | 0 | 1 = 0;
let tabDirectionTimer: ReturnType<typeof setTimeout> | null = null;

export function setTabDirection(direction: -1 | 0 | 1): void {
  tabDirection = direction;
  if (tabDirectionTimer) clearTimeout(tabDirectionTimer);
  tabDirectionTimer = setTimeout(() => {
    tabDirection = 0;
    tabDirectionTimer = null;
  }, TAB_DIRECTION_MEMORY_MS);
}

export function currentTabDirection(): -1 | 0 | 1 {
  return tabDirection;
}

/** A row leaving a list: it moves aside and fades, then the gap closes. */
export function swipe(node: HTMLElement, { duration = 360 } = {}): TransitionConfig {
  const height = node.offsetHeight;
  return {
    duration: motionMs(duration),
    easing: cubicOut,
    css: (_t, u) => swipeStyle(u, height)
  };
}

/** A row entering a list: staggered, from the side of a tab change or from below. */
export function rise(node: HTMLElement, { index = 0, duration = 360 } = {}): TransitionConfig {
  const direction = currentTabDirection();
  const x = direction * 16;
  const y = direction === 0 ? 6 : 0;
  return {
    delay: staggerDelay(index),
    duration: motionMs(duration),
    easing: cubicOut,
    css: (_t, u) => riseStyle(u, x, y)
  };
}

/** Menus, popovers and dialogs. */
export function pop(node: HTMLElement, { duration = 200 } = {}): TransitionConfig {
  return {
    duration: motionMs(duration),
    easing: cubicOut,
    css: (_t, u) => popStyle(u)
  };
}
