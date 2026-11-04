import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUND_PRESETS, hexTone, resolveBackground } from '../src/core/backgrounds.js';
import { flattenMessages } from '../src/core/i18n.js';
import { messages } from '../src/locales/index.js';

test('there are at least 10 presets with unique keys and a default first', () => {
  assert.ok(BACKGROUND_PRESETS.length >= 10);
  assert.equal(BACKGROUND_PRESETS[0].key, 'default');
  const keys = BACKGROUND_PRESETS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('every preset has a translated name', () => {
  for (const [code, tree] of Object.entries(messages)) {
    const keys = new Set(flattenMessages(tree).keys());
    for (const p of BACKGROUND_PRESETS) assert.ok(keys.has(`background.${p.key}`), `${code}: ${p.key}`);
  }
});

test('resolveBackground finds presets, accepts custom hex, falls back to default', () => {
  assert.equal(resolveBackground({ type: 'gradient', value: 'sky' }).preset?.key, 'sky');
  assert.equal(resolveBackground({ type: 'color', value: '#2f4f3a' }).preset?.key, 'chalk');

  const custom = resolveBackground({ type: 'color', value: '#ffffff' });
  assert.equal(custom.css, '#ffffff');
  assert.equal(custom.preset, null);
  assert.equal(custom.tone, 'light');

  for (const bad of [{ type: 'gradient', value: 'nope' }, { type: 'color', value: 'red' }, null]) {
    const r = resolveBackground(/** @type {any} */ (bad));
    assert.equal(r.preset?.key, 'default');
    assert.equal(r.css, null);
  }
});

test('hexTone separates light and dark colours', () => {
  assert.equal(hexTone('#ffffff'), 'light');
  assert.equal(hexTone('#f7f3e9'), 'light');
  assert.equal(hexTone('#000000'), 'dark');
  assert.equal(hexTone('#2f4f3a'), 'dark');
});
