import { describe, it, expect, vi, afterEach } from 'vitest';
import { bump } from './bump';

function fakeNode() {
  return { animate: vi.fn() } as unknown as HTMLElement & { animate: ReturnType<typeof vi.fn> };
}

function allowMotion(): void {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bump', () => {
  it('does not animate when it is first applied', () => {
    allowMotion();
    const node = fakeNode();
    bump(node, 5);
    expect(node.animate).not.toHaveBeenCalled();
  });

  it('swells once when the value changes', () => {
    allowMotion();
    const node = fakeNode();
    const action = bump(node, 5);
    action.update(6);
    expect(node.animate).toHaveBeenCalledTimes(1);
    const [frames, options] = node.animate.mock.calls[0];
    expect(frames).toEqual([
      { transform: 'scale(1)' },
      { transform: 'scale(1.25)' },
      { transform: 'scale(1)' }
    ]);
    expect(options).toMatchObject({ duration: 180 });
  });

  it('stays still when the value is unchanged', () => {
    allowMotion();
    const node = fakeNode();
    const action = bump(node, 5);
    action.update(5);
    expect(node.animate).not.toHaveBeenCalled();
  });

  it('stays still under Reduce Motion', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query.includes('reduce') })
    });
    const node = fakeNode();
    const action = bump(node, 5);
    action.update(6);
    expect(node.animate).not.toHaveBeenCalled();
  });
});
