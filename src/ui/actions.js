import { createHistory } from '../core/history.js';
import { setActiveBoard } from '../core/board-ops.js';

/** 삭제 알림("실행 취소" 버튼)이 떠 있는 시간 (ms) */
const UNDO_NOTICE_MS = 6000;
/** "실행 취소: …" 확인 알림 — 연달아 누를 때 화면을 오래 가리지 않게 짧게 */
const FEEDBACK_MS = 3000;

/**
 * "적용 + 기록"을 한 곳에서 처리하는 실행 취소 헬퍼 (F-014, ADR-0009).
 * UI 모듈은 store.update 대신 perform(op)을 써야 실행 취소 기록이 빠지지 않는다.
 *
 * @param {{
 *   store: ReturnType<typeof import('../core/store.js').createStore>,
 *   i18n: ReturnType<typeof import('../core/i18n.js').createI18n>,
 *   notify: ReturnType<typeof import('./shell.js').mountShell>['notify'],
 * }} deps
 */
export function createActions({ store, i18n, notify }) {
  /** @type {Set<() => void>} */
  const listeners = new Set();
  const history = createHistory({ onChange: () => listeners.forEach((fn) => fn()) });
  /** 떠 있는 "실행 취소" 알림 닫기 — 다른 작업을 하면 그 알림의 대상이 달라지므로 닫는다 */
  let dismissUndoNotice = () => {};

  /**
   * undoable.js의 작업을 적용하고 기록한다.
   * @template {{ state: any, entry: import('../core/history.js').HistoryEntry }} R
   * @param {(state: any) => R | null} op
   * @param {{ undoNotice?: string }} [options] undoNotice: "실행 취소" 버튼이 있는 정보 알림 키 (삭제 등)
   * @returns {R | null}
   */
  function perform(op, { undoNotice } = {}) {
    /** @type {R | null} */
    let result = null;
    store.update((s) => {
      const r = op(s);
      if (!r || r.state === s) return s;
      result = r;
      return r.state;
    });
    if (!result) return null;
    dismissUndoNotice();
    const recorded = history.record(/** @type {R} */ (result).entry);
    if (undoNotice) {
      dismissUndoNotice = notify(undoNotice, {
        type: 'info',
        timeout: UNDO_NOTICE_MS,
        // 알림이 가리키는 작업이 아직 가장 최근 기록일 때만
        action: { labelKey: 'history.undo', onClick: () => void (history.peek() === recorded && undo()) },
      });
    }
    return result;
  }

  /** @param {'undo' | 'redo'} direction */
  function apply(direction) {
    dismissUndoNotice();
    /** @type {import('../core/history.js').HistoryEntry | null} */
    let applied = null;
    store.update((s) => {
      const r = history[direction](s);
      if (!r) return s;
      applied = r.entry;
      // 다른 보드의 작업이면 그 보드로 전환해 결과가 보이게
      return r.entry.boardId ? setActiveBoard(r.state, r.entry.boardId) : r.state;
    });
    if (!applied) return false;
    notify(direction === 'undo' ? 'history.undone' : 'history.redone', {
      type: 'info',
      timeout: FEEDBACK_MS,
      params: { action: i18n.t(/** @type {any} */ (applied).label) },
    });
    return true;
  }

  function undo() {
    return apply('undo');
  }

  function redo() {
    return apply('redo');
  }

  return {
    perform,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clear: history.clear,
    /** @param {() => void} fn */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
