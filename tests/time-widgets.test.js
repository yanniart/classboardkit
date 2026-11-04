import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LAPS,
  createStopwatchState,
  formatStopwatch,
  getElapsed,
  lap,
  lapDurations,
  pause,
  reset,
  start,
} from '../src/widgets/stopwatch/stopwatch-logic.js';
import { createClockState, formatClock, formatDate, handAngles, msUntilNextSecond } from '../src/widgets/clock/clock-logic.js';
import {
  createTimerState,
  getProgress,
  setDuration,
  start as startTimer,
  pause as pauseTimer,
  MAX_MS,
} from '../src/widgets/timer/timer-logic.js';
import { createTrafficState, setLabel, setLight } from '../src/widgets/traffic/index.js';

const T = 1_000_000;

// ── 스톱워치 ──

test('stopwatch accumulates across pause/resume', () => {
  let s = start(createStopwatchState(), T);
  assert.equal(getElapsed(s, T + 1500), 1500);
  s = pause(s, T + 1500);
  assert.deepEqual(s, { status: 'paused', elapsedMs: 1500, laps: [] });
  assert.equal(getElapsed(s, T + 99999), 1500);
  s = start(s, T + 5000);
  assert.equal(getElapsed(s, T + 5500), 2000);
  assert.equal(start(s, T + 6000), s);
});

test('stopwatch laps record split times only while running', () => {
  let s = start(createStopwatchState(), T);
  s = lap(s, T + 1000);
  s = lap(s, T + 2500);
  assert.deepEqual(s.laps, [1000, 2500]);
  assert.deepEqual(lapDurations(s.laps), [1000, 1500]);
  const paused = pause(s, T + 3000);
  assert.equal(lap(paused, T + 4000), paused);
  let full = start(createStopwatchState(), T);
  for (let i = 0; i < MAX_LAPS + 5; i += 1) full = lap(full, T + i);
  assert.equal(full.laps.length, MAX_LAPS);
});

test('stopwatch reset returns to a clean state', () => {
  const s = pause(lap(start(createStopwatchState(), T), T + 10), T + 20);
  assert.deepEqual(reset(s), createStopwatchState());
  const fresh = createStopwatchState();
  assert.equal(reset(fresh), fresh);
});

test('formatStopwatch shows centiseconds and hours when needed', () => {
  assert.deepEqual(formatStopwatch(0), { main: '00:00', fraction: '.00' });
  assert.deepEqual(formatStopwatch(61_234), { main: '01:01', fraction: '.23' });
  assert.deepEqual(formatStopwatch(3_723_456), { main: '1:02:03', fraction: '.45' });
});

// ── 시계 ──

test('handAngles', () => {
  const d = new Date(2026, 10, 4, 15, 30, 0);
  assert.deepEqual(handAngles(d), { hour: 105, minute: 180, second: 0 });
  const noon = new Date(2026, 10, 4, 12, 0, 30);
  assert.deepEqual(handAngles(noon), { hour: 0.25, minute: 3, second: 180 });
});

test('formatClock 24h/12h with separate day period', () => {
  const d = new Date(2026, 10, 4, 15, 5, 9);
  assert.deepEqual(formatClock(d, { locale: 'en', hour12: false, showSeconds: true }), { time: '15:05:09', period: '' });
  assert.deepEqual(formatClock(d, { locale: 'en', hour12: false, showSeconds: false }), { time: '15:05', period: '' });
  const en12 = formatClock(d, { locale: 'en', hour12: true, showSeconds: false });
  assert.equal(en12.time, '3:05');
  assert.equal(en12.period, 'PM');
  const ko12 = formatClock(d, { locale: 'ko', hour12: true, showSeconds: false });
  assert.equal(ko12.time, '3:05');
  assert.equal(ko12.period, '오후');
});

test('formatDate is localized; msUntilNextSecond aligns to the second', () => {
  const d = new Date(2026, 10, 4, 9, 0, 0);
  assert.match(formatDate(d, 'en'), /Wednesday.*November.*4|November 4/);
  assert.match(formatDate(d, 'ko'), /11월 4일/);
  assert.equal(msUntilNextSecond(12_300), 700);
  assert.equal(msUntilNextSecond(13_000), 1000);
  assert.deepEqual(createClockState(), { style: 'digital', hour12: false, showSeconds: true, showDate: true });
});

// ── 타이머 추가 기능 ──

test('getProgress for the visual ring', () => {
  const idle = createTimerState();
  assert.equal(getProgress(idle, T), 1);
  const running = startTimer(idle, T);
  assert.equal(getProgress(running, T + 150_000), 0.5);
  assert.equal(getProgress(setDuration(idle, 0), T), 0);
});

test('setDuration resets to idle, rounds to seconds and clamps', () => {
  const running = startTimer(createTimerState(), T);
  const set = setDuration(running, 90_400);
  assert.deepEqual(set, { durationMs: 90_000, mode: 'digital', sound: true, status: 'idle' });
  assert.equal(setDuration(set, 90_000), set);
  assert.equal(setDuration(set, 999_999_999).durationMs, MAX_MS);
  assert.equal(setDuration(pauseTimer(running, T + 1), 60_000).status, 'idle');
});

// ── 신호등 ──

test('traffic light state helpers', () => {
  const s = createTrafficState();
  assert.equal(s.light, 'red');
  assert.equal(setLight(s, 'green').light, 'green');
  assert.equal(setLight(s, 'purple'), s);
  assert.equal(setLight(s, 'red'), s);
  assert.equal(setLabel(s, 'yellow', '모둠 토의').labels.yellow, '모둠 토의');
  assert.equal(setLabel(s, 'yellow', 'x'.repeat(80)).labels.yellow.length, 40);
});
