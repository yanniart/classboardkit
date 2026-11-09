/**
 * 색 대비 계산 (WCAG 2.x 상대 휘도·대비율). 토큰 대비 테스트(M6)와 이미지 배경 판단에 쓴다.
 */

/** @param {string} hex '#rrggbb' */
export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`invalid color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** @param {number} c 0~255 */
const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** 상대 휘도 0~1 @param {string} hex */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 대비율 1~21 @param {string} a @param {string} b */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 글자 4.5:1 (일반), 큰 글자·경계·아이콘 3:1 — WCAG 1.4.3 / 1.4.11 */
export const MIN_TEXT = 4.5;
export const MIN_GRAPHIC = 3;
