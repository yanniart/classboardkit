import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/core/store.js';

test('getState returns the initial state', () => {
  const store = createStore({ count: 0 });
  assert.deepEqual(store.getState(), { count: 0 });
});

test('update replaces state and notifies subscribers with next and prev', () => {
  const store = createStore({ count: 0 });
  const calls = [];
  store.subscribe((next, prev) => calls.push([next.count, prev.count]));
  store.update((s) => ({ count: s.count + 1 }));
  assert.equal(store.getState().count, 1);
  assert.deepEqual(calls, [[1, 0]]);
});

test('returning the same reference does not notify', () => {
  const store = createStore({ count: 0 });
  let calls = 0;
  store.subscribe(() => (calls += 1));
  store.update((s) => s);
  assert.equal(calls, 0);
});

test('unsubscribe stops notifications', () => {
  const store = createStore({ count: 0 });
  let calls = 0;
  const off = store.subscribe(() => (calls += 1));
  off();
  store.update((s) => ({ count: s.count + 1 }));
  assert.equal(calls, 0);
});

test('a listener unsubscribing during dispatch does not skip others', () => {
  const store = createStore({ n: 0 });
  const seen = [];
  const off = store.subscribe(() => {
    seen.push('a');
    off();
  });
  store.subscribe(() => seen.push('b'));
  store.update(() => ({ n: 1 }));
  assert.deepEqual(seen, ['a', 'b']);
});

test('update rejects non-function arguments', () => {
  const store = createStore({});
  assert.throws(() => store.update(/** @type {any} */ ({ a: 1 })), TypeError);
});
