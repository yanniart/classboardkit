/**
 * QR 코드 (F-109) 순수 로직. QR 인코딩 자체는 벤더링한 Nayuki 라이브러리(ADR-0006)가 한다.
 *
 * @typedef {{ text: string, caption: string, ecc: 'L' | 'M' | 'Q' | 'H' }} QrState
 * @typedef {{ size: number, getModule: (x: number, y: number) => boolean }} QrLike
 */

export const MAX_TEXT_LENGTH = 500;
export const MAX_CAPTION_LENGTH = 60;
/** 둘레 여백 (QR 표준 권장 4모듈) */
export const QUIET_ZONE = 4;
const ECC_KEYS = { L: 'LOW', M: 'MEDIUM', Q: 'QUARTILE', H: 'HIGH' };

/** @returns {QrState} */
export function createQrState() {
  return { text: '', caption: '', ecc: 'M' };
}

/**
 * @param {any} qrcodegen 라이브러리 객체 (window.qrcodegen)
 * @param {string} text
 * @param {QrState['ecc']} ecc
 * @returns {{ ok: true, qr: QrLike } | { ok: false, error: 'empty' | 'too-long' }}
 */
export function encode(qrcodegen, text, ecc = 'M') {
  if (!text.trim()) return { ok: false, error: 'empty' };
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, error: 'too-long' };
  const level = qrcodegen.QrCode.Ecc[ECC_KEYS[ecc] ?? 'MEDIUM'];
  try {
    return { ok: true, qr: qrcodegen.QrCode.encodeText(text, level) };
  } catch {
    // 라이브러리는 용량 초과 시 "Data too long"을 던진다
    return { ok: false, error: 'too-long' };
  }
}

/**
 * 어두운 모듈을 SVG path로 (가로로 이어진 모듈은 한 사각형으로 합침). 좌표는 여백 포함
 * @param {QrLike} qr
 * @param {number} [border]
 */
export function qrPath(qr, border = QUIET_ZONE) {
  const parts = [];
  for (let y = 0; y < qr.size; y += 1) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.getModule(x, y)) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < qr.size && qr.getModule(x, y)) x += 1;
      const run = x - start;
      parts.push(`M${start + border},${y + border}h${run}v1h-${run}z`);
    }
  }
  return parts.join('');
}

/**
 * 아래에 보일 문구: 캡션이 없으면 주소를 짧게 (프로토콜·끝 슬래시 제거)
 * @param {QrState} s
 * @param {number} [max]
 */
export function displayCaption(s, max = 40) {
  const caption = s.caption.trim();
  if (caption) return caption;
  const text = s.text.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
