import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '../src/core/utils/id.js';
import { debounce } from '../src/core/utils/debounce.js';
import { createMemoryStorage } from '../src/core/utils/memory-storage.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('createId has prefix, length and is practically unique', () => {
  const ids = new Set(Array.from({ length: 5000 }, () => createId('w')));
  assert.equal(ids.size, 5000);
  for (const id of ids) assert.match(id, /^w_[0-9a-z]{8}$/);
  assert.match(createId('b', 4), /^b_[0-9a-z]{4}$/);
});

test('debounce runs once with the latest args', async () => {
  const calls = [];
  const fn = debounce((v) => calls.push(v), 15);
  fn(1);
  fn(2);
  fn(3);
  await sleep(30);
  assert.deepEqual(calls, [3]);
});

test('debounce flush runs pending call immediately; cancel drops it', async () => {
  const calls = [];
  const fn = debounce((v) => calls.push(v), 15);
  fn('a');
  fn.flush();
  assert.deepEqual(calls, ['a']);
  fn.flush(); // 대기 중인 호출이 없으면 아무 일도 없음
  fn('b');
  fn.cancel();
  await sleep(30);
  assert.deepEqual(calls, ['a']);
});

test('memory storage behaves like localStorage', () => {
  const s = createMemoryStorage();
  assert.equal(s.getItem('x'), null);
  s.setItem('x', 1);
  assert.equal(s.getItem('x'), '1');
  assert.equal(s.length, 1);
  assert.equal(s.key(0), 'x');
  s.removeItem('x');
  assert.equal(s.length, 0);
});

test('memory storage enforces quota and keeps previous value', () => {
  const s = createMemoryStorage({ quotaBytes: 20 });
  s.setItem('k', 'abc');
  assert.throws(() => s.setItem('k', 'x'.repeat(100)), { name: 'QuotaExceededError' });
  assert.equal(s.getItem('k'), 'abc');
});
