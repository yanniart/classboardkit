import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_GRAPHIC, MIN_TEXT, contrastRatio, luminance, parseHex } from '../src/core/contrast.js';

const css = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SOURCES = [css('src/styles/tokens.css'), css('src/styles/widgets.css')].join('\n');

/**
 * 선택자가 정확히 일치하는 블록들의 `--이름: #hex` 변수를 모은다 (주석 제거, 중첩 @media 안도 포함)
 * @param {string} selector
 */
function vars(selector) {
  const text = SOURCES.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const sels = m[1].split(',').map((s) => s.trim().replace(/^@media[^{]*$/, ''));
    if (!sels.includes(selector)) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out[d[1]] = d[2].toLowerCase();
  }
  return out;
}

const light = vars(':root');
const dark = { ...light, ...vars(":root[data-theme='dark']") };
const contrast = { ...light, ...vars(":root[data-theme='contrast']") };
const THEMES = { light, dark, contrast };
const TEAMS = ['red', 'blue', 'green', 'orange', 'purple', 'teal', 'pink', 'yellow'];

test('contrast: math matches WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrastRatio('#777777', '#ffffff').toFixed(2), '4.48');
  assert.equal(luminance('#ffffff'), 1);
  assert.deepEqual(parseHex('#2f6fdc'), [47, 111, 220]);
  assert.throws(() => parseHex('red'));
});

test('contrast: system dark tokens equal explicit dark theme', () => {
  const system = vars(":root:not([data-theme])");
  for (const [k, v] of Object.entries(system)) assert.equal(dark[k], v, k);
  assert.ok(Object.keys(system).length > 10);
});

for (const [name, t] of Object.entries(THEMES)) {
  test(`contrast (${name}): app text, muted text, accent, danger, focus`, () => {
    const check = (fg, bg, min, label) => {
      const r = contrastRatio(t[fg], t[bg]);
      assert.ok(r >= min, `${name} ${label ?? `${fg} on ${bg}`}: ${r.toFixed(2)} < ${min}`);
    };
    for (const bg of ['--color-surface', '--color-surface-muted', '--color-bg']) {
      check('--color-text', bg, MIN_TEXT);
      check('--color-text-muted', bg, MIN_TEXT);
      check('--color-focus', bg, MIN_GRAPHIC);
    }
    check('--color-accent-contrast', '--color-accent', MIN_TEXT);
    check('--color-danger', '--color-surface', MIN_TEXT);
    check('--color-accent', '--color-surface', MIN_GRAPHIC);
  });

  test(`contrast (${name}): team colors — text 4.5:1, graphics 3:1 on widget backgrounds`, () => {
    for (const c of TEAMS) {
      for (const bg of ['--color-surface', '--color-surface-muted']) {
        const text = contrastRatio(t[`--team-${c}-text`], t[bg]);
        const graphic = contrastRatio(t[`--team-${c}`], t[bg]);
        assert.ok(text >= MIN_TEXT, `${name} --team-${c}-text on ${bg}: ${text.toFixed(2)}`);
        assert.ok(graphic >= MIN_GRAPHIC, `${name} --team-${c} on ${bg}: ${graphic.toFixed(2)}`);
      }
    }
  });
}
