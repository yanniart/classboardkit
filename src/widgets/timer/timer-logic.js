/**
 * 타이머 상태 전이 (순수 함수, DOM 없음).
 * 정확도: 진행 중에는 종료 시각(endAt)만 저장하고 남은 시간은 매번 계산한다 (TRD 4.1).
 *
 * @typedef {{
 *   durationMs: number,
 *   mode: 'digital' | 'visual',
 *   status: 'idle' | 'running' | 'paused' | 'done',
 *   sound: boolean,
 *   endAt?: number,
 *   remainingMs?: number,
 * }} TimerState
 */

/** 표시 형식 mm:ss 기준 최대 99:59 */
export const MAX_MS = (99 * 60 + 59) * 1000;
export const DEFAULT_MS = 5 * 60 * 1000;
/** 설정 패널 빠른 선택 (분) */
export const PRESET_MINUTES = [1, 2, 3, 5, 10, 15, 20, 30];
/** 남은 시간이 이 이하이면 강조 */
export const URGENT_MS = 10_000;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/** @returns {TimerState} */
export function createTimerState() {
  return { durationMs: DEFAULT_MS, mode: 'digital', status: 'idle', sound: true };
}

/** 진행 관련 필드를 뺀 기본 필드만 */
const base = (/** @type {TimerState} */ s) => ({
  durationMs: s.durationMs,
  mode: s.mode,
  sound: s.sound,
});

/**
 * @param {TimerState} state
 * @param {number} now ms
 */
export function getRemainingMs(state, now) {
  switch (state.status) {
    case 'running':
      return Math.max(0, (state.endAt ?? now) - now);
    case 'paused':
      return Math.max(0, state.remainingMs ?? 0);
    case 'done':
      return 0;
    default:
      return state.durationMs;
  }
}

/**
 * 남은 비율 0~1 (시각 모드 원형 표시용)
 * @param {TimerState} state
 * @param {number} now
 */
export function getProgress(state, now) {
  if (state.durationMs <= 0) return 0;
  return clamp(getRemainingMs(state, now) / state.durationMs, 0, 1);
}

/** @param {TimerState} state @param {number} now */
export function isExpired(state, now) {
  return state.status === 'running' && getRemainingMs(state, now) <= 0;
}

/**
 * 시작 또는 재개. 완료 상태에서는 처음부터 다시 시작한다.
 * @param {TimerState} state
 * @param {number} now
 * @returns {TimerState}
 */
export function start(state, now) {
  if (state.status === 'running') return state;
  const remaining = state.status === 'paused' ? (state.remainingMs ?? 0) : state.durationMs;
  if (remaining <= 0) return state;
  return { ...base(state), status: 'running', endAt: now + remaining };
}

/** @param {TimerState} state @param {number} now @returns {TimerState} */
export function pause(state, now) {
  if (state.status !== 'running') return state;
  return { ...base(state), status: 'paused', remainingMs: getRemainingMs(state, now) };
}

/** @param {TimerState} state @returns {TimerState} */
export function reset(state) {
  if (state.status === 'idle') return state;
  return { ...base(state), status: 'idle' };
}

/** @param {TimerState} state @returns {TimerState} */
export function finish(state) {
  if (state.status === 'done') return state;
  return { ...base(state), status: 'done' };
}

/**
 * 설정 시간 조정 (대기 상태에서만).
 * @param {TimerState} state
 * @param {number} deltaMs
 * @returns {TimerState}
 */
export function adjustDuration(state, deltaMs) {
  if (state.status !== 'idle') return state;
  const durationMs = clamp(state.durationMs + deltaMs, 0, MAX_MS);
  return durationMs === state.durationMs ? state : { ...state, durationMs };
}

/**
 * 설정 시간을 지정하고 대기 상태로 (진행 중이어도 초기화).
 * @param {TimerState} state
 * @param {number} ms
 * @returns {TimerState}
 */
export function setDuration(state, ms) {
  const durationMs = clamp(Math.round(ms / 1000) * 1000, 0, MAX_MS);
  if (state.status === 'idle' && state.durationMs === durationMs) return state;
  return { ...base(state), durationMs, status: 'idle' };
}

/**
 * 남은 시간 표시 문자열. 초 단위 올림 (5분 시작 직후에도 "05:00" 유지).
 * @param {number} ms
 */
export function formatMs(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
