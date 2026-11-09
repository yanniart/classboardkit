/**
 * 공유 링크 (F-012, ADR-0008). 순수 로직 — 압축은 주입받는다 (브라우저: CompressionStream, Node 테스트: zlib).
 *
 * 형식: <앱 주소>#share=1.<base64url(deflate-raw(JSON))>
 * JSON은 내보내기 형식(createExport) 그대로 → 받는 쪽은 parseImport로 검증·새 ID 발급.
 */
import { createExport } from './transfer.js';

export const SHARE_VERSION = 1;
export const SHARE_PARAM = 'share';
/** 링크 전체 길이 상한 — 넘으면 파일 내보내기로 안내 (M5 결정 D5) */
export const MAX_SHARE_LENGTH = 32_000;
/** 이 길이 이하이면 QR 코드도 표시 */
export const QR_SHARE_LENGTH = 2_000;
/** 압축 해제 결과 상한 (압축 폭탄 방어) */
export const MAX_SHARE_JSON_BYTES = 1024 * 1024;

/** 명단(학생 이름)을 담는 위젯 필드 — "명단 제외"일 때 비운다 (M5 결정 D4) */
const NAME_FIELDS = {
  randomizer: { items: [], picked: [], history: [] },
  groups: { items: [], result: [] },
};

/**
 * @typedef {(bytes: Uint8Array) => Promise<Uint8Array>} Compress
 * @typedef {(bytes: Uint8Array, maxBytes: number) => Promise<Uint8Array>} Decompress
 *   maxBytes를 넘으면 예외를 던져야 한다
 * @typedef {'invalid' | 'newer-version' | 'too-large'} ShareErrorCode
 */

/** @param {any} board */
export const boardHasImages = (board) =>
  board.background?.type === 'image' ||
  board.widgets.some((/** @type {any} */ w) => typeof w.state?.assetId === 'string' && w.state.assetId);

/** @param {any} board */
export const boardHasNames = (board) =>
  board.widgets.some(
    (/** @type {any} */ w) =>
      Object.hasOwn(NAME_FIELDS, w.type) && Array.isArray(w.state?.items) && w.state.items.length > 0,
  );

/**
 * 공유할 내보내기 객체. 이미지는 항상 빼고(ADR-0007 assetId 규칙), 명단 제외 시 이름 필드를 비운다.
 * @param {any} board
 * @param {{ excludeNames?: boolean, now?: Date }} [options]
 */
export function buildSharePayload(board, { excludeNames = true, now = new Date() } = {}) {
  const copy = structuredClone(board);
  if (copy.background?.type === 'image') copy.background = { type: 'gradient', value: 'default' };
  copy.widgets = copy.widgets.map((/** @type {any} */ w) => {
    let state = w.state;
    if (state && typeof state === 'object' && 'assetId' in state) state = { ...state, assetId: null };
    if (excludeNames && Object.hasOwn(NAME_FIELDS, w.type)) {
      state = { ...state, ...structuredClone(NAME_FIELDS[/** @type {keyof typeof NAME_FIELDS} */ (w.type)]) };
    }
    return state === w.state ? w : { ...w, state };
  });
  return createExport([copy], { now });
}

/** @param {Uint8Array} bytes */
export function toBase64Url(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;

/**
 * @param {string} text
 * @returns {Uint8Array | null} 형식이 틀리면 null
 */
export function fromBase64Url(text) {
  if (!BASE64URL_RE.test(text) || text.length % 4 === 1) return null;
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * @param {object} payload buildSharePayload 결과
 * @param {Compress} compress
 * @returns {Promise<string>} '1.xxxx'
 */
export async function encodeShare(payload, compress) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return `${SHARE_VERSION}.${toBase64Url(await compress(bytes))}`;
}

/**
 * 공유 문자열 → JSON 텍스트 (검증은 호출자가 parseImport로)
 * @param {string} encoded '1.xxxx'
 * @param {Decompress} decompress
 * @returns {Promise<{ ok: true, text: string } | { ok: false, error: ShareErrorCode, detail: string }>}
 */
export async function decodeShare(encoded, decompress) {
  if (typeof encoded !== 'string' || encoded.length === 0) return { ok: false, error: 'invalid', detail: 'empty' };
  if (encoded.length > MAX_SHARE_LENGTH) return { ok: false, error: 'too-large', detail: `${encoded.length} chars` };
  const match = /^(\d{1,3})\.(.*)$/s.exec(encoded);
  if (!match) return { ok: false, error: 'invalid', detail: 'missing version prefix' };
  const version = Number(match[1]);
  if (version > SHARE_VERSION) return { ok: false, error: 'newer-version', detail: `v${version}` };
  if (version !== SHARE_VERSION) return { ok: false, error: 'invalid', detail: `v${version}` };
  const bytes = fromBase64Url(match[2]);
  if (!bytes || bytes.length === 0) return { ok: false, error: 'invalid', detail: 'not base64url' };
  let raw;
  try {
    raw = await decompress(bytes, MAX_SHARE_JSON_BYTES);
  } catch (error) {
    // 잘린 링크·변조·상한 초과 모두 여기로
    return { ok: false, error: 'invalid', detail: String(error) };
  }
  if (raw.length > MAX_SHARE_JSON_BYTES) return { ok: false, error: 'too-large', detail: `${raw.length} bytes` };
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(raw) };
  } catch {
    return { ok: false, error: 'invalid', detail: 'not utf-8' };
  }
}

/**
 * @param {string} pageUrl 현재 주소 (조각은 버림)
 * @param {string} encoded
 */
export function buildShareUrl(pageUrl, encoded) {
  return `${pageUrl.split('#')[0]}#${SHARE_PARAM}=${encoded}`;
}

/**
 * location.hash에서 공유 문자열을 꺼낸다. 공유 링크가 아니면 null
 * @param {string} hash '#share=1.xxx'
 */
export function readShareHash(hash) {
  const prefix = `#${SHARE_PARAM}=`;
  return typeof hash === 'string' && hash.startsWith(prefix) ? hash.slice(prefix.length) : null;
}

/** @param {string} url */
export const shareLengthStatus = (url) => ({
  length: url.length,
  tooLong: url.length > MAX_SHARE_LENGTH,
  qr: url.length <= QR_SHARE_LENGTH,
});
