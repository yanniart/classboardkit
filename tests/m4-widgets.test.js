import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DICE,
  createDiceState,
  pipCells,
  roll,
  rollValues,
  setCount,
  total,
} from '../src/widgets/dice/dice-logic.js';
import {
  calendarDays,
  createCountdownState,
  ddayLabel,
  formatClock,
  nextTickDelay,
  parseTarget,
  remaining,
  setTitle,
  withParts,
} from '../src/widgets/countdown/countdown-logic.js';
import {
  MAX_POINTS,
  SCALE,
  addStroke,
  clear,
  compressPoints,
  containRect,
  createDrawState,
  dedupe,
  pointCount,
  quantize,
  simplify,
  strokeWidthPx,
  undo,
} from '../src/widgets/draw/draw-logic.js';
import {
  ALARM_AFTER_MS,
  clampThreshold,
  createNoiseState,
  levelFromRms,
  micErrorKind,
  mood,
  rms,
  smooth,
  updateAlarm,
} from '../src/widgets/noise/noise-logic.js';

// ── 주사위 ──

test('dice state defaults and count clamping', () => {
  const s = createDiceState();
  assert.deepEqual(s, { count: 2, values: [], sides: 6 });
  assert.equal(setCount(s, 0).count, 1);
  assert.equal(setCount(s, 99).count, MAX_DICE);
  assert.equal(setCount(s, 2), s, 'same count → same object');
  assert.deepEqual(setCount(roll(s), 3).values, [], 'changing count clears old result');
});

test('roll produces count values in 1..6 and total matches', () => {
  for (let count = 1; count <= 6; count += 1) {
    const s = roll(setCount(createDiceState(), count));
    assert.equal(s.values.length, count);
    assert.ok(s.values.every((v) => Number.isInteger(v) && v >= 1 && v <= 6), String(s.values));
    assert.equal(total(s.values), s.values.reduce((a, b) => a + b, 0));
  }
  // 결정적 rng: 0 → 1, 5 → 6
  assert.deepEqual(rollValues(2, () => 0), [1, 1]);
  assert.deepEqual(rollValues(1, () => 5), [6]);
});

test('dice faces are roughly uniform', () => {
  const counts = new Array(6).fill(0);
  const n = 30000;
  for (let i = 0; i < n / 6; i += 1) for (const v of rollValues(6)) counts[v - 1] += 1;
  // 기대값 5000, 표준편차 약 65 → ±400은 매우 넉넉함
  for (const c of counts) assert.ok(Math.abs(c - n / 6) < 400, String(counts));
});

test('pip layout has value pips', () => {
  for (let v = 1; v <= 6; v += 1) assert.equal(pipCells(v).length, v);
  assert.deepEqual(pipCells(0), []);
});

// ── 카운트다운 ──

test('countdown default is tomorrow 09:00 local', () => {
  assert.equal(createCountdownState(new Date(2026, 11, 31, 15, 0)).target, '2027-01-01T09:00');
  assert.equal(createCountdownState(new Date(2028, 1, 28, 8, 0)).target, '2028-02-29T09:00', 'leap year');
});

test('parseTarget validates format and calendar', () => {
  assert.ok(parseTarget('2026-11-05T09:30'));
  assert.equal(parseTarget('2026-02-30T09:00'), null);
  assert.equal(parseTarget('2027-02-29T09:00'), null, 'not a leap year');
  assert.ok(parseTarget('2028-02-29T09:00'));
  assert.equal(parseTarget('2026-11-05T24:00'), null);
  assert.equal(parseTarget('2026-11-05 09:00'), null);
  assert.equal(parseTarget(''), null);
});

test('withParts merges date/time and keeps old value on invalid input', () => {
  assert.equal(withParts('2026-11-05T09:00', { date: '2026-12-24' }), '2026-12-24T09:00');
  assert.equal(withParts('2026-11-05T09:00', { time: '13:45' }), '2026-11-05T13:45');
  assert.equal(withParts('2026-11-05T09:00', { date: '', time: '' }), '2026-11-05T09:00');
  assert.equal(withParts('2026-11-05T09:00', { date: '2026-02-31' }), '2026-11-05T09:00');
});

