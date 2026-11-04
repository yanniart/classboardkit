import { shuffle } from '../../core/utils/random.js';

export const MIN_N = 1;
export const MAX_N = 20;

/**
 * @typedef {{ items: string[], by: 'count' | 'size', n: number, result: string[][] }} GroupsState
 */

/** @returns {GroupsState} */
export function createGroupsState() {
  return { items: [], by: 'count', n: 4, result: [] };
}

const clampN = (n) => Math.min(Math.max(Math.round(n), MIN_N), MAX_N);

/**
 * 만들어질 모둠 수.
 * - count: n개 (인원보다 많을 수 없음)
 * - size: 모둠당 최대 n명 → ceil(인원/n)개, 크기 차이는 최대 1명
 * @param {number} total
 * @param {'count' | 'size'} by
 * @param {number} n
 */
export function groupCount(total, by, n) {
  if (total === 0) return 0;
  return by === 'count' ? Math.min(clampN(n), total) : Math.ceil(total / clampN(n));
}

/**
 * 무작위로 섞은 뒤 돌아가며 배정 → 모둠 크기 차이가 최대 1명.
 * @param {string[]} items
 * @param {'count' | 'size'} by
 * @param {number} n
 * @param {import('../../core/utils/random.js').Rng} [rng]
 * @returns {string[][]}
 */
export function makeGroups(items, by, n, rng) {
  const k = groupCount(items.length, by, n);
  /** @type {string[][]} */
  const groups = Array.from({ length: k }, () => []);
  shuffle(items, rng).forEach((item, i) => groups[i % k].push(item));
  return groups;
}

/** @param {GroupsState} s @param {import('../../core/utils/random.js').Rng} [rng] @returns {GroupsState} */
export function regroup(s, rng) {
  return { ...s, result: makeGroups(s.items, s.by, s.n, rng) };
}

/** 명단이 바뀌면 이전 결과는 무효 @param {GroupsState} s @param {string[]} items @returns {GroupsState} */
export function setItems(s, items) {
  return { ...s, items, result: [] };
}

/** @param {GroupsState} s @param {'count' | 'size'} by @param {number} n @returns {GroupsState} */
export function setRule(s, by, n) {
  const next = clampN(n);
  if (s.by === by && s.n === next) return s;
  return { ...s, by, n: next, result: [] };
}
