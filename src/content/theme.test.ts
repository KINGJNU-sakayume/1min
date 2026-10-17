import { describe, expect, it } from 'vitest';
import { loadContent } from './load';

/** WCAG 대비 (brand-and-tone §3.3: 텍스트 4.5:1 이상) */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('테마 대비', () => {
  for (const theme of loadContent().themes.values()) {
    const c = theme.colors;
    it.each([
      ['primaryInk on primary', c.primaryInk, c.primary],
      ['ink on surface', c.ink, c.surface],
      ['ink on paper', c.ink, c.paper],
      ['muted on paper', c.muted, c.paper],
      ['muted on surface', c.muted, c.surface],
      ['danger on paper', c.danger, c.paper],
      ['primary on paper', c.primary, c.paper],
    ])(`${theme.id}: %s ≥ 4.5`, (_n, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
