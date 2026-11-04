import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickOne, randomInt, shuffle } from '../src/core/utils/random.js';

/** 정해진 값을 차례로 반환하는 rng */
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('randomInt rejects values in the biased tail', () => {
  // max=3: limit = 2^32 - (2^32 % 3) = 4294967295 → 4294967295는 거부되고 다음 값 사용
  const rng = seq(4294967295, 7);
  assert.equal(randomInt(3, rng), 7 % 3);
});

test('randomInt validates max', () => {
  assert.throws(() => randomInt(0));
  assert.throws(() => randomInt(1.5));
  assert.equal(randomInt(1), 0);
});

test('randomInt with crypto is roughly uniform', () => {
  const counts = new Array(6).fill(0);
  const n = 60000;
  for (let i = 0; i < n; i += 1) counts[randomInt(6)] += 1;
  // 각 칸 기대값 10000, 허용 오차 ±5% (표준편차 약 91 → 매우 넉넉함)
  for (const c of counts) assert.ok(Math.abs(c - n / 6) < 500, String(counts));
});

test('shuffle returns a permutation without mutating input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...out].sort((a, b) => a - b), input);
});

test('shuffle is deterministic with an injected rng', () => {
  assert.deepEqual(shuffle(['a', 'b', 'c'], seq(0)), ['b', 'c', 'a']);
});

test('shuffle produces every permutation of 3 items with similar frequency', () => {
  const counts = new Map();
  for (let i = 0; i < 12000; i += 1) {
    const key = shuffle(['a', 'b', 'c']).join('');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 6);
  for (const c of counts.values()) assert.ok(Math.abs(c - 2000) < 250, JSON.stringify([...counts]));
});

test('pickOne handles empty arrays', () => {
  assert.equal(pickOne([]), undefined);
  assert.equal(pickOne(['x']), 'x');
});
