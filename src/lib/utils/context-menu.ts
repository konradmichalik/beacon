export interface MenuAction {
  readonly label: string;
  readonly onclick: () => void;
  readonly hint?: string;
  readonly title?: string;
}

export type MenuEntry = MenuAction | 'divider';

export const MENU_WIDTH = 268;
const ITEM_HEIGHT = 28;
const DIVIDER_HEIGHT = 9;
const MENU_PADDING = 8;

export function menuSize(entries: readonly MenuEntry[]): { width: number; height: number } {
  const rows = entries.reduce(
    (sum, entry) => sum + (entry === 'divider' ? DIVIDER_HEIGHT : ITEM_HEIGHT),
    0
  );
  return { width: MENU_WIDTH, height: rows + MENU_PADDING };
}

export function clampMenuPosition(
  event: MouseEvent,
  menuSize: { width: number; height: number }
): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - menuSize.width);
  const maxY = Math.max(0, window.innerHeight - menuSize.height);

  return {
    x: Math.max(0, Math.min(event.clientX, maxX)),
    y: Math.max(0, Math.min(event.clientY, maxY))
  };
}

export function menuPositionFromElement(
  rect: DOMRect,
  menuSize: { width: number; height: number }
): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - menuSize.width);
  const maxY = Math.max(0, window.innerHeight - menuSize.height);

  return {
    x: Math.max(0, Math.min(rect.left + 16, maxX)),
    y: Math.max(0, Math.min(rect.bottom, maxY))
  };
}
