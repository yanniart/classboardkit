/**
 * 이벤트 카운트다운 (F-114).
 * target은 시간대 없는 로컬 시각 'YYYY-MM-DDTHH:mm' → 기기 시간대가 바뀌어도 "그 날 그 시각"을 유지한다.
 *
 * @typedef {{ title: string, target: string, showSeconds: boolean }} CountdownState
 */

export const MAX_TITLE_LENGTH = 60;
const TARGET_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY_MS = 86_400_000;

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');

/**
 * Date → 로컬 'YYYY-MM-DD'
 * @param {Date} d
 */
export function toLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 기본값: 내일 09:00
 * @param {Date} [now]
 * @returns {CountdownState}
 */
export function createCountdownState(now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { title: '', target: `${toLocalDate(tomorrow)}T09:00`, showSeconds: false };
}

/**
 * 'YYYY-MM-DDTHH:mm' → 로컬 Date. 형식·날짜가 틀리면 null
 * @param {string} target
 */
export function parseTarget(target) {
  const m = TARGET_RE.exec(String(target));
  if (!m) return null;
  const [y, mo, d, hh, mm] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const date = new Date(y, mo - 1, d, hh, mm);
  // 2월 30일처럼 넘어가는 날짜 거부
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * 날짜·시각 입력값을 합친다 (빈 값이면 기존 값 유지)
 * @param {string} target 기존 값
 * @param {{ date?: string, time?: string }} parts
 */
export function withParts(target, { date, time }) {
  const [oldDate = '', oldTime = '09:00'] = String(target).split('T');
  const next = `${date || oldDate}T${time || oldTime}`;
  return parseTarget(next) ? next : target;
}

/**
 * 남은 시간. 지났으면 past = true이고 나머지 값은 지난 시간
 * @param {string} target
 * @param {Date} now
 */
export function remaining(target, now) {
  const date = parseTarget(target);
  if (!date) return null;
  const diff = date.getTime() - now.getTime();
  const past = diff <= 0;
  const total = Math.floor(Math.abs(diff) / 1000);
  return {
    past,
    totalSeconds: total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * 달력 기준 남은 날 수 (오늘 = 0, 내일 = 1, 어제 = -1). 서머타임 전환일도 하루로 센다.
 * @param {string} target @param {Date} now
 */
export function calendarDays(target, now) {
  const date = parseTarget(target);
  if (!date) return null;
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY_MS);
}

/**
 * 'D-3', 'D-Day', 'D+2'
 * @param {string} target @param {Date} now
 */
export function ddayLabel(target, now) {
  const days = calendarDays(target, now);
  if (days === null) return '';
  if (days === 0) return 'D-Day';
  return days > 0 ? `D-${days}` : `D+${-days}`;
}

/**
 * 표시용 시계 문자열: 'H:MM' 또는 'H:MM:SS' (일은 따로 표시)
 * @param {{ hours: number, minutes: number, seconds: number }} r @param {boolean} showSeconds
 */
export function formatClock(r, showSeconds) {
  const base = `${r.hours}:${pad(r.minutes)}`;
  return showSeconds ? `${base}:${pad(r.seconds)}` : base;
}

/**
 * 다음 화면 갱신까지 기다릴 ms: 초를 보이거나 하루 미만이면 다음 초, 아니면 다음 분 경계
 * @param {{ days: number } | null} r @param {boolean} showSeconds @param {Date} now
 */
export function nextTickDelay(r, showSeconds, now) {
  const ms = now.getMilliseconds();
  if (!r || showSeconds || r.days < 1) return 1000 - ms + 5;
  return 60_000 - now.getSeconds() * 1000 - ms + 5;
}

/** @param {CountdownState} s @param {string} title @returns {CountdownState} */
export function setTitle(s, title) {
  const clean = String(title).slice(0, MAX_TITLE_LENGTH);
  return clean === s.title ? s : { ...s, title: clean };
}
