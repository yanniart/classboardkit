import { pickOne } from '../../core/utils/random.js';

export const HISTORY_LIMIT = 50;

/**
 * @typedef {{
 *   items: string[],
 *   excludePicked: boolean,
 *   picked: string[],
 *   history: { value: string, at: number }[],
 * }} RandomizerState
 */

/** @returns {RandomizerState} */
export function createRandomizerState() {
  return { items: [], excludePicked: true, picked: [], history: [] };
}

/** 이번에 뽑을 수 있는 항목 @param {RandomizerState} s */
export function getAvailable(s) {
  if (!s.excludePicked) return s.items;
  const picked = new Set(s.picked);
  return s.items.filter((item) => !picked.has(item));
}

/**
 * 명단 교체. 사라진 이름은 '뽑힘' 목록에서도 뺀다. 이력은 유지.
 * @param {RandomizerState} s
 * @param {string[]} items
 * @returns {RandomizerState}
 */
export function setItems(s, items) {
  const set = new Set(items);
  return { ...s, items, picked: s.picked.filter((p) => set.has(p)) };
}

/**
 * 하나 뽑기. 뽑을 항목이 없으면 value가 null이고 상태는 그대로.
 * @param {RandomizerState} s
 * @param {import('../../core/utils/random.js').Rng} [rng]
 * @param {number} [now]
 * @returns {{ state: RandomizerState, value: string | null }}
 */
export function pick(s, rng, now = Date.now()) {
  const value = pickOne(getAvailable(s), rng);
  if (value === undefined) return { state: s, value: null };
  return {
    value,
    state: {
      ...s,
      picked: s.excludePicked ? [...s.picked, value] : s.picked,
      history: [{ value, at: now }, ...s.history].slice(0, HISTORY_LIMIT),
    },
  };
}

/** 모두 다시 뽑을 수 있게 @param {RandomizerState} s @returns {RandomizerState} */
export function resetPicked(s) {
  return s.picked.length ? { ...s, picked: [] } : s;
}

/** @param {RandomizerState} s @param {boolean} on @returns {RandomizerState} */
export function setExcludePicked(s, on) {
  return s.excludePicked === on ? s : { ...s, excludePicked: on, picked: on ? s.picked : [] };
}

/** @param {RandomizerState} s */
export function clearHistory(s) {
  return s.history.length || s.picked.length ? { ...s, history: [], picked: [] } : s;
}
