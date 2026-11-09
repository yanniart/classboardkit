/**
 * 실행 취소 기록 (F-014, ADR-0009). 순수 모듈 — 상태는 받은 것을 변환해 돌려줄 뿐 직접 저장하지 않는다.
 *
 * 항목(entry):
 *   label    i18n 키 (알림·버튼 설명용)
 *   boardId  작업 대상 보드 (실행 취소 시 그 보드로 전환하는 데 사용, 선택)
 *   undo/redo  (state) => state — 대상을 ID로 찾고, 없으면 입력 state를 그대로 반환(no-op)
 *   mergeKey 같은 키의 항목이 mergeWindow 안에 연달아 기록되면 하나로 합친다 (키보드 이동)
 *
 * @typedef {{
 *   label: string,
 *   boardId?: string | null,
 *   undo: (state: any) => any,
 *   redo: (state: any) => any,
 *   mergeKey?: string,
 * }} HistoryEntry
 */

export const HISTORY_LIMIT = 50;
export const MERGE_WINDOW_MS = 1000;

/**
 * @param {{ limit?: number, mergeWindow?: number, now?: () => number, onChange?: () => void }} [options]
 */
export function createHistory({
  limit = HISTORY_LIMIT,
  mergeWindow = MERGE_WINDOW_MS,
  now = () => Date.now(),
  onChange = () => {},
} = {}) {
  /** @type {(HistoryEntry & { at: number })[]} */
  let past = [];
  /** @type {HistoryEntry[]} */
  let future = [];

  /**
   * 스택에서 적용 가능한 항목을 꺼내 적용한다. 대상이 없어진(no-op) 항목은 버리고 다음 항목으로.
   * @param {HistoryEntry[]} from
   * @param {'undo' | 'redo'} direction
   * @param {any} state
   */
  function step(from, direction, state) {
    while (from.length > 0) {
      const entry = /** @type {HistoryEntry} */ (from.pop());
      const next = entry[direction](state);
      if (next !== state) return { state: next, entry };
    }
    return null;
  }

  return {
    /**
     * @param {HistoryEntry} entry
     * @returns {HistoryEntry} 기록된 항목 (합쳐졌으면 합쳐진 항목) — peek() 비교용
     */
    record(entry) {
      const at = now();
      const top = past[past.length - 1];
      if (entry.mergeKey && top && top.mergeKey === entry.mergeKey && at - top.at <= mergeWindow) {
        // 처음 항목의 undo(원래 상태)는 유지하고 redo만 최신으로
        past[past.length - 1] = { ...top, redo: entry.redo, at };
      } else {
        past.push({ ...entry, at });
        if (past.length > limit) past = past.slice(past.length - limit);
      }
      future = [];
      onChange();
      return past[past.length - 1];
    },

    /**
     * @param {any} state
     * @returns {{ state: any, entry: HistoryEntry } | null} 되돌릴 것이 없으면 null
     */
    undo(state) {
      const result = step(past, 'undo', state);
      if (result) future.push(result.entry);
      onChange();
      return result;
    },

    /**
     * @param {any} state
     * @returns {{ state: any, entry: HistoryEntry } | null}
     */
    redo(state) {
      const result = step(future, 'redo', state);
      // 다시 실행한 항목은 합치기 대상이 되지 않도록 at = -Infinity
      if (result) past.push({ ...result.entry, at: Number.NEGATIVE_INFINITY });
      onChange();
      return result;
    },

    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    /** 가장 최근에 기록된 (실행 취소할) 항목 */
    peek: () => past[past.length - 1] ?? null,

    clear() {
      past = [];
      future = [];
      onChange();
    },
  };
}
