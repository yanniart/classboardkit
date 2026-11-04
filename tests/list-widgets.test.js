import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ITEMS, MAX_ITEM_LENGTH, parseItems } from '../src/widgets/shared/list.js';
import {
  HISTORY_LIMIT,
  clearHistory,
  createRandomizerState,
  getAvailable,
  pick,
  resetPicked,
  setExcludePicked,
  setItems as setRandomizerItems,
} from '../src/widgets/randomizer/randomizer-logic.js';
import {
  createGroupsState,
  groupCount,
  makeGroups,
  regroup,
  setItems as setGroupItems,
  setRule,
} from '../src/widgets/groups/groups-logic.js';

const zeroRng = () => 0;

// ── 명단 파싱 ──

test('parseItems trims, splits on newline/comma/tab, drops blanks and duplicates', () => {
  assert.deepEqual(parseItems(' 민수 \n\n서연, 지호\t민수\n  '), ['민수', '서연', '지호']);
});

test('parseItems enforces length and count limits', () => {
  assert.equal(parseItems('x'.repeat(100))[0].length, MAX_ITEM_LENGTH);
  const many = Array.from({ length: 300 }, (_, i) => `n${i}`).join('\n');
  assert.equal(parseItems(many).length, MAX_ITEMS);
});

// ── 랜덤 뽑기 ──

const withNames = (...names) => setRandomizerItems(createRandomizerState(), names);

test('pick without repeats drains the list, then returns null', () => {
  let s = withNames('a', 'b', 'c');
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    const r = pick(s, undefined, 1000 + i);
    seen.push(r.value);
    s = r.state;
  }
  assert.deepEqual([...seen].sort(), ['a', 'b', 'c']);
  assert.deepEqual(getAvailable(s), []);
  const none = pick(s);
  assert.equal(none.value, null);
  assert.equal(none.state, s);
  assert.deepEqual(s.history.map((h) => h.value), [...seen].reverse(), 'newest first');
});

test('pick with repeats allowed never marks picked', () => {
  let s = setExcludePicked(withNames('a', 'b'), false);
  for (let i = 0; i < 5; i += 1) s = pick(s).state;
  assert.deepEqual(s.picked, []);
  assert.equal(s.history.length, 5);
  assert.equal(getAvailable(s).length, 2);
});

test('history is capped', () => {
  let s = setExcludePicked(withNames('a'), false);
  for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) s = pick(s).state;
  assert.equal(s.history.length, HISTORY_LIMIT);
});

test('setItems drops picked names that were removed', () => {
  let s = withNames('a', 'b', 'c');
  s = pick(s, zeroRng).state; // 'a'
  assert.deepEqual(s.picked, ['a']);
  s = setRandomizerItems(s, ['b', 'c']);
  assert.deepEqual(s.picked, []);
});

test('resetPicked, setExcludePicked(false) and clearHistory', () => {
  let s = pick(withNames('a', 'b'), zeroRng).state;
  assert.deepEqual(resetPicked(s).picked, []);
  assert.deepEqual(setExcludePicked(s, false).picked, []);
  const cleared = clearHistory(s);
  assert.deepEqual([cleared.picked, cleared.history], [[], []]);
  const fresh = createRandomizerState();
  assert.equal(resetPicked(fresh), fresh);
  assert.equal(clearHistory(fresh), fresh);
});

// ── 모둠 편성 ──

test('groupCount for count and size modes', () => {
  assert.equal(groupCount(10, 'count', 4), 4);
  assert.equal(groupCount(3, 'count', 4), 3, 'never more groups than people');
  assert.equal(groupCount(10, 'size', 3), 4);
  assert.equal(groupCount(9, 'size', 3), 3);
  assert.equal(groupCount(0, 'count', 4), 0);
});

test('makeGroups keeps everyone exactly once with sizes differing by at most 1', () => {
  const names = Array.from({ length: 23 }, (_, i) => `s${i}`);
  for (const [by, n] of [['count', 4], ['count', 7], ['size', 3], ['size', 5], ['count', 30]]) {
    const groups = makeGroups(names, /** @type {any} */ (by), n);
    assert.equal(groups.length, groupCount(names.length, /** @type {any} */ (by), n));
    assert.deepEqual(groups.flat().sort(), [...names].sort());
    const sizes = groups.map((g) => g.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${by} ${n}: ${sizes}`);
    if (by === 'size') assert.ok(Math.max(...sizes) <= n);
  }
});

test('setItems and setRule invalidate the previous result; rule is clamped', () => {
  let s = regroup(setGroupItems(createGroupsState(), ['a', 'b', 'c', 'd']));
  assert.equal(s.result.length, 4);
  assert.deepEqual(setGroupItems(s, ['a']).result, []);
  const ruled = setRule(s, 'size', 99);
  assert.equal(ruled.n, 20);
  assert.deepEqual(ruled.result, []);
  assert.equal(setRule(ruled, 'size', 20), ruled);
  assert.equal(setRule(s, 'count', 0).n, 1);
});
