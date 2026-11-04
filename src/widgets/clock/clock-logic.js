/**
 * 시계 (F-103) 표시 계산.
 * @typedef {{ style: 'digital' | 'analog', hour12: boolean, showSeconds: boolean, showDate: boolean }} ClockState
 */

/** @returns {ClockState} */
export function createClockState() {
  return { style: 'digital', hour12: false, showSeconds: true, showDate: true };
}

/**
 * 아날로그 바늘 각도(도, 12시 방향 0, 시계 방향). 분·시침은 연속적으로 움직인다.
 * @param {Date} date
 */
export function handAngles(date) {
  const s = date.getSeconds();
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;
  return { hour: h * 30, minute: m * 6, second: s * 6 };
}

/**
 * 현지화된 시각. 오전/오후 표시는 따로 반환해 작게 그릴 수 있게 한다.
 * @param {Date} date
 * @param {{ locale: string, hour12: boolean, showSeconds: boolean }} options
 * @returns {{ time: string, period: string }}
 */
export function formatClock(date, { locale, hour12, showSeconds }) {
  const parts = new Intl.DateTimeFormat(locale, {
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
    hourCycle: hour12 ? 'h12' : 'h23',
  }).formatToParts(date);
  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const time = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();
  return { time, period };
}

/**
 * @param {Date} date
 * @param {string} locale
 */
export function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

/** 다음 정각 초까지 남은 ms (초 단위 갱신 타이머 정렬용) @param {number} now */
export function msUntilNextSecond(now) {
  return 1000 - (now % 1000);
}
