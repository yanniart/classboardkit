/**
 * 스톱워치 (F-102). 진행 중에는 시작 시각만 저장하고 경과 시간은 계산한다.
 * laps에는 각 랩 시점의 누적 경과 시간을 기록한다.
 *
 * @typedef {{
 *   status: 'idle' | 'running' | 'paused',
 *   elapsedMs: number,
 *   startedAt?: number,
 *   laps: number[],
 * }} StopwatchState
 */

export const MAX_LAPS = 99;
/** 99:59:59.99 */
export const MAX_ELAPSED = ((99 * 60 + 59) * 60 + 59) * 1000 + 990;

/** @returns {StopwatchState} */
export function createStopwatchState() {
  return { status: 'idle', elapsedMs: 0, laps: [] };
}

/** @param {StopwatchState} s @param {number} now */
export function getElapsed(s, now) {
  const running = s.status === 'running' ? Math.max(0, now - (s.startedAt ?? now)) : 0;
  return Math.min(s.elapsedMs + running, MAX_ELAPSED);
}

/** @param {StopwatchState} s @param {number} now @returns {StopwatchState} */
export function start(s, now) {
  if (s.status === 'running') return s;
  return { status: 'running', elapsedMs: s.elapsedMs, startedAt: now, laps: s.laps };
}

/** @param {StopwatchState} s @param {number} now @returns {StopwatchState} */
export function pause(s, now) {
  if (s.status !== 'running') return s;
  return { status: 'paused', elapsedMs: getElapsed(s, now), laps: s.laps };
}

/** @param {StopwatchState} s @returns {StopwatchState} */
export function reset(s) {
  if (s.status === 'idle' && s.elapsedMs === 0 && s.laps.length === 0) return s;
  return createStopwatchState();
}

/** @param {StopwatchState} s @param {number} now @returns {StopwatchState} */
export function lap(s, now) {
  if (s.status !== 'running' || s.laps.length >= MAX_LAPS) return s;
  return { ...s, laps: [...s.laps, getElapsed(s, now)] };
}

/** 누적 랩 시각 → 각 랩 구간 길이 @param {number[]} laps */
export function lapDurations(laps) {
  return laps.map((t, i) => t - (i === 0 ? 0 : laps[i - 1]));
}

/**
 * 1시간 미만: "mm:ss" + ".cc", 이상: "h:mm:ss" + ".cc"
 * @param {number} ms
 * @returns {{ main: string, fraction: string }}
 */
export function formatStopwatch(ms) {
  const cs = Math.floor(Math.max(0, ms) / 10);
  const fraction = `.${String(cs % 100).padStart(2, '0')}`;
  const totalSec = Math.floor(cs / 100);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return { main: h > 0 ? `${h}:${mmss}` : mmss, fraction };
}
