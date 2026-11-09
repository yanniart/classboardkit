/**
 * 실행 취소할 수 있는 작업 (ADR-0009). 각 함수는 board-ops를 적용하고 역연산 항목을 함께 만든다.
 * 반환: 바뀐 것이 없으면 null, 아니면 { state, entry, ...추가 정보 }
 *
 * 역연산은 배열 위치가 아니라 ID로 대상을 찾는다. 되돌릴 때의 최신 내용(예: 추가 뒤 입력한 텍스트)을
 * 다시 실행할 때 쓰도록, 지우는 쪽에서 그 순간의 스냅샷을 잡아 둔다.
 */
import {
  addWidget,
  deleteBoard,
  insertBoard,
  removeBoards,
  removeWidget,
  renameBoard,
  restoreBoard,
  restoreWidget,
  setBackground,
  setWidgetRect,
  setWidgetStyle,
} from './board-ops.js';
import { DEFAULT_WIDGET_STYLE } from './schema.js';

/** @typedef {import('./history.js').HistoryEntry} HistoryEntry */
/** @typedef {{ state: any, entry: HistoryEntry }} OpResult */

/** @param {any} state @param {string} boardId */
const findBoard = (state, boardId) => state.boards.find((/** @type {any} */ b) => b.id === boardId);

/** @param {any} state @param {string} boardId @param {string} widgetId */
function locateWidget(state, boardId, widgetId) {
  const board = findBoard(state, boardId);
  const index = board ? board.widgets.findIndex((/** @type {any} */ w) => w.id === widgetId) : -1;
  return index === -1 ? null : { widget: board.widgets[index], index };
}

/**
 * 위젯 추가
 * @param {any} state
 * @param {string} boardId
 * @param {Parameters<typeof addWidget>[2]} def
 * @returns {(OpResult & { widgetId: string }) | null}
 */
export function addWidgetOp(state, boardId, def) {
  const { state: next, widgetId } = addWidget(state, boardId, def);
  if (!widgetId) return null;
  /** @type {{ widget: any, index: number } | null} */
  let snapshot = locateWidget(next, boardId, widgetId);
  return {
    state: next,
    widgetId,
    entry: {
      label: 'history.action.addWidget',
      boardId,
      undo: (s) => {
        snapshot = locateWidget(s, boardId, widgetId) ?? snapshot;
        return removeWidget(s, boardId, widgetId);
      },
      redo: (s) => (snapshot ? restoreWidget(s, boardId, snapshot.widget, snapshot.index) : s),
    },
  };
}

/**
 * 위젯 삭제
 * @param {any} state
 * @param {string} boardId
 * @param {string} widgetId
 * @returns {OpResult | null}
 */
export function removeWidgetOp(state, boardId, widgetId) {
  let snapshot = locateWidget(state, boardId, widgetId);
  if (!snapshot) return null;
  return {
    state: removeWidget(state, boardId, widgetId),
    entry: {
      label: 'history.action.removeWidget',
      boardId,
      undo: (s) => (snapshot ? restoreWidget(s, boardId, snapshot.widget, snapshot.index) : s),
      redo: (s) => {
        snapshot = locateWidget(s, boardId, widgetId) ?? snapshot;
        return removeWidget(s, boardId, widgetId);
      },
    },
  };
}

/**
 * 위젯 이동·크기 조절. 위젯 state는 건드리지 않으므로 그사이 입력한 내용은 유지된다.
 * @param {any} state
 * @param {string} boardId
 * @param {string} widgetId
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {{ kind?: 'move' | 'resize', merge?: boolean }} [options] merge: 키보드 연속 조작 합치기
 * @returns {OpResult | null}
 */
export function setRectOp(state, boardId, widgetId, rect, { kind = 'move', merge = false } = {}) {
  const found = locateWidget(state, boardId, widgetId);
  if (!found) return null;
  const next = setWidgetRect(state, boardId, widgetId, rect);
  if (next === state) return null;
  const { x, y, w, h } = found.widget;
  const before = { x, y, w, h };
  const after = /** @type {any} */ (locateWidget(next, boardId, widgetId)).widget;
  const target = { x: after.x, y: after.y, w: after.w, h: after.h };
  return {
    state: next,
    entry: {
      label: kind === 'resize' ? 'history.action.resizeWidget' : 'history.action.moveWidget',
      boardId,
      undo: (s) => setWidgetRect(s, boardId, widgetId, before),
      redo: (s) => setWidgetRect(s, boardId, widgetId, target),
      ...(merge ? { mergeKey: `rect:${kind}:${widgetId}` } : {}),
    },
  };
}

/**
 * 배경 변경
 * @param {any} state
 * @param {string} boardId
 * @param {{ type: string, value: string }} background
 * @returns {OpResult | null}
 */
export function setBackgroundOp(state, boardId, background) {
  const board = findBoard(state, boardId);
  if (!board) return null;
  const next = setBackground(state, boardId, background);
  if (next === state) return null;
  const before = { ...board.background };
  const after = { type: background.type, value: background.value };
  return {
    state: next,
    entry: {
      label: 'history.action.background',
      boardId,
      undo: (s) => setBackground(s, boardId, before),
      redo: (s) => setBackground(s, boardId, after),
    },
  };
}

