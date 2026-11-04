import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MS,
  adjustDuration,
  createTimerState,
  finish,
  formatMs,
  getRemainingMs,
  isExpired,
  pause,
  reset,
  start,
} from '../src/widgets/timer/timer-logic.js';

const NOW = 1_000_000;

test('default state is a 5 minute idle timer', () => {
  const s = createTimerState();
  assert.deepEqual(s, { durationMs: 300000, mode: 'digital', status: 'idle', sound: true });
  assert.equal(getRemainingMs(s, NOW), 300000);
});

test('start stores an absolute end time; remaining is computed from the clock', () => {
  const running = start(createTimerState(), NOW);
  assert.equal(running.status, 'running');
  assert.equal(running.endAt, NOW + 300000);
  assert.equal(getRemainingMs(running, NOW + 1000), 299000);
  assert.equal(getRemainingMs(running, NOW + 999999), 0);
  assert.equal(start(running, NOW + 5), running, 'starting twice is a no-op');
});

test('pause freezes the remaining time and resume continues from it', () => {
  const running = start(createTimerState(), NOW);
  const paused = pause(running, NOW + 60000);
  assert.deepEqual(paused, {
    durationMs: 300000,
    mode: 'digital',
    sound: true,
    status: 'paused',
    remainingMs: 240000,
  });
  assert.equal(getRemainingMs(paused, NOW + 999999), 240000);
  const resumed = start(paused, NOW + 100000);
  assert.equal(resumed.endAt, NOW + 100000 + 240000);
  assert.equal('remainingMs' in resumed, false);
});

test('isExpired only when running past the end', () => {
  const running = start(createTimerState(), NOW);
  assert.equal(isExpired(running, NOW + 299999), false);
  assert.equal(isExpired(running, NOW + 300000), true);
  assert.equal(isExpired(pause(running, NOW), NOW + 999999), false);
});

test('finish and reset clear progress fields; start after done restarts', () => {
  const done = finish(start(createTimerState(), NOW));
  assert.deepEqual(done, { durationMs: 300000, mode: 'digital', sound: true, status: 'done' });
  assert.equal(getRemainingMs(done, NOW), 0);
  assert.equal(start(done, NOW).endAt, NOW + 300000);
  assert.deepEqual(reset(done), { durationMs: 300000, mode: 'digital', sound: true, status: 'idle' });
  const idle = createTimerState();
  assert.equal(reset(idle), idle);
});

test('adjustDuration works only while idle and clamps to [0, 99:59]', () => {
  const idle = createTimerState();
  assert.equal(adjustDuration(idle, 60000).durationMs, 360000);
  assert.equal(adjustDuration(idle, -9999999).durationMs, 0);
  assert.equal(adjustDuration(idle, 9999999).durationMs, MAX_MS);
  const running = start(idle, NOW);
  assert.equal(adjustDuration(running, 60000), running);
});

test('a zero-length timer cannot start', () => {
  const zero = adjustDuration(createTimerState(), -300000);
  assert.equal(start(zero, NOW), zero);
});

test('formatMs rounds up to whole seconds', () => {
  assert.equal(formatMs(300000), '05:00');
  assert.equal(formatMs(299001), '05:00');
  assert.equal(formatMs(299000), '04:59');
  assert.equal(formatMs(1), '00:01');
  assert.equal(formatMs(0), '00:00');
  assert.equal(formatMs(-5), '00:00');
  assert.equal(formatMs(MAX_MS), '99:59');
});
