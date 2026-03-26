const DEFAULT_SELECTOR = '[data-roving-item]';

export function roving(
  node: HTMLElement,
  options?: { itemSelector?: string }
): { destroy(): void } {
  const selector = options?.itemSelector ?? DEFAULT_SELECTOR;

  function getItems(): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>(selector));
  }

  function updateTabindices(active: HTMLElement): void {
    for (const item of getItems()) {
      item.setAttribute('tabindex', item === active ? '0' : '-1');
    }
  }

  function initItems(): void {
    const items = getItems();
    if (items.length === 0) return;
    const current = items.find((el) => el.getAttribute('tabindex') === '0') ?? items[0];
    updateTabindices(current);
  }

  function handleKeydown(e: KeyboardEvent): void {
    const items = getItems();
    if (items.length === 0) return;

    const current = document.activeElement as HTMLElement;
    const index = items.indexOf(current);
    if (index === -1) return;

    let next: HTMLElement | undefined;

    switch (e.key) {
      case 'ArrowDown':
        next = items[(index + 1) % items.length];
        break;
      case 'ArrowUp':
        next = items[(index - 1 + items.length) % items.length];
        break;
      case 'Home':
        next = items[0];
        break;
      case 'End':
        next = items[items.length - 1];
        break;
      default:
        return;
    }

    e.preventDefault();
    updateTabindices(next);
    next.focus();
  }

  node.addEventListener('keydown', handleKeydown);
  initItems();

  const observer = new MutationObserver(() => initItems());
  observer.observe(node, { childList: true, subtree: true });

  return {
    destroy() {
      node.removeEventListener('keydown', handleKeydown);
      observer.disconnect();
    }
  };
}
