import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE, TEXT_PAIRS } from '../lib/palette.js';
import { contrast } from '../scripts/contrast-check.mjs';
import { UI } from '../i18n/ui.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

const toHex = (triplet) =>
  '#' + triplet.split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();

// Reads the first block that starts with a selector, so light and dark values can be compared.
function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--c-([a-z-]+):\s*([\d\s]+);/g)].map((m) => [m[1], toHex(m[2].trim())]));
}

const light = tokens(':root');
const dark = tokens(':root[data-theme="dark"]');

describe('design tokens', () => {
  it('the light theme matches lib/palette.js exactly', () => {
    expect(light.paper).toBe(PALETTE.paper);
    expect(light.ink).toBe(PALETTE.ink);
    expect(light.sapphire).toBe(PALETTE.sapphire);
    expect(light['sapphire-deep']).toBe(PALETTE.sapphireDeep);
    expect(light['on-sapphire']).toBe(PALETTE.onSapphire);
    expect(light.gold).toBe(PALETTE.gold);
    expect(light['gold-soft']).toBe(PALETTE.goldSoft);
    expect(light['on-gold']).toBe(PALETTE.onGold);
  });

  it('the dark theme defines every token the light theme defines', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('light and dark text pairs used by components meet WCAG 2.2 AA (4.5:1)', () => {
    const pairs = [
      ['ink', 'paper'],
      ['sapphire', 'paper'],
      ['on-sapphire', 'sapphire'],
      ['on-gold', 'gold'],
      ['on-gold', 'gold-soft'],
      ['ink', 'paper'],
    ];
    for (const theme of [light, dark]) {
      for (const [fg, bg] of pairs) {
        const ratio = contrast(theme[fg], theme[bg]);
        expect(ratio, `${fg} on ${bg}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('the existing light text pairs still pass', () => {
    for (const [a, b] of TEXT_PAIRS) {
      expect(contrast(PALETTE[a], PALETTE[b])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('components use tokens, never raw colours', () => {
  it('no component file contains a hex colour', () => {
    const dir = path.join(root, 'components');
    const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.jsx'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
    }
  });
});

describe('design-system labels', () => {
  it('every interface label exists in both languages and Bangla is written in Bangla', () => {
    expect(UI.en.aiBadge).toBe('AM');
    expect(UI.bn.aiBadge).toBe('AM');
    for (const state of ['done', 'missed', 'skipped', 'draft', 'review', 'published', 'archived']) {
      expect(UI.en.status[state]).toBeTruthy();
      expect(/[\u0980-\u09FF]/.test(UI.bn.status[state])).toBe(true);
    }
  });
});
