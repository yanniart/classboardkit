/**
 * 단일 상태 저장소.
 * 상태는 불변으로 다루며, update()는 항상 새 객체를 받아 교체한다.
 *
 * @template T
 * @param {T} initialState
 */
export function createStore(initialState) {
  let state = initialState;
  /** @type {Set<(next: T, prev: T) => void>} */
  const listeners = new Set();

  return {
    /** @returns {T} */
    getState() {
      return state;
    },

    /**
     * @param {(prev: T) => T} updater 이전 상태를 받아 새 상태를 반환하는 함수
     */
    update(updater) {
      if (typeof updater !== 'function') {
        throw new TypeError('update() expects an updater function');
      }
      const prev = state;
      const next = updater(prev);
      // 같은 참조를 반환하면 변경 없음으로 간주
      if (next === prev) return;
      state = next;
      for (const listener of [...listeners]) listener(next, prev);
    },

    /**
     * @param {(next: T, prev: T) => void} listener
     * @returns {() => void} 구독 해제 함수
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
