import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_WIDGET_STYLE, WIDGET_ACCENTS, WIDGET_LOOKS, createBoard, createDefaultData, validateBoard, validateData } from '../src/core/schema.js';
import { setWidgetStyle } from '../src/core/board-ops.js';
import { setWidgetStyleOp } from '../src/core/undoable.js';
import { buildSharePayload } from '../src/core/share.js';
import { createExport, parseImport, serializeExport } from '../src/core/transfer.js';

function setup() {
  const data = createDefaultData({ boardName: 'A', locale: 'en' });
  return { state: { boards: data.boards, settings: data.settings }, boardId: data.boards[0].id };
}

test('widgetStyle: 3 looks × 7 accents, default solid/default', () => {
  assert.deepEqual([...WIDGET_LOOKS], ['solid', 'glass', 'outline']);
  assert.equal(WIDGET_ACCENTS.length, 7);
  assert.deepEqual({ ...DEFAULT_WIDGET_STYLE }, { look: 'solid', accent: 'default' });
});

test('widgetStyle: optional field validated when present', () => {
  const b = createBoard('X');
  assert.deepEqual(validateBoard(b, 'b'), []);
  assert.deepEqual(validateBoard({ ...b, widgetStyle: { look: 'glass', accent: 'teal' } }, 'b'), []);
  assert.equal(validateBoard({ ...b, widgetStyle: { look: 'neon', accent: 'teal' } }, 'b').length, 1);
  assert.equal(validateBoard({ ...b, widgetStyle: { look: 'glass', accent: 'pink' } }, 'b').length, 1);
  assert.equal(validateBoard({ ...b, widgetStyle: 'glass' }, 'b').length, 1);
});

test('setWidgetStyle: sets, no-ops when unchanged, removes field when back to default', () => {
  const { state, boardId } = setup();
  const glass = setWidgetStyle(state, boardId, { look: 'glass', accent: 'blue' });
  assert.deepEqual(glass.boards[0].widgetStyle, { look: 'glass', accent: 'blue' });
  assert.equal(setWidgetStyle(glass, boardId, { look: 'glass', accent: 'blue' }), glass);
  assert.equal(setWidgetStyle(state, boardId, DEFAULT_WIDGET_STYLE), state);
  const back = setWidgetStyle(glass, boardId, DEFAULT_WIDGET_STYLE);
  assert.ok(!('widgetStyle' in back.boards[0]));
  assert.ok(validateData({ schemaVersion: 1, ...back }).ok);
});

test('setWidgetStyleOp: undo/redo round trip', () => {
  const { state, boardId } = setup();
  const r = setWidgetStyleOp(state, boardId, { look: 'outline', accent: 'red' });
  assert.equal(r.entry.label, 'history.action.widgetStyle');
  const undone = r.entry.undo(r.state);
  assert.ok(!('widgetStyle' in undone.boards[0]));
  assert.deepEqual(r.entry.redo(undone).boards[0].widgetStyle, { look: 'outline', accent: 'red' });
  assert.equal(setWidgetStyleOp(state, boardId, DEFAULT_WIDGET_STYLE), null);
  assert.equal(setWidgetStyleOp(state, 'b_missing', { look: 'glass', accent: 'red' }), null);
});

test('widgetStyle survives export → import and share payload', () => {
  const b = { ...createBoard('Styled'), widgetStyle: { look: 'glass', accent: 'green' } };
  const imported = parseImport(serializeExport(createExport([b])));
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.boards[0].widgetStyle, { look: 'glass', accent: 'green' });
  assert.deepEqual(buildSharePayload(b).boards[0].widgetStyle, { look: 'glass', accent: 'green' });
});

test('widgetStyle CSS: every non-default accent maps to contrast-tested team tokens', () => {
  const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  for (const a of WIDGET_ACCENTS.filter((x) => x !== 'default')) {
    assert.match(css, new RegExp(`\\.canvas\\[data-accent='${a}'\\] \\{ --accent: var\\(--team-${a}\\); --accent-text: var\\(--team-${a}-text\\); \\}`), a);
    assert.match(css, new RegExp(`\\.widget-style__accent\\[data-accent='${a}'\\]`), `menu swatch ${a}`);
  }
});
