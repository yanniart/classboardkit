/**
 * 그리기 (F-111) 순수 로직 — 벡터 획 저장 (M4 결정 D3).
 *
 * Stroke = { c: 색 키, w: 굵기 키, e?: true(지우개), p: [x0, y0, x1, y1, ...] }
 *   p는 그리기 영역 비율 × 10000 정수 (0~10000). 소수보다 JSON이 작다.
 * aspect = 첫 획 때 영역의 가로/세로 비. 위젯 크기가 바뀌어도 이 비율(contain)로 그려 글씨가 늘어나지 않는다.
 *
 * @typedef {{ c: string, w: string, e?: true, p: number[] }} Stroke
 * @typedef {{ strokes: Stroke[], aspect: number | null }} DrawState
 */

export const SCALE = 10000;
/** 위젯당 점 상한 (약 150~250KB JSON) → localStorage 5MB 보호 */
export const MAX_POINTS = 20000;
/** 단순화 허용 오차 (SCALE 단위, 0.2%) */
export const TOLERANCE = 20;

export const COLORS = /** @type {const} */ (['ink', 'red', 'blue', 'green', 'orange', 'purple']);
export const WIDTHS = /** @type {const} */ (['s', 'm', 'l']);
/** 굵기: 그리기 영역 짧은 변 대비 비율 */
export const WIDTH_RATIO = { s: 0.006, m: 0.012, l: 0.024, eraser: 0.05 };

/** @returns {DrawState} */
export function createDrawState() {
  return { strokes: [], aspect: null };
}

/** @param {number} v 0~1 → 0~SCALE 정수 */
export function quantize(v) {
  return Math.round(Math.min(1, Math.max(0, v)) * SCALE);
}

/**
 * 점과 선분 사이 거리의 제곱
 * @param {number} px @param {number} py @param {number} ax @param {number} ay @param {number} bx @param {number} by
 */
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return x * x + y * y;
}

/**
 * Ramer–Douglas–Peucker 단순화 (반복 구현, 깊은 재귀 없음). 첫·끝 점은 항상 유지.
 * @param {number[]} flat [x0, y0, x1, y1, ...]
 * @param {number} [tolerance]
 * @returns {number[]}
 */
export function simplify(flat, tolerance = TOLERANCE) {
  const n = flat.length / 2;
  if (n <= 2) return flat.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tol2 = tolerance * tolerance;
  /** @type {[number, number][]} */
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = /** @type {[number, number]} */ (stack.pop());
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i += 1) {
      const d = segDist2(flat[2 * i], flat[2 * i + 1], flat[2 * a], flat[2 * a + 1], flat[2 * b], flat[2 * b + 1]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tol2) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(flat[2 * i], flat[2 * i + 1]);
  return out;
}

/**
 * 연속으로 같은 점 제거
 * @param {number[]} flat
 */
export function dedupe(flat) {
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    const k = out.length;
    if (k >= 2 && out[k - 2] === flat[i] && out[k - 1] === flat[i + 1]) continue;
    out.push(flat[i], flat[i + 1]);
  }
  return out;
}

/**
 * 0~1 좌표 → 저장용 정수 좌표 (양자화 + 중복 제거 + 단순화)
 * @param {number[]} normalized
 */
export function compressPoints(normalized) {
  return simplify(dedupe(normalized.map(quantize)));
}

/** @param {readonly Stroke[]} strokes */
export function pointCount(strokes) {
  let n = 0;
  for (const s of strokes) n += s.p.length / 2;
  return n;
}

/**
 * 획 추가. 상한을 넘으면 null (호출자가 안내)
 * @param {DrawState} s @param {Stroke} stroke @param {number} aspect 첫 획일 때 저장할 영역 비율
 * @returns {DrawState | null}
 */
export function addStroke(s, stroke, aspect) {
  if (stroke.p.length < 2) return s;
  if (pointCount(s.strokes) + stroke.p.length / 2 > MAX_POINTS) return null;
  return { strokes: [...s.strokes, stroke], aspect: s.aspect ?? aspect };
}

/** @param {DrawState} s @returns {DrawState} */
export function undo(s) {
  if (!s.strokes.length) return s;
  const strokes = s.strokes.slice(0, -1);
  return { strokes, aspect: strokes.length ? s.aspect : null };
}

/** @param {DrawState} s @returns {DrawState} */
export function clear(s) {
  return s.strokes.length || s.aspect !== null ? createDrawState() : s;
}

/**
 * 상자 안에 비율 aspect(가로/세로)인 사각형을 가운데 맞춤 (contain)
 * @param {number} boxW @param {number} boxH @param {number | null} aspect
 */
export function containRect(boxW, boxH, aspect) {
  if (!aspect || !(boxW > 0) || !(boxH > 0)) return { x: 0, y: 0, w: boxW, h: boxH };
  if (boxW / boxH > aspect) {
    const w = boxH * aspect;
    return { x: (boxW - w) / 2, y: 0, w, h: boxH };
  }
  const h = boxW / aspect;
  return { x: 0, y: (boxH - h) / 2, w: boxW, h };
}

/**
 * 획 굵기 (px)
 * @param {Stroke} stroke @param {{ w: number, h: number }} rect
 */
export function strokeWidthPx(stroke, rect) {
  const ratio = stroke.e ? WIDTH_RATIO.eraser : (WIDTH_RATIO[/** @type {'s'|'m'|'l'} */ (stroke.w)] ?? WIDTH_RATIO.m);
  return Math.max(1, ratio * Math.min(rect.w, rect.h));
}
