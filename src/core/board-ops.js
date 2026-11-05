/**
 * 앱 상태({ boards, settings })를 바꾸는 순수 함수 모음.
 * 모두 새 상태를 반환하며, 바뀐 것이 없으면 입력 상태를 그대로 반환한다.
 */
import { createBoard } from './schema.js';
import { clampRect, placeNewRect } from './geometry.js';
import { createId } from './utils/id.js';

/** @typedef {{ boards: any[], settings: any }} AppState */

/** @param {AppState} state */
export function getActiveBoard(state) {
  return state.boards.find((b) => b.id === state.settings.activeBoardId) ?? state.boards[0] ?? null;
}

/**
 * 보드 하나를 변환하고 updatedAt을 갱신한다.
 * @param {AppState} state
 * @param {string} boardId
 * @param {(board: any) => any} fn
 * @param {Date} now
 */
function mapBoard(state, boardId, fn, now) {
  let changed = false;
  const boards = state.boards.map((board) => {
    if (board.id !== boardId) return board;
    const next = fn(board);
    if (next === board) return board;
    changed = true;
    return { ...next, updatedAt: now.toISOString() };
  });
  return changed ? { ...state, boards } : state;
}

/**
 * 위젯 하나를 변환한다.
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} widgetId
 * @param {(widget: any) => any} fn
 * @param {Date} now
 */
function mapWidget(state, boardId, widgetId, fn, now) {
  return mapBoard(
    state,
    boardId,
    (board) => {
      let changed = false;
      const widgets = board.widgets.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const next = fn(widget);
        if (next !== widget) changed = true;
        return next;
      });
      return changed ? { ...board, widgets } : board;
    },
    now,
  );
}

/** @param {AppState} state @param {any} settingsPatch */
const withSettings = (state, settingsPatch) => ({
  ...state,
  settings: { ...state.settings, ...settingsPatch },
});

// ── 보드 ──

/** @param {AppState} state @param {string} boardId */
export function setActiveBoard(state, boardId) {
  if (state.settings.activeBoardId === boardId) return state;
  if (!state.boards.some((b) => b.id === boardId)) return state;
  return withSettings(state, { activeBoardId: boardId });
}

/**
 * 새 보드를 만들고 활성화한다.
 * @param {AppState} state
 * @param {string} name
 * @param {Date} [now]
 */
export function addBoard(state, name, now = new Date()) {
  const board = createBoard(name, now);
  return withSettings({ ...state, boards: [...state.boards, board] }, { activeBoardId: board.id });
}

/**
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} name 앞뒤 공백 제거, 빈 이름은 무시
 * @param {Date} [now]
 */
export function renameBoard(state, boardId, name, now = new Date()) {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return state;
  return mapBoard(state, boardId, (b) => (b.name === trimmed ? b : { ...b, name: trimmed }), now);
}

/**
 * 보드를 복제해 원본 바로 뒤에 넣고 활성화한다. 위젯 ID는 새로 발급한다.
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} name
 * @param {Date} [now]
 */
export function duplicateBoard(state, boardId, name, now = new Date()) {
  const index = state.boards.findIndex((b) => b.id === boardId);
  if (index === -1) return state;
  const source = state.boards[index];
  const iso = now.toISOString();
  const copy = {
    ...structuredClone(source),
    id: createId('b'),
    name,
    createdAt: iso,
    updatedAt: iso,
  };
  copy.widgets = copy.widgets.map((w) => ({ ...w, id: createId('w') }));
  const boards = [...state.boards];
  boards.splice(index + 1, 0, copy);
  return withSettings({ ...state, boards }, { activeBoardId: copy.id });
}

/**
 * 가져온 보드를 기존 보드 뒤에 추가하고 첫 번째 가져온 보드를 활성화한다.
 * 보드 ID는 호출 전에 새로 발급되어 있어야 한다 (transfer.parseImport).
 * @param {AppState} state
 * @param {any[]} boards
 */
export function importBoards(state, boards) {
  if (boards.length === 0) return state;
  return withSettings(
    { ...state, boards: [...state.boards, ...boards] },
    { activeBoardId: boards[0].id },
  );
}

/**
 * 보드를 삭제한다. 마지막 보드를 지우면 빈 보드를 새로 만든다.
 * 활성 보드를 지우면 같은 위치(없으면 이전) 보드를 활성화한다.
 *
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} fallbackName 마지막 보드 삭제 시 새 보드 이름
 * @param {Date} [now]
 */
export function deleteBoard(state, boardId, fallbackName, now = new Date()) {
  const index = state.boards.findIndex((b) => b.id === boardId);
  if (index === -1) return state;
  let boards = state.boards.filter((b) => b.id !== boardId);
  if (boards.length === 0) boards = [createBoard(fallbackName, now)];

  let { activeBoardId } = state.settings;
  if (activeBoardId === boardId || !boards.some((b) => b.id === activeBoardId)) {
    activeBoardId = boards[Math.min(index, boards.length - 1)].id;
  }
  return withSettings({ ...state, boards }, { activeBoardId });
}

