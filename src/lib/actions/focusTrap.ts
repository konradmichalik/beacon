const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function focusTrap(node: HTMLElement): { destroy(): void } {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  function getFocusable(): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    const elements = getFocusable();
    if (elements.length === 0) return;

    const first = elements[0];
    const last = elements[elements.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  node.addEventListener('keydown', handleKeydown);

  // Focus first focusable element on mount
  requestAnimationFrame(() => {
    const elements = getFocusable();
    if (elements.length > 0) {
      elements[0].focus();
    }
  });

  return {
    destroy() {
      node.removeEventListener('keydown', handleKeydown);
      previouslyFocused?.focus();
    }
  };
}
