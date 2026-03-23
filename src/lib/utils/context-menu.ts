const MENU_WIDTH = 160;

export function clampMenuPosition(event: MouseEvent, menuHeight: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(event.clientX, window.innerWidth - MENU_WIDTH)),
    y: Math.max(0, Math.min(event.clientY, window.innerHeight - menuHeight))
  };
}
