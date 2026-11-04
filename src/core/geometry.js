/**
 * 위젯 사각형 계산. 모든 값은 캔버스 대비 비율(0~1) — ADR-0004.
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ w: number, h: number }} Size
 */

/** 저장 크기를 줄이기 위해 소수점 4자리로 반올림 */
export const round4 = (n) => Math.round(n * 10000) / 10000;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/**
 * 크기를 [min, 1]로, 위치를 캔버스 안으로 보정한다.
 * @param {Rect} rect
 * @param {Size} [min]
 * @returns {Rect}
 */
export function clampRect(rect, min = { w: 0, h: 0 }) {
  const w = clamp(rect.w, Math.min(min.w, 1), 1);
  const h = clamp(rect.h, Math.min(min.h, 1), 1);
  return {
    x: round4(clamp(rect.x, 0, 1 - w)),
    y: round4(clamp(rect.y, 0, 1 - h)),
    w: round4(w),
    h: round4(h),
  };
}

/**
 * 크기를 유지한 채 이동한다. 캔버스 밖으로 나가지 않는다.
 * @param {Rect} start
 * @param {number} dx
 * @param {number} dy
 */
export function moveRect(start, dx, dy) {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy });
}

/**
 * 왼쪽 위 모서리를 고정하고 오른쪽 아래로 크기를 조절한다.
 * @param {Rect} start
 * @param {number} dw
 * @param {number} dh
 * @param {Size} min
 */
export function resizeRect(start, dw, dh, min) {
  const w = clamp(start.w + dw, min.w, 1 - start.x);
  const h = clamp(start.h + dh, min.h, 1 - start.y);
  return { x: round4(start.x), y: round4(start.y), w: round4(w), h: round4(h) };
}

/**
 * 새 위젯 배치 위치: 중앙 근처에서 기존 위젯 수만큼 계단식으로 비켜 놓는다.
 * @param {Size} size
 * @param {number} existingCount
 * @returns {Rect}
 */
export function placeNewRect(size, existingCount) {
  const step = (existingCount % 6) * 0.03;
  return clampRect({
    x: (1 - size.w) / 2 - 0.075 + step,
    y: (1 - size.h) / 2 - 0.075 + step,
    w: size.w,
    h: size.h,
  });
}
