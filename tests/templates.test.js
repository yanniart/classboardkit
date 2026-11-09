import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/templates/index.js';
import {
  TEMPLATE_BOTTOM_RESERVED,
  TEMPLATE_TOP_RESERVED,
  createBoardFromTemplate,
} from '../src/core/templates.js';
import { createDefaultRegistry } from '../src/widgets/index.js';
import { validateBoard } from '../src/core/schema.js';
import { BACKGROUND_PRESETS } from '../src/core/backgrounds.js';
import { createI18n, flattenMessages } from '../src/core/i18n.js';
import { messages } from '../src/locales/index.js';

const registry = createDefaultRegistry();
const i18nFor = (locale) => createI18n({ messages, locale, fallback: 'en' });

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('templates: 6 templates with unique ids and 3–5 widgets each', () => {
  assert.equal(TEMPLATES.length, 6);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, 6);
  for (const tpl of TEMPLATES) {
    assert.ok(tpl.widgets.length >= 3 && tpl.widgets.length <= 5, tpl.id);
    assert.ok(BACKGROUND_PRESETS.some((p) => p.key === tpl.background), `${tpl.id} background`);
  }
});

test('templates: only registered widget types, rect within free area, size ≥ minSize, no overlap', () => {
  for (const tpl of TEMPLATES) {
    const rects = tpl.widgets.map(({ type, rect: [x, y, w, h] }) => {
      const def = registry.get(type);
      assert.ok(def, `${tpl.id}: unknown type ${type}`);
      assert.ok(x >= 0 && x + w <= 1, `${tpl.id}/${type} x`);
      assert.ok(y >= TEMPLATE_TOP_RESERVED, `${tpl.id}/${type} top`);
      assert.ok(y + h <= 1 - TEMPLATE_BOTTOM_RESERVED + 1e-9, `${tpl.id}/${type} bottom (dock)`);
      assert.ok(w >= def.minSize.w && h >= def.minSize.h, `${tpl.id}/${type} minSize`);
      return { x, y, w, h, type };
    });
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        assert.ok(!overlaps(rects[i], rects[j]), `${tpl.id}: ${rects[i].type} overlaps ${rects[j].type}`);
      }
    }
  }
});

test('templates: name/desc keys exist in every locale', () => {
  for (const [locale, dict] of Object.entries(messages)) {
    const flat = flattenMessages(dict);
    for (const tpl of TEMPLATES) {
      assert.ok(flat.get(tpl.nameKey), `${locale}: ${tpl.nameKey}`);
      assert.ok(flat.get(tpl.descKey), `${locale}: ${tpl.descKey}`);
    }
  }
});

test('createBoardFromTemplate: valid boards, unique ids, current-language text', () => {
  for (const locale of Object.keys(messages)) {
    const { t } = i18nFor(locale);
    const ids = new Set();
    for (const tpl of TEMPLATES) {
      const board = createBoardFromTemplate(tpl, registry, t);
      assert.deepEqual(validateBoard(board, tpl.id), []);
      assert.equal(board.name, t(tpl.nameKey));
      assert.equal(board.widgets.length, tpl.widgets.length);
      for (const w of board.widgets) {
        assert.ok(!ids.has(w.id));
        ids.add(w.id);
        assert.equal(w.version, registry.get(w.type).version);
      }
    }
  }
  const lesson = TEMPLATES.find((t) => t.id === 'lesson-start');
  const ko = createBoardFromTemplate(lesson, registry, i18nFor('ko').t);
  const en = createBoardFromTemplate(lesson, registry, i18nFor('en').t);
  assert.equal(ko.widgets.find((w) => w.type === 'text').state.content, '오늘의 목표');
  assert.equal(en.widgets.find((w) => w.type === 'text').state.content, 'Today’s goal');
});

test('createBoardFromTemplate: state overrides keep the widget state shape', () => {
  const { t } = i18nFor('en');
  for (const tpl of TEMPLATES) {
    const board = createBoardFromTemplate(tpl, registry, t);
    for (const w of board.widgets) {
      const baseKeys = Object.keys(registry.get(w.type).createState()).sort();
      assert.deepEqual(Object.keys(w.state).sort(), baseKeys, `${tpl.id}/${w.type}`);
    }
  }
  const quiz = createBoardFromTemplate(TEMPLATES.find((x) => x.id === 'quiz'), registry, t);
  assert.equal(quiz.widgets.find((w) => w.type === 'scoreboard').state.teams.length, 4);
  const brk = createBoardFromTemplate(TEMPLATES.find((x) => x.id === 'break'), registry, t);
  assert.deepEqual(
    [brk.widgets[0].state.durationMs, brk.widgets[0].state.mode],
    [10 * 60_000, 'visual'],
  );
});

test('createBoardFromTemplate: unknown widget type throws', () => {
  assert.throws(() =>
    createBoardFromTemplate(
      { id: 'x', nameKey: 'a', descKey: 'b', background: 'sky', widgets: [{ type: 'nope', rect: [0, 0.1, 0.2, 0.2] }] },
      registry,
      (k) => k,
    ),
  );
});
