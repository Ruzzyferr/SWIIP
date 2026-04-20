import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colors, spacing, motion } from '../src/tokens';

// ---------------------------------------------------------------------------
// WCAG contrast helpers
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) throw new Error(`Expected a 6-digit hex color, got: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function srgbChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Obsidian Platinum — text contrast on surface.base', () => {
  const bg = colors.surface.base;

  it('text.primary meets AAA (≥ 7:1)', () => {
    const ratio = contrastRatio(colors.text.primary, bg);
    assert.ok(ratio >= 7, `text.primary contrast ${ratio.toFixed(2)}:1 < 7:1`);
  });

  it('text.secondary meets AAA (≥ 7:1)', () => {
    const ratio = contrastRatio(colors.text.secondary, bg);
    assert.ok(ratio >= 7, `text.secondary contrast ${ratio.toFixed(2)}:1 < 7:1`);
  });

  it('text.tertiary meets AA body (≥ 4.5:1)', () => {
    const ratio = contrastRatio(colors.text.tertiary, bg);
    assert.ok(ratio >= 4.5, `text.tertiary contrast ${ratio.toFixed(2)}:1 < 4.5:1`);
  });

  it('accent.primary meets AA large (≥ 3:1) and AAA (≥ 7:1)', () => {
    const ratio = contrastRatio(colors.accent.primary, bg);
    assert.ok(ratio >= 7, `accent.primary contrast ${ratio.toFixed(2)}:1 < 7:1`);
  });
});

describe('Obsidian Platinum — text contrast on surface.elevated', () => {
  const bg = colors.surface.elevated;

  it('text.primary meets AAA (≥ 7:1)', () => {
    const ratio = contrastRatio(colors.text.primary, bg);
    assert.ok(ratio >= 7, `text.primary on elevated contrast ${ratio.toFixed(2)}:1 < 7:1`);
  });

  it('text.secondary meets AA body (≥ 4.5:1)', () => {
    const ratio = contrastRatio(colors.text.secondary, bg);
    assert.ok(
      ratio >= 4.5,
      `text.secondary on elevated contrast ${ratio.toFixed(2)}:1 < 4.5:1`,
    );
  });
});

describe('Obsidian Platinum — text contrast on surface.raised', () => {
  const bg = colors.surface.raised;

  it('text.primary meets AAA (≥ 7:1)', () => {
    const ratio = contrastRatio(colors.text.primary, bg);
    assert.ok(ratio >= 7, `text.primary on raised contrast ${ratio.toFixed(2)}:1 < 7:1`);
  });
});

// ---------------------------------------------------------------------------
// Sanity tests
// ---------------------------------------------------------------------------

describe('Spacing scale', () => {
  it('every entry is a non-negative multiple of 2 pixels', () => {
    for (const [key, value] of Object.entries(spacing)) {
      const px = parseInt(value.replace('px', ''), 10);
      assert.ok(Number.isFinite(px), `${key} -> ${value} is not a px value`);
      assert.ok(px >= 0, `${key} -> ${value} is negative`);
      assert.ok(px % 2 === 0, `${key} -> ${value} is not a multiple of 2`);
    }
  });

  it('includes 4.5 step (18px) for messaging rhythm', () => {
    assert.equal(spacing[4.5], '18px');
  });
});

describe('Motion easing', () => {
  const BEZIER = /^cubic-bezier\(\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*\)$/;

  it('every easing is a valid cubic-bezier or keyword', () => {
    for (const [key, value] of Object.entries(motion.easing)) {
      const isKeyword = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(
        value,
      );
      assert.ok(
        BEZIER.test(value) || isKeyword,
        `easing.${key} -> "${value}" is not a valid cubic-bezier or keyword`,
      );
    }
  });

  it('gravitas is the canonical easing curve', () => {
    assert.equal(motion.easing.gravitas, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
  });
});
