import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, HISTORY_LIMIT } from '../src/core/history.js';
import {
  addBoardsOp,
  addWidgetOp,
  deleteBoardOp,
  removeWidgetOp,
  renameBoardOp,
  setBackgroundOp,
  setRectOp,
} from '../src/core/undoable.js';
import { addWidget, restoreWidget, restoreBoard, removeBoards, setWidgetState } from '../src/core/board-ops.js';
import { createBoard, createDefaultData, validateData } from '../src/core/schema.js';

const def = {
  type: 'text',
  version: 1,
  defaultSize: { w: 0.3, h: 0.3 },
  createState: () => ({ text: '' }),
};

function setup(widgetCount = 0) {
  const data = createDefaultData({ boardName: 'A', locale: 'en' });
  let state = { boards: data.boards, settings: data.settings };
  const boardId = state.boards[0].id;
  const ids = [];
  for (let i = 0; i < widgetCount; i += 1) {
    const r = addWidget(state, boardId, def);
    state = r.state;
    ids.push(r.widgetId);
  }
  return { state, boardId, ids };
}

/** updatedAt은 시각에 따라 달라지므로 비교에서 뺀다 */
const strip = (state) => ({
  settings: state.settings,
  boards: state.boards.map(({ updatedAt, ...b }) => b),
});

const valid = (state) => assert.ok(validateData({ schemaVersion: 1, ...state }).ok);

/** 작업 → undo → redo 왕복 검사 */
function roundTrip(before, result) {
  assert.ok(result, 'operation should change state');
  const undone = result.entry.undo(result.state);
  assert.deepEqual(strip(undone), strip(before));
  valid(undone);
  const redone = result.entry.redo(undone);
  assert.deepEqual(strip(redone), strip(result.state));
  valid(redone);
}

// ── history ──

const entry = (label, extra = {}) => ({
  label,
  undo: (s) => ({ ...s, log: [...s.log, `undo:${label}`] }),
  redo: (s) => ({ ...s, log: [...s.log, `redo:${label}`] }),
  ...extra,
});

test('history: undo/redo order (LIFO) and availability', () => {
  const h = createHistory();
  assert.equal(h.canUndo(), false);
  assert.equal(h.undo({ log: [] }), null);
  h.record(entry('a'));
  h.record(entry('b'));
  let s = { log: [] };
  s = h.undo(s).state;
  s = h.undo(s).state;
  assert.deepEqual(s.log, ['undo:b', 'undo:a']);
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), true);
  s = h.redo(s).state;
  assert.deepEqual(s.log.at(-1), 'redo:a');
  assert.equal(h.peek().label, 'a');
});

test('history: recording a new entry clears redo stack', () => {
  const h = createHistory();
  h.record(entry('a'));
  h.undo({ log: [] });
  assert.equal(h.canRedo(), true);
  h.record(entry('b'));
  assert.equal(h.canRedo(), false);
});

test('history: limit drops oldest entries', () => {
  const h = createHistory({ limit: 3 });
  for (const l of ['a', 'b', 'c', 'd']) h.record(entry(l));
  let s = { log: [] };
  while (h.canUndo()) s = h.undo(s)?.state ?? s;
  assert.deepEqual(s.log, ['undo:d', 'undo:c', 'undo:b']);
  assert.equal(HISTORY_LIMIT, 50);
});

test('history: merges same mergeKey within window, keeps first undo and last redo', () => {
  let t = 0;
  const h = createHistory({ now: () => t });
  h.record(entry('first', { mergeKey: 'k' }));
  t = 500;
  h.record(entry('second', { mergeKey: 'k' }));
  t = 900;
  h.record(entry('third', { mergeKey: 'k' }));
  t = 5000;
  h.record(entry('later', { mergeKey: 'k' })); // 창 밖 → 별도 항목
  let s = { log: [] };
  s = h.undo(s).state;
  s = h.undo(s).state;
  assert.deepEqual(s.log, ['undo:later', 'undo:first']);
  assert.equal(h.canUndo(), false);
  s = h.redo(s).state;
  assert.deepEqual(s.log.at(-1), 'redo:third');
});

test('history: different mergeKey is not merged', () => {
  const h = createHistory({ now: () => 0 });
  h.record(entry('a', { mergeKey: 'x' }));
  h.record(entry('b', { mergeKey: 'y' }));
  h.undo({ log: [] });
  assert.equal(h.canUndo(), true);
});

test('history: no-op entries (missing target) are skipped', () => {
  const h = createHistory();
  h.record(entry('a'));
  h.record({ label: 'gone', undo: (s) => s, redo: (s) => s });
  const r = h.undo({ log: [] });
  assert.equal(r.entry.label, 'a');
  assert.deepEqual(r.state.log, ['undo:a']);
  assert.equal(h.canUndo(), false);
});

