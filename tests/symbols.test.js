import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRID_COLUMNS,
  MAX_LABEL_LENGTH,
  SYMBOLS,
  createSymbolsState,
  displaySymbol,
  moveIndex,
  setLabel,
  setSymbol,
} from '../src/widgets/symbols/symbols-logic.js';
import symbols from '../src/widgets/symbols/index.js';
import { validateWidgetDefinition } from '../src/core/registry.js';
import { flattenMessages } from '../src/core/i18n.js';
import { messages } from '../src/locales/index.js';

const sprite = readFileSync(new URL('../assets/symbols.svg', import.meta.url), 'utf8');

test('symbols: 12 symbols, valid widget definition', () => {
  assert.equal(SYMBOLS.length, 12);
  assert.equal(new Set(SYMBOLS).size, 12);
  assert.deepEqual(validateWidgetDefinition(symbols), []);
  assert.deepEqual(createSymbolsState(), { symbol: 'quiet', label: '' });
});

test('symbols: every symbol has a sprite entry, sprite has no extras and no inline style (CSP)', () => {
  const ids = [...sprite.matchAll(/<symbol id="sym-([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...ids].sort(), [...SYMBOLS].sort());
  assert.ok(!/style=/.test(sprite), 'no inline style attributes');
  assert.ok(!/<script/i.test(sprite));
  for (const block of sprite.split('<symbol').slice(1)) assert.match(block, /viewBox="0 0 48 48"/);
});

test('symbols: names exist in every locale', () => {
  for (const [locale, dict] of Object.entries(messages)) {
    const flat = flattenMessages(dict);
    for (const key of SYMBOLS) assert.ok(flat.get(`widget.symbols.name.${key}`), `${locale}: ${key}`);
    for (const k of ['title', 'change', 'pick', 'label', 'labelHint']) assert.ok(flat.get(`widget.symbols.${k}`), `${locale}: ${k}`);
  }
});

test('symbols: setSymbol clears custom label, ignores unknown or same symbol', () => {
  const s = { symbol: 'quiet', label: 'Shh' };
  assert.deepEqual(setSymbol(s, 'pair'), { symbol: 'pair', label: '' });
  assert.equal(setSymbol(s, 'quiet'), s);
  assert.equal(setSymbol(s, 'dance'), s);
});

test('symbols: setLabel trims to max length and keeps identity when unchanged', () => {
  const s = createSymbolsState();
  assert.equal(setLabel(s, '').label, '');
  assert.equal(setLabel(s, ''), s);
  assert.equal(setLabel(s, 'x'.repeat(100)).label.length, MAX_LABEL_LENGTH);
});

test('symbols: displaySymbol falls back for unknown data', () => {
  assert.equal(displaySymbol({ symbol: 'read', label: '' }), 'read');
  assert.equal(displaySymbol({ symbol: 'from-the-future', label: '' }), 'quiet');
  assert.equal(displaySymbol(/** @type {any} */ (null)), 'quiet');
});

test('symbols: grid keyboard movement stays inside the grid', () => {
  assert.equal(GRID_COLUMNS, 4);
  assert.equal(moveIndex(0, 'ArrowRight'), 1);
  assert.equal(moveIndex(0, 'ArrowLeft'), 0);
  assert.equal(moveIndex(1, 'ArrowDown'), 5);
  assert.equal(moveIndex(9, 'ArrowDown'), 9);
  assert.equal(moveIndex(5, 'ArrowUp'), 1);
  assert.equal(moveIndex(6, 'Home'), 0);
  assert.equal(moveIndex(0, 'End'), 11);
  assert.equal(moveIndex(3, 'Enter'), 3);
});