/**
 * 보드 이름 변경
 * @param {any} state
 * @param {string} boardId
 * @param {string} name
 * @returns {OpResult | null}
 */
export function renameBoardOp(state, boardId, name) {
  const board = findBoard(state, boardId);
  if (!board) return null;
  const next = renameBoard(state, boardId, name);
  if (next === state) return null;
  const before = board.name;
  const after = findBoard(next, boardId).name;
  return {
    state: next,
    entry: {
      label: 'history.action.renameBoard',
      boardId,
      undo: (s) => renameBoard(s, boardId, before),
      redo: (s) => renameBoard(s, boardId, after),
    },
  };
}

/**
 * 보드 삭제. 마지막 보드를 지워 빈 보드가 새로 생겼다면, 실행 취소 때 그 빈 보드는
 * 아직 비어 있을 때만 함께 치운다.
 * @param {any} state
 * @param {string} boardId
 * @param {string} fallbackName
 * @returns {OpResult | null}
 */
export function deleteBoardOp(state, boardId, fallbackName) {
  const index = state.boards.findIndex((/** @type {any} */ b) => b.id === boardId);
  if (index === -1) return null;
  let snapshot = { board: state.boards[index], index };

  /** @param {any} before @param {any} after 삭제로 새로 생긴 빈 보드 ID */
  const createdFallback = (before, after) =>
    before.boards.length === 1 && after.boards.length === 1 ? after.boards[0].id : null;

  const next = deleteBoard(state, boardId, fallbackName);
  let fallbackId = createdFallback(state, next);

  return {
    state: next,
    entry: {
      label: 'history.action.deleteBoard',
      boardId,
      undo: (s) => {
        let restored = restoreBoard(s, snapshot.board, snapshot.index);
        if (restored === s) return s;
        const fallback = fallbackId ? findBoard(restored, fallbackId) : null;
        if (fallback && fallback.widgets.length === 0) restored = removeBoards(restored, [fallbackId], snapshot.board.id);
        return restored;
      },
      redo: (s) => {
        const i = s.boards.findIndex((/** @type {any} */ b) => b.id === boardId);
        if (i === -1) return s;
        snapshot = { board: s.boards[i], index: i };
        const after = deleteBoard(s, boardId, fallbackName);
        fallbackId = createdFallback(s, after);
        return after;
      },
    },
  };
}

/**
 * 만들어진 보드 추가 (새 보드·복제·템플릿·공유 링크·파일 가져오기). 실행 취소하면 지우고,
 * 이전 활성 보드로 돌아간다. 다시 실행하면 지울 때의 내용 그대로 원래 위치에.
 * @param {any} state
 * @param {any[]} boards ID가 이미 발급된 보드
 * @param {{ index?: number }} [options] 첫 보드를 넣을 위치 (기본: 끝)
 * @returns {OpResult | null}
 */
export function addBoardsOp(state, boards, { index = state.boards.length } = {}) {
  if (boards.length === 0) return null;
  const prevActive = state.settings.activeBoardId;
  let next = state;
  boards.forEach((board, i) => {
    next = insertBoard(next, board, index + i);
  });
  // 여러 개를 넣으면 첫 보드를 활성화 (importBoards와 같은 규칙)
  next = { ...next, settings: { ...next.settings, activeBoardId: boards[0].id } };
  const ids = boards.map((b) => b.id);
  /** @type {{ board: any, index: number }[]} */
  let snapshots = boards.map((board, i) => ({ board, index: index + i }));

  return {
    state: next,
    entry: {
      label: 'history.action.addBoard',
      boardId: null,
      undo: (s) => {
        const current = s.boards
          .map((/** @type {any} */ board, /** @type {number} */ i) => ({ board, index: i }))
          .filter((/** @type {any} */ x) => ids.includes(x.board.id));
        if (current.length > 0) snapshots = current;
        return removeBoards(s, ids, prevActive);
      },
      redo: (s) => {
        let out = s;
        for (const { board, index: i } of snapshots) out = insertBoard(out, board, i);
        if (out === s) return s;
        return { ...out, settings: { ...out.settings, activeBoardId: snapshots[0].board.id } };
      },
    },
  };
}

/**
 * 위젯 모양 변경 (M6)
 * @param {any} state
 * @param {string} boardId
 * @param {{ look: string, accent: string }} style
 * @returns {OpResult | null}
 */
export function setWidgetStyleOp(state, boardId, style) {
  const board = findBoard(state, boardId);
  if (!board) return null;
  const next = setWidgetStyle(state, boardId, style);
  if (next === state) return null;
  const before = { ...(board.widgetStyle ?? DEFAULT_WIDGET_STYLE) };
  const after = { look: style.look, accent: style.accent };
  return {
    state: next,
    entry: {
      label: 'history.action.widgetStyle',
      boardId,
      undo: (s) => setWidgetStyle(s, boardId, before),
      redo: (s) => setWidgetStyle(s, boardId, after),
    },
  };
}