test('history: onChange is called and clear() empties both stacks', () => {
  let calls = 0;
  const h = createHistory({ onChange: () => (calls += 1) });
  h.record(entry('a'));
  h.undo({ log: [] });
  h.clear();
  assert.equal(calls, 3);
  assert.equal(h.canUndo() || h.canRedo(), false);
});

// ── board-ops 역연산 헬퍼 ──

test('restoreWidget: inserts at original index, no-op for missing board or duplicate id', () => {
  const { state, boardId, ids } = setup(3);
  const removed = state.boards[0].widgets[1];
  const without = { ...state, boards: [{ ...state.boards[0], widgets: state.boards[0].widgets.filter((w) => w.id !== ids[1]) }] };
  const restored = restoreWidget(without, boardId, removed, 1);
  assert.deepEqual(restored.boards[0].widgets.map((w) => w.id), ids);
  assert.equal(restoreWidget(restored, boardId, removed, 1), restored);
  assert.equal(restoreWidget(without, 'b_missing', removed, 1), without);
});

test('restoreBoard / removeBoards', () => {
  const { state } = setup();
  const b = createBoard('B');
  const added = restoreBoard(state, b, 0);
  assert.equal(added.boards[0].id, b.id);
  assert.equal(added.settings.activeBoardId, b.id);
  assert.equal(restoreBoard(added, b, 0), added);
  const back = removeBoards(added, [b.id], state.boards[0].id);
  assert.equal(back.settings.activeBoardId, state.boards[0].id);
  // 보드가 0개가 되는 제거는 하지 않음
  assert.equal(removeBoards(state, [state.boards[0].id]), state);
});

// ── undoable 작업 왕복 ──

test('addWidgetOp round trip; redo keeps content typed before undo', () => {
  const { state, boardId } = setup(1);
  const r = addWidgetOp(state, boardId, def);
  roundTrip(state, r);
  const typed = setWidgetState(r.state, boardId, r.widgetId, { text: 'hello' });
  const undone = r.entry.undo(typed);
  const redone = r.entry.redo(undone);
  assert.equal(redone.boards[0].widgets.find((w) => w.id === r.widgetId).state.text, 'hello');
});

test('removeWidgetOp restores exact widget (z, rect, state, order)', () => {
  const { state, boardId, ids } = setup(3);
  const withText = setWidgetState(state, boardId, ids[1], { text: 'keep me' });
  const r = removeWidgetOp(withText, boardId, ids[1]);
  roundTrip(withText, r);
  assert.equal(removeWidgetOp(withText, boardId, 'w_missing'), null);
});

