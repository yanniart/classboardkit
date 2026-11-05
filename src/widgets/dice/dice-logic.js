import { randomInt } from '../../core/utils/random.js';

export const MIN_DICE = 1;
export const MAX_DICE = 6;
export const SIDES = 6;

/**
 * @typedef {{ count: number, values: number[], sides: 6 }} DiceState
 * values는 마지막으로 굴린 결과 (각 1~6). 아직 굴리지 않았으면 빈 배열.
 */

/** @returns {DiceState} */
export function createDiceState() {
  return { count: 2, values: [], sides: SIDES };
}

/** @param {number} n */
const clampCount = (n) => Math.min(MAX_DICE, Math.max(MIN_DICE, Math.round(Number(n) || MIN_DICE)));

/**
 * 주사위 개수 변경. 개수가 바뀌면 이전 결과는 지운다 (합계가 섞이지 않게).
 * @param {DiceState} s @param {number} count @returns {DiceState}
 */
export function setCount(s, count) {
  const next = clampCount(count);
  if (next === s.count) return s;
  return { ...s, count: next, values: [] };
}

/**
 * 1~6 값 count개 (공정한 난수)
 * @param {number} count @param {import('../../core/utils/random.js').Rng} [rng]
 */
export function rollValues(count, rng) {
  return Array.from({ length: clampCount(count) }, () => randomInt(SIDES, rng) + 1);
}

/** @param {DiceState} s @param {import('../../core/utils/random.js').Rng} [rng] @returns {DiceState} */
export function roll(s, rng) {
  return { ...s, values: rollValues(s.count, rng) };
}

/** @param {readonly number[]} values */
export function total(values) {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * 3×3 격자에서 점이 찍히는 칸 (0~8, 왼쪽 위부터)
 * @param {number} value 1~6 (그 외는 빈 면)
 */
export function pipCells(value) {
  return (
    /** @type {Record<number, number[]>} */ ({
      1: [4],
      2: [2, 6],
      3: [2, 4, 6],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    })[value] ?? []
  );
}