test('remaining splits days/hours/minutes/seconds', () => {
  const now = new Date(2026, 10, 5, 8, 59, 30);
  assert.deepEqual(remaining('2026-11-06T10:00', now), {
    past: false, totalSeconds: 90030, days: 1, hours: 1, minutes: 0, seconds: 30,
  });
  const exact = remaining('2026-11-05T09:00', new Date(2026, 10, 5, 9, 0, 0));
  assert.equal(exact.past, true, 'exactly at target counts as reached');
  assert.equal(exact.totalSeconds, 0);
  const past = remaining('2026-11-05T08:00', now);
  assert.equal(past.past, true);
  assert.equal(past.minutes, 59);
  assert.equal(remaining('bad', now), null);
});

test('D-day label uses calendar days (midnight boundary)', () => {
  const lateNight = new Date(2026, 10, 5, 23, 59);
  assert.equal(ddayLabel('2026-11-06T00:01', lateNight), 'D-1', 'two minutes away but tomorrow');
  assert.equal(ddayLabel('2026-11-05T23:00', lateNight), 'D-Day');
  assert.equal(ddayLabel('2026-11-03T09:00', lateNight), 'D+2');
  assert.equal(ddayLabel('2026-12-25T09:00', new Date(2026, 10, 5)), 'D-50');
  // 해를 넘김·윤년
  assert.equal(calendarDays('2028-03-01T00:00', new Date(2028, 1, 28, 12)), 2);
  assert.equal(calendarDays('2027-01-01T00:00', new Date(2026, 11, 31, 23)), 1);
});

test('formatClock and tick delay', () => {
  assert.equal(formatClock({ hours: 3, minutes: 5, seconds: 9 }, false), '3:05');
  assert.equal(formatClock({ hours: 3, minutes: 5, seconds: 9 }, true), '3:05:09');
  const now = new Date(2026, 10, 5, 10, 20, 30, 250);
  assert.equal(nextTickDelay({ days: 0 }, false, now), 755, 'under a day → every second');
  assert.equal(nextTickDelay({ days: 2 }, true, now), 755, 'seconds shown → every second');
  assert.equal(nextTickDelay({ days: 2 }, false, now), 29_755, 'otherwise next minute boundary');
});

test('countdown title is trimmed to the limit', () => {
  const s = createCountdownState(new Date(2026, 10, 5));
  assert.equal(setTitle(s, 'x'.repeat(100)).title.length, 60);
  assert.equal(setTitle(s, ''), s);
});

// ── 그리기 ──

test('quantize clamps and rounds to 0..10000', () => {
  assert.equal(quantize(-0.5), 0);
  assert.equal(quantize(1.2), 10000);
  assert.equal(quantize(0.12345), 1235);
  // 왕복 오차는 1/20000 이하
  for (const v of [0, 0.1, 0.33333, 0.5, 0.99999]) assert.ok(Math.abs(quantize(v) / SCALE - v) <= 0.5 / SCALE);
});

test('simplify keeps endpoints, drops collinear points, keeps corners', () => {
  const line = [];
  for (let i = 0; i <= 100; i += 1) line.push(i * 100, 5000);
  assert.deepEqual(simplify(line), [0, 5000, 10000, 5000]);
  const corner = [0, 0, 2500, 0, 5000, 0, 5000, 2500, 5000, 5000];
  assert.deepEqual(simplify(corner), [0, 0, 5000, 0, 5000, 5000]);
  assert.deepEqual(simplify([1, 2]), [1, 2]);
  // 허용 오차 이하의 흔들림은 제거
  assert.deepEqual(simplify([0, 0, 500, 10, 1000, 0]), [0, 0, 1000, 0]);
  assert.equal(simplify([0, 0, 500, 100, 1000, 0]).length, 6);
});

test('compressPoints quantizes, dedupes and simplifies', () => {
  const pts = [0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.3, 0.1];
  assert.deepEqual(compressPoints(pts), [1000, 1000, 3000, 1000]);
  assert.deepEqual(dedupe([1, 1, 1, 1, 2, 2]), [1, 1, 2, 2]);
});

test('addStroke sets aspect on first stroke and enforces the point cap', () => {
  let s = createDrawState();
  s = addStroke(s, { c: 'ink', w: 'm', p: [0, 0, 100, 100] }, 1.5);
  assert.equal(s.aspect, 1.5);
  s = addStroke(s, { c: 'red', w: 's', p: [5, 5] }, 2);
  assert.equal(s.aspect, 1.5, 'aspect fixed after first stroke');
  assert.equal(pointCount(s.strokes), 3);
  const big = { c: 'ink', w: 'm', p: new Array((MAX_POINTS - 3) * 2).fill(1) };
  const full = addStroke(s, big, 1);
  assert.equal(pointCount(full.strokes), MAX_POINTS);
  assert.equal(addStroke(full, { c: 'ink', w: 'm', p: [1, 1] }, 1), null, 'over the cap → null');
  assert.equal(addStroke(s, { c: 'ink', w: 'm', p: [] }, 1), s, 'empty stroke ignored');
});

