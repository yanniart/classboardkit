import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addBoard,
  addWidget,
  bringToFront,
  deleteBoard,
  duplicateBoard,
  getActiveBoard,
  removeWidget,
  renameBoard,
  replaceWidget,
  setActiveBoard,
  setBackground,
  setWidgetRect,
  setWidgetState,
} from '../src/core/board-ops.js';
import { createDefaultData, validateData } from '../src/core/schema.js';

const T0 = new Date('2026-11-04T09:00:00.000Z');
const T1 = new Date('2026-11-04T10:00:00.000Z');

const def = {
  type: 'timer',
  version: 1,
  defaultSize: { w: 0.3, h: 0.3 },
  createState: () => ({ n: 0 }),
};

function setup() {
  const data = createDefaultData({ boardName: 'A', locale: 'en' });
  return { boards: data.boards, settings: data.settings, schemaVersion: data.schemaVersion };
}

/** 위젯 n개가 있는 상태 */
function withWidgets(n) {
  let state = setup();
  const boardId = state.boards[0].id;
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const r = addWidget(state, boardId, def, T0);
    state = r.state;
    ids.push(r.widgetId);
  }
  return { state, boardId, ids };
}

test('getActiveBoard falls back to the first board', () => {
  const state = setup();
  assert.equal(getActiveBoard(state).name, 'A');
  assert.equal(getActiveBoard({ ...state, settings: { ...state.settings, activeBoardId: 'x' } }).name, 'A');
});

test('addBoard appends and activates; result stays valid', () => {
  const state = addBoard(setup(), 'B', T0);
  assert.deepEqual(state.boards.map((b) => b.name), ['A', 'B']);
  assert.equal(getActiveBoard(state).name, 'B');
  assert.ok(validateData(state).ok);
});

test('setActiveBoard ignores unknown or same ids', () => {
  const state = addBoard(setup(), 'B', T0);
  assert.equal(setActiveBoard(state, 'nope'), state);
  assert.equal(setActiveBoard(state, state.settings.activeBoardId), state);
  assert.equal(getActiveBoard(setActiveBoard(state, state.boards[0].id)).name, 'A');
});

test('renameBoard trims, ignores empty names and updates updatedAt', () => {
  const state = setup();
  const id = state.boards[0].id;
  const renamed = renameBoard(state, id, '  Monday  ', T1);
  assert.equal(renamed.boards[0].name, 'Monday');
  assert.equal(renamed.boards[0].updatedAt, T1.toISOString());
  assert.equal(renameBoard(state, id, '   ', T1), state);
  assert.equal(renameBoard(renamed, id, 'Monday', T1), renamed);
});

test('duplicateBoard inserts after source with fresh ids and activates it', () => {
  let { state, boardId } = withWidgets(2);
  state = addBoard(state, 'Z', T0);
  const dup = duplicateBoard(state, boardId, 'A copy', T1);
  assert.deepEqual(dup.boards.map((b) => b.name), ['A', 'A copy', 'Z']);
  const [src, copy] = dup.boards;
  assert.notEqual(copy.id, src.id);
  assert.equal(copy.widgets.length, 2);
  copy.widgets.forEach((w, i) => assert.notEqual(w.id, src.widgets[i].id));
  assert.equal(dup.settings.activeBoardId, copy.id);
  // 깊은 복사: 원본 위젯 state와 참조 공유 없음
  assert.notEqual(copy.widgets[0].state, src.widgets[0].state);
  assert.ok(validateData(dup).ok);
});

test('deleteBoard activates the neighbour, and recreates a board when the last is deleted', () => {
  let state = addBoard(addBoard(setup(), 'B', T0), 'C', T0);
  const [a, b, c] = state.boards;
  state = setActiveBoard(state, b.id);

  const afterB = deleteBoard(state, b.id, 'New', T0);
  assert.deepEqual(afterB.boards.map((x) => x.name), ['A', 'C']);
  assert.equal(afterB.settings.activeBoardId, c.id);

  const afterC = deleteBoard(setActiveBoard(afterB, c.id), c.id, 'New', T0);
  assert.equal(afterC.settings.activeBoardId, a.id);

  const afterA = deleteBoard(afterC, a.id, 'New', T0);
  assert.equal(afterA.boards.length, 1);
  assert.equal(afterA.boards[0].name, 'New');
  assert.equal(afterA.settings.activeBoardId, afterA.boards[0].id);
  assert.ok(validateData(afterA).ok);
});

test('deleteBoard of an inactive board keeps the active one', () => {
  const state = addBoard(setup(), 'B', T0); // B 활성
  const next = deleteBoard(state, state.boards[0].id, 'New', T0);
  assert.equal(next.settings.activeBoardId, state.boards[1].id);
});

