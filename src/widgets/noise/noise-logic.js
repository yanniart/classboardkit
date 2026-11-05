/**
 * 소음 측정기 (F-110) 순수 로직. 소리는 기기 안에서 레벨(0~100)로만 바뀌고 저장·전송하지 않는다.
 *
 * @typedef {{ threshold: number, sensitivity: 'low' | 'mid' | 'high', style: 'bar' | 'face' }} NoiseState
 * @typedef {{ overSince: number | null, alarm: boolean }} AlarmState
 */

export const SENSITIVITIES = /** @type {const} */ (['low', 'mid', 'high']);
export const STYLES = /** @type {const} */ (['bar', 'face']);
/** 임계값을 이만큼 넘겨야 경고 (순간 소음 무시) */
export const ALARM_AFTER_MS = 1000;

/** 감도별 0 레벨에 해당하는 dBFS (감도가 높을수록 작은 소리도 올라감) */
const FLOOR_DB = { low: -45, mid: -55, high: -65 };
/** 100 레벨에 해당하는 dBFS */
const CEIL_DB = -10;

/** @returns {NoiseState} */
export function createNoiseState() {
  return { threshold: 60, sensitivity: 'mid', style: 'bar' };
}

/**
 * 시간 영역 샘플(-1~1)의 RMS
 * @param {ArrayLike<number>} samples
 */
export function rms(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/**
 * RMS → 0~100 레벨 (로그 스케일 + 감도)
 * @param {number} value RMS (0~1)
 * @param {NoiseState['sensitivity']} sensitivity
 */
export function levelFromRms(value, sensitivity) {
  if (!(value > 0)) return 0;
  const db = 20 * Math.log10(value);
  const floor = FLOOR_DB[sensitivity] ?? FLOOR_DB.mid;
  const level = ((db - floor) / (CEIL_DB - floor)) * 100;
  return Math.max(0, Math.min(100, level));
}

/**
 * 지수 평활: 커질 때는 빠르게, 작아질 때는 천천히 (막대가 떨리지 않게)
 * @param {number} prev @param {number} next
 */
export function smooth(prev, next) {
  const alpha = next > prev ? 0.35 : 0.08;
  return prev + (next - prev) * alpha;
}

/**
 * 임계값을 ALARM_AFTER_MS 이상 계속 넘을 때만 경고
 * @param {AlarmState} s @param {number} level @param {number} threshold @param {number} now ms
 * @returns {AlarmState}
 */
export function updateAlarm(s, level, threshold, now) {
  if (level <= threshold) return s.overSince === null && !s.alarm ? s : { overSince: null, alarm: false };
  const overSince = s.overSince ?? now;
  const alarm = now - overSince >= ALARM_AFTER_MS;
  return overSince === s.overSince && alarm === s.alarm ? s : { overSince, alarm };
}

/**
 * 얼굴 표정 3단계
 * @param {number} level @param {number} threshold
 * @returns {'calm' | 'ok' | 'loud'}
 */
export function mood(level, threshold) {
  if (level > threshold) return 'loud';
  return level > threshold * 0.6 ? 'ok' : 'calm';
}

/** @param {number} n */
export function clampThreshold(n) {
  return Math.max(5, Math.min(95, Math.round(Number(n) || 0)));
}

/**
 * getUserMedia 오류 → 안내 문구 종류
 * @param {unknown} error
 * @returns {'denied' | 'no-mic' | 'busy' | 'failed'}
 */
export function micErrorKind(error) {
  const name = /** @type {{ name?: string }} */ (error)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-mic';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'failed';
}
