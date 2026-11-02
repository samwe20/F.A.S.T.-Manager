import { describe, expect, it } from 'vitest';
import { contrast, labelInk } from '../src/utils/color';

describe('labelInk', () => {
  it('keeps a dark type color that already reads on white', () => {
    expect(labelInk('#0f766e')).toBe('#0f766e');
    expect(contrast('#0f766e', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('deepens bright type colors until the label clears the page', () => {
    for (const color of ['#f59e0b', '#eab308', '#10b981', '#8b5cf6', '#ec4899', '#3b82f6']) {
      const ink = labelInk(color);
      expect(contrast(ink, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(ink).not.toBe('#141416');
    }
  });

  it('lightens a dark type color on the dark page', () => {
    const ink = labelInk('#0f766e', '#242426');
    expect(contrast(ink, '#242426')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the chrome gray readable on the light page', () => {
    expect(contrast('#5f646c', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#5f646c', '#f6f6f7')).toBeGreaterThanOrEqual(4.5);
  });
});