test('setRectOp: undo restores rect but keeps state changed in between', () => {
  const { state, boardId, ids } = setup(2);
  const r = setRectOp(state, boardId, ids[0], { x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
  roundTrip(state, r);
  const typed = setWidgetState(r.state, boardId, ids[0], { text: 'typed after move' });
  const undone = r.entry.undo(typed);
  const w = undone.boards[0].widgets.find((x) => x.id === ids[0]);
  const orig = state.boards[0].widgets.find((x) => x.id === ids[0]);
  assert.deepEqual([w.x, w.y, w.w, w.h], [orig.x, orig.y, orig.w, orig.h]);
  assert.equal(w.state.text, 'typed after move');
});

test('setRectOp: unchanged rect → null, merge option sets mergeKey, resize label', () => {
  const { state, boardId, ids } = setup(1);
  const w = state.boards[0].widgets[0];
  assert.equal(setRectOp(state, boardId, ids[0], { x: w.x, y: w.y, w: w.w, h: w.h }), null);
  const r = setRectOp(state, boardId, ids[0], { ...w, w: 0.4 }, { kind: 'resize', merge: true });
  assert.equal(r.entry.label, 'history.action.resizeWidget');
  assert.equal(r.entry.mergeKey, `rect:resize:${ids[0]}`);
});

test('setRectOp merged through history: one undo returns to the very first rect', () => {
  const { state, boardId, ids } = setup(1);
  const h = createHistory({ now: () => 0 });
  let s = state;
  for (let i = 0; i < 5; i += 1) {
    const w = s.boards[0].widgets[0];
    const r = setRectOp(s, boardId, ids[0], { ...w, x: w.x + 0.01 }, { merge: true });
    s = r.state;
    h.record(r.entry);
  }
  const back = h.undo(s).state;
  assert.equal(back.boards[0].widgets[0].x, state.boards[0].widgets[0].x);
  assert.equal(h.canUndo(), false);
});

test('setBackgroundOp / renameBoardOp round trip, unchanged → null', () => {
  const { state, boardId } = setup(1);
  roundTrip(state, setBackgroundOp(state, boardId, { type: 'color', value: '#ffffff' }));
  assert.equal(setBackgroundOp(state, boardId, { type: 'gradient', value: 'default' }), null);
  roundTrip(state, renameBoardOp(state, boardId, 'Renamed'));
  assert.equal(renameBoardOp(state, boardId, 'A'), null);
  assert.equal(renameBoardOp(state, boardId, '   '), null);
});

test('deleteBoardOp: restores position, widgets and active board', () => {
  const { state } = setup(2);
  const b2 = createBoard('B');
  const b3 = createBoard('C');
  const three = { ...state, boards: [...state.boards, b2, b3], settings: { ...state.settings, activeBoardId: b2.id } };
  const r = deleteBoardOp(three, b2.id, 'Fallback');
  assert.equal(r.state.boards.length, 2);
  roundTrip(three, r);
});

test('deleteBoardOp on last board: undo removes the auto-created empty fallback board', () => {
  const { state, boardId } = setup(2);
  const r = deleteBoardOp(state, boardId, 'Fallback');
  assert.equal(r.state.boards.length, 1);
  assert.equal(r.state.boards[0].name, 'Fallback');
  const undone = r.entry.undo(r.state);
  assert.deepEqual(undone.boards.map((b) => b.id), [boardId]);
  assert.equal(undone.settings.activeBoardId, boardId);
  // 다시 실행 → 새 빈 보드, 다시 취소 → 그 빈 보드도 정리
  const redone = r.entry.redo(undone);
  assert.equal(redone.boards.length, 1);
  assert.notEqual(redone.boards[0].id, boardId);
  assert.deepEqual(r.entry.undo(redone).boards.map((b) => b.id), [boardId]);
});

test('deleteBoardOp on last board: fallback board with widgets is kept on undo', () => {
  const { state, boardId } = setup(1);
  const r = deleteBoardOp(state, boardId, 'Fallback');
  const fallbackId = r.state.boards[0].id;
  const used = addWidget(r.state, fallbackId, def).state;
  const undone = r.entry.undo(used);
  assert.deepEqual(undone.boards.map((b) => b.id), [boardId, fallbackId]);
});

test('addBoardsOp: round trip, previous active board restored, redo keeps edits', () => {
  const { state, boardId } = setup(1);
  const b = createBoard('Template');
  const r = addBoardsOp(state, [b]);
  assert.equal(r.state.settings.activeBoardId, b.id);
  roundTrip(state, r);
  const edited = addWidget(r.state, b.id, def).state;
  const undone = r.entry.undo(edited);
  assert.equal(undone.settings.activeBoardId, boardId);
  const redone = r.entry.redo(undone);
  assert.equal(redone.boards.find((x) => x.id === b.id).widgets.length, 1);
  assert.equal(addBoardsOp(state, []), null);
});

test('addBoardsOp: index option inserts after source (duplicate)', () => {
  const { state } = setup();
  const b2 = createBoard('B');
  const two = { ...state, boards: [...state.boards, b2] };
  const copy = createBoard('A copy');
  const r = addBoardsOp(two, [copy], { index: 1 });
  assert.deepEqual(r.state.boards.map((b) => b.name), ['A', 'A copy', 'B']);
  roundTrip(two, r);
});

test('entries targeting a deleted board are no-ops (skipped by history)', () => {
  const { state, boardId, ids } = setup(1);
  const h = createHistory();
  const move = setRectOp(state, boardId, ids[0], { x: 0.6, y: 0.6, w: 0.3, h: 0.3 });
  h.record(move.entry);
  const other = createBoard('B');
  const withOther = { ...move.state, boards: [...move.state.boards, other] };
  // 보드를 기록 없이 지운 상황 (예: 다른 경로)
  const gone = removeBoards(withOther, [boardId]);
  assert.equal(move.entry.undo(gone), gone);
  assert.equal(h.undo(gone), null);
});

test('mixed sequence through history returns to the initial state', () => {
  const { state, boardId } = setup();
  const h = createHistory();
  let s = state;
  const apply = (r) => {
    s = r.state;
    h.record(r.entry);
    return r;
  };
  const a = apply(addWidgetOp(s, boardId, def));
  apply(setRectOp(s, boardId, a.widgetId, { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }));
  apply(setRectOp(s, boardId, a.widgetId, { x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, { kind: 'resize' }));
  apply(setBackgroundOp(s, boardId, { type: 'color', value: '#000000' }));
  apply(removeWidgetOp(s, boardId, a.widgetId));
  apply(addBoardsOp(s, [createBoard('T')]));
  const end = s;
  while (h.canUndo()) s = h.undo(s)?.state ?? s;
  assert.deepEqual(strip(s), strip(state));
  while (h.canRedo()) s = h.redo(s)?.state ?? s;
  assert.deepEqual(strip(s), strip(end));
});
