import { describe, it, expect } from 'vitest';
import { menuSize, MENU_WIDTH, type MenuEntry } from './context-menu';

const action = (label: string): MenuEntry => ({ label, onclick: () => {} });

describe('menuSize', () => {
  it('uses the fixed menu width', () => {
    expect(menuSize([action('Open')]).width).toBe(MENU_WIDTH);
  });

  it('adds one row per action plus the menu padding', () => {
    expect(menuSize([action('Open')]).height).toBe(28 + 8);
    expect(menuSize([action('Open'), action('Copy link')]).height).toBe(56 + 8);
  });

  it('counts a divider as a thin row', () => {
    const entries: MenuEntry[] = [action('Open'), 'divider', action('Mark as read')];
    expect(menuSize(entries).height).toBe(56 + 9 + 8);
  });

  it('is empty-safe', () => {
    expect(menuSize([]).height).toBe(8);
  });
});