/**
 * @param {AppState} state
 * @param {string} boardId
 * @param {{ type: string, value: string }} background
 * @param {Date} [now]
 */
export function setBackground(state, boardId, background, now = new Date()) {
  return mapBoard(
    state,
    boardId,
    (b) =>
      b.background.type === background.type && b.background.value === background.value
        ? b
        : { ...b, background: { type: background.type, value: background.value } },
    now,
  );
}

// ── 위젯 ──

/** @param {any[]} widgets */
const maxZ = (widgets) => widgets.reduce((m, w) => Math.max(m, w.z), 0);

/**
 * 위젯 정의로 새 위젯을 만들어 보드 맨 위에 추가한다.
 * @param {AppState} state
 * @param {string} boardId
 * @param {{ type: string, version: number, defaultSize: { w: number, h: number }, createState: () => object }} def
 * @param {Date} [now]
 * @returns {{ state: AppState, widgetId: string | null }}
 */
export function addWidget(state, boardId, def, now = new Date()) {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return { state, widgetId: null };
  const widget = {
    id: createId('w'),
    type: def.type,
    version: def.version,
    ...placeNewRect(def.defaultSize, board.widgets.length),
    z: maxZ(board.widgets) + 1,
    state: def.createState(),
  };
  const next = mapBoard(state, boardId, (b) => ({ ...b, widgets: [...b.widgets, widget] }), now);
  return { state: next, widgetId: widget.id };
}

/** @param {AppState} state @param {string} boardId @param {string} widgetId @param {Date} [now] */
export function removeWidget(state, boardId, widgetId, now = new Date()) {
  return mapBoard(
    state,
    boardId,
    (b) =>
      b.widgets.some((w) => w.id === widgetId)
        ? { ...b, widgets: b.widgets.filter((w) => w.id !== widgetId) }
        : b,
    now,
  );
}

/**
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} widgetId
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {Date} [now]
 */
export function setWidgetRect(state, boardId, widgetId, rect, now = new Date()) {
  const r = clampRect(rect);
  return mapWidget(
    state,
    boardId,
    widgetId,
    (w) => (w.x === r.x && w.y === r.y && w.w === r.w && w.h === r.h ? w : { ...w, ...r }),
    now,
  );
}

/**
 * 위젯을 맨 앞으로. 이미 유일한 맨 앞이면 변경 없음.
 * z가 커지면 1부터 다시 매겨 정수 증가를 억제한다.
 *
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} widgetId
 * @param {Date} [now]
 */
export function bringToFront(state, boardId, widgetId, now = new Date()) {
  const board = state.boards.find((b) => b.id === boardId);
  const target = board?.widgets.find((w) => w.id === widgetId);
  if (!board || !target) return state;
  const top = maxZ(board.widgets);
  const isUniqueTop = target.z === top && board.widgets.filter((w) => w.z === top).length === 1;
  if (isUniqueTop) return state;

  return mapBoard(
    state,
    boardId,
    (b) => {
      if (top < 1000) {
        return { ...b, widgets: b.widgets.map((w) => (w.id === widgetId ? { ...w, z: top + 1 } : w)) };
      }
      // 정규화: 현재 순서를 유지하며 1..n으로 재번호, 대상은 n
      const order = [...b.widgets]
        .filter((w) => w.id !== widgetId)
        .sort((a, c) => a.z - c.z)
        .map((w) => w.id);
      order.push(widgetId);
      return { ...b, widgets: b.widgets.map((w) => ({ ...w, z: order.indexOf(w.id) + 1 })) };
    },
    now,
  );
}

/**
 * 위젯 state를 교체한다 (병합 아님 — 위젯이 필드 삭제를 표현할 수 있도록).
 * @param {AppState} state
 * @param {string} boardId
 * @param {string} widgetId
 * @param {object | ((prev: any) => object)} next
 * @param {Date} [now]
 */
export function setWidgetState(state, boardId, widgetId, next, now = new Date()) {
  return mapWidget(
    state,
    boardId,
    widgetId,
    (w) => {
      const value = typeof next === 'function' ? next(w.state) : next;
      return value === w.state ? w : { ...w, state: value };
    },
    now,
  );
}

/**
 * 위젯 전체를 교체한다 (마이그레이션 결과 반영용).
 * @param {AppState} state
 * @param {string} boardId
 * @param {any} widget
 * @param {Date} [now]
 */
export function replaceWidget(state, boardId, widget, now = new Date()) {
  return mapWidget(state, boardId, widget.id, () => widget, now);
}
