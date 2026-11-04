/**
 * 공정한 난수 (F-104, F-105).
 * rng는 0 ~ 2^32-1 정수를 반환하는 함수. 기본값은 crypto.getRandomValues.
 * 테스트에서는 결정적 rng를 주입한다.
 *
 * @typedef {() => number} Rng
 */

const UINT32 = 2 ** 32;

/** @type {Rng} */
export function cryptoRng() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0];
}

/**
 * 0 이상 max 미만 정수. 거부 샘플링으로 모듈로 편향을 없앤다.
 * @param {number} max 1 이상 2^32 이하
 * @param {Rng} [rng]
 */
export function randomInt(max, rng = cryptoRng) {
  if (!Number.isInteger(max) || max < 1 || max > UINT32) throw new RangeError(`randomInt: invalid max ${max}`);
  const limit = UINT32 - (UINT32 % max);
  for (;;) {
    const x = rng();
    if (x < limit) return x % max;
  }
}

/**
 * Fisher–Yates 셔플. 원본은 바꾸지 않는다.
 * @template T
 * @param {readonly T[]} items
 * @param {Rng} [rng]
 * @returns {T[]}
 */
export function shuffle(items, rng = cryptoRng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1, rng);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @template T
 * @param {readonly T[]} items
 * @param {Rng} [rng]
 * @returns {T | undefined}
 */
export function pickOne(items, rng = cryptoRng) {
  return items.length ? items[randomInt(items.length, rng)] : undefined;
}
