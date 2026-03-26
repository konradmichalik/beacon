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