test('setBackground changes once and is a no-op when equal', () => {
  const state = setup();
  const id = state.boards[0].id;
  const next = setBackground(state, id, { type: 'gradient', value: 'sky' }, T1);
  assert.deepEqual(next.boards[0].background, { type: 'gradient', value: 'sky' });
  assert.equal(setBackground(next, id, { type: 'gradient', value: 'sky' }, T1), next);
});

test('addWidget creates a valid widget on top with default state', () => {
  const { state, boardId, ids } = withWidgets(3);
  const widgets = state.boards[0].widgets;
  assert.equal(widgets.length, 3);
  assert.deepEqual(widgets.map((w) => w.z), [1, 2, 3]);
  assert.deepEqual(widgets[0].state, { n: 0 });
  assert.match(ids[0], /^w_/);
  assert.ok(validateData(state).ok);
  assert.deepEqual(addWidget(state, 'missing', def, T0), { state, widgetId: null });
  assert.ok(boardId);
});

test('removeWidget removes only the target', () => {
  const { state, boardId, ids } = withWidgets(2);
  const next = removeWidget(state, boardId, ids[0], T1);
  assert.deepEqual(next.boards[0].widgets.map((w) => w.id), [ids[1]]);
  assert.equal(removeWidget(next, boardId, 'missing', T1), next);
});

test('setWidgetRect clamps and skips identical rects', () => {
  const { state, boardId, ids } = withWidgets(1);
  const next = setWidgetRect(state, boardId, ids[0], { x: 0.9, y: 0.1, w: 0.3, h: 0.3 }, T1);
  const w = next.boards[0].widgets[0];
  assert.deepEqual([w.x, w.y, w.w, w.h], [0.7, 0.1, 0.3, 0.3]);
  assert.equal(setWidgetRect(next, boardId, ids[0], { x: 0.7, y: 0.1, w: 0.3, h: 0.3 }, T1), next);
});

test('bringToFront raises z, and is a no-op for the unique top widget', () => {
  const { state, boardId, ids } = withWidgets(3);
  assert.equal(bringToFront(state, boardId, ids[2], T1), state);
  const next = bringToFront(state, boardId, ids[0], T1);
  assert.deepEqual(next.boards[0].widgets.map((w) => w.z), [4, 2, 3]);
});

test('bringToFront renumbers when z grows large, keeping order', () => {
  const { state, boardId, ids } = withWidgets(3);
  const big = {
    ...state,
    boards: [{ ...state.boards[0], widgets: state.boards[0].widgets.map((w, i) => ({ ...w, z: 1000 + i })) }],
  };
  const next = bringToFront(big, boardId, ids[1], T1);
  assert.deepEqual(next.boards[0].widgets.map((w) => w.z), [1, 3, 2]);
});

test('setWidgetState replaces state (function or value) and skips same reference', () => {
  const { state, boardId, ids } = withWidgets(1);
  const a = setWidgetState(state, boardId, ids[0], (s) => ({ ...s, n: s.n + 1 }), T1);
  assert.deepEqual(a.boards[0].widgets[0].state, { n: 1 });
  const b = setWidgetState(a, boardId, ids[0], { other: true }, T1);
  assert.deepEqual(b.boards[0].widgets[0].state, { other: true });
  assert.equal(setWidgetState(b, boardId, ids[0], (s) => s, T1), b);
  assert.equal(b.boards[0].updatedAt, T1.toISOString());
});

test('replaceWidget swaps the whole widget', () => {
  const { state, boardId } = withWidgets(1);
  const original = state.boards[0].widgets[0];
  const next = replaceWidget(state, boardId, { ...original, version: 2, state: { migrated: true } }, T1);
  assert.equal(next.boards[0].widgets[0].version, 2);
  assert.deepEqual(next.boards[0].widgets[0].state, { migrated: true });
});

test('operations never mutate the input state', () => {
  const { state, boardId, ids } = withWidgets(2);
  const snapshot = structuredClone(state);
  addWidget(state, boardId, def, T1);
  removeWidget(state, boardId, ids[0], T1);
  setWidgetRect(state, boardId, ids[0], { x: 0, y: 0, w: 0.5, h: 0.5 }, T1);
  bringToFront(state, boardId, ids[0], T1);
  setWidgetState(state, boardId, ids[0], { x: 1 }, T1);
  duplicateBoard(state, boardId, 'copy', T1);
  deleteBoard(state, boardId, 'new', T1);
  assert.deepEqual(state, snapshot);
});