test('undo/clear reset aspect when empty', () => {
  const one = addStroke(createDrawState(), { c: 'ink', w: 'm', p: [1, 1] }, 2);
  assert.deepEqual(undo(one), { strokes: [], aspect: null });
  assert.deepEqual(clear(one), createDrawState());
  const empty = createDrawState();
  assert.equal(undo(empty), empty);
  assert.equal(clear(empty), empty);
});

test('containRect centers the drawing area and stroke width scales', () => {
  assert.deepEqual(containRect(400, 200, 1), { x: 100, y: 0, w: 200, h: 200 });
  assert.deepEqual(containRect(200, 400, 1), { x: 0, y: 100, w: 200, h: 200 });
  assert.deepEqual(containRect(300, 200, null), { x: 0, y: 0, w: 300, h: 200 });
  const r = { w: 500, h: 400 };
  assert.ok(strokeWidthPx({ c: 'ink', w: 'l', p: [] }, r) > strokeWidthPx({ c: 'ink', w: 's', p: [] }, r));
  assert.ok(strokeWidthPx({ c: 'ink', w: 'm', e: true, p: [] }, r) > strokeWidthPx({ c: 'ink', w: 'l', p: [] }, r));
});

// ── 소음 측정기 ──

test('rms and level mapping (log scale, sensitivity)', () => {
  assert.equal(rms([]), 0);
  assert.equal(rms([0.5, -0.5, 0.5, -0.5]), 0.5);
  assert.equal(levelFromRms(0, 'mid'), 0);
  assert.equal(levelFromRms(1, 'mid'), 100, 'clamped at 100');
  // -55 dB(mid floor) → 0, -10 dB → 100, 중간 -32.5 dB → 50
  assert.ok(Math.abs(levelFromRms(10 ** (-32.5 / 20), 'mid') - 50) < 1e-9);
  const quiet = 10 ** (-50 / 20);
  assert.ok(levelFromRms(quiet, 'high') > levelFromRms(quiet, 'mid'));
  assert.ok(levelFromRms(quiet, 'mid') > levelFromRms(quiet, 'low'));
  assert.equal(levelFromRms(quiet, 'low'), 0);
});

test('smoothing rises fast and falls slowly', () => {
  assert.ok(smooth(0, 100) > 100 - smooth(100, 0), 'attack faster than release');
  assert.equal(smooth(50, 50), 50);
});

test('alarm only after staying above threshold for 1s', () => {
  let a = { overSince: null, alarm: false };
  a = updateAlarm(a, 70, 60, 0);
  assert.deepEqual(a, { overSince: 0, alarm: false });
  a = updateAlarm(a, 75, 60, 900);
  assert.equal(a.alarm, false);
  a = updateAlarm(a, 75, 60, ALARM_AFTER_MS);
  assert.equal(a.alarm, true);
  const same = updateAlarm(a, 80, 60, 1500);
  assert.equal(same, a, 'unchanged object when nothing changes');
  a = updateAlarm(a, 40, 60, 1600);
  assert.deepEqual(a, { overSince: null, alarm: false });
  // 짧은 소음(0.5초)은 무시
  let b = updateAlarm({ overSince: null, alarm: false }, 90, 60, 0);
  b = updateAlarm(b, 90, 60, 500);
  b = updateAlarm(b, 30, 60, 600);
  assert.equal(b.alarm, false);
});

test('mood, threshold clamp and mic error kinds', () => {
  assert.equal(mood(10, 60), 'calm');
  assert.equal(mood(50, 60), 'ok');
  assert.equal(mood(61, 60), 'loud');
  assert.equal(clampThreshold(0), 5);
  assert.equal(clampThreshold(200), 95);
  assert.equal(clampThreshold('62.4'), 62);
  assert.equal(micErrorKind({ name: 'NotAllowedError' }), 'denied');
  assert.equal(micErrorKind({ name: 'NotFoundError' }), 'no-mic');
  assert.equal(micErrorKind({ name: 'NotReadableError' }), 'busy');
  assert.equal(micErrorKind(new Error('x')), 'failed');
  assert.deepEqual(createNoiseState(), { threshold: 60, sensitivity: 'mid', style: 'bar' });
});
