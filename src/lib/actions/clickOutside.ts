export function clickOutside(node: HTMLElement, callback: () => void) {
  function handler(event: PointerEvent) {
    if (!node.contains(event.target as Node)) {
      callback();
    }
  }

  document.addEventListener('pointerdown', handler, true);

  return {
    destroy() {
      document.removeEventListener('pointerdown', handler, true);
    }
  };
}
