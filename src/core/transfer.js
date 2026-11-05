/**
 * 보드 내보내기/가져오기 (F-005). 순수 함수 — DOM·파일 API는 UI가 담당한다.
 * 파일 형식: docs/trd/data-schema.md §1
 */
import { APP_ID, SCHEMA_VERSION, migrate, validateBoard } from './schema.js';
import { createId } from './utils/id.js';
import { IMAGE_TYPES, assetIdFor, isAssetId, referencedAssetIds } from './assets.js';

/** 가져오기 파일 최대 크기 (문자 수 기준, 대략 바이트). 이미지 포함(base64)이라 30MB (M4 결정 D2) */
export const MAX_IMPORT_SIZE = 30 * 1024 * 1024;

/** 파일 안 이미지 하나의 최대 크기 (디코딩 후 바이트) */
export const MAX_IMPORT_ASSET_BYTES = 10 * 1024 * 1024;

/** 가져오기 1회 최대 보드 수 (비정상 파일 방어) */
export const MAX_IMPORT_BOARDS = 200;

export const FILE_EXTENSION = '.classboardkit.json';

/**
 * @typedef {'too-large' | 'not-json' | 'wrong-app' | 'newer-version' | 'invalid' | 'empty'} ImportErrorCode
 * @typedef {{ id: string, type: string, width: number, height: number, tone?: 'light' | 'dark', bytes: Uint8Array }} ImportedAsset
 * @typedef {{ type: string, width: number, height: number, tone?: 'light' | 'dark', data: string }} ExportedAsset
 * @typedef {{ ok: true, boards: any[], assets: ImportedAsset[] } | { ok: false, error: ImportErrorCode, detail: string }} ImportResult
 */

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * 내보내기 객체를 만든다. 원본은 복제해 넣는다.
 * @param {any[]} boards
 * @param {{ settings?: any, now?: Date, assets?: Record<string, ExportedAsset> }} [options]
 *   settings는 전체 내보내기에서만 넣는다. assets는 보드가 참조하는 이미지 (비어 있으면 생략)
 */
export function createExport(boards, { settings, now = new Date(), assets } = {}) {
  /** @type {Record<string, unknown>} */
  const data = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    boards: structuredClone(boards),
  };
  if (settings !== undefined) data.settings = structuredClone(settings);
  if (assets && Object.keys(assets).length > 0) data.assets = assets;
  return data;
}

/** @param {ReturnType<typeof createExport>} data */
export const serializeExport = (data) => `${JSON.stringify(data, null, 2)}\n`;

/**
 * 가져온 보드에 새 ID를 발급한다 (기존 보드·위젯과 충돌 방지). 이름·내용은 그대로.
 * @param {any} board
 */
function reassignIds(board) {
  return {
    ...board,
    id: createId('b'),
    widgets: board.widgets.map((/** @type {any} */ w) => ({ ...w, id: createId('w') })),
  };
}

/**
 * 파일 텍스트를 읽어 현재 스키마의 보드 목록으로 변환한다.
 * 알 수 없는 위젯 타입은 그대로 보존한다 (캔버스가 플레이스홀더로 표시).
 *
 * @param {string} text
 * @returns {ImportResult}
 */
export function parseImport(text) {
  if (typeof text !== 'string') return { ok: false, error: 'not-json', detail: 'input is not text' };
  if (text.length > MAX_IMPORT_SIZE) {
    return { ok: false, error: 'too-large', detail: `${text.length} > ${MAX_IMPORT_SIZE}` };
  }

  let raw;
  try {
    // BOM 제거 (일부 편집기가 붙임)
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch (error) {
    return { ok: false, error: 'not-json', detail: String(error) };
  }

  if (!isObject(raw) || raw.app !== APP_ID) {
    return { ok: false, error: 'wrong-app', detail: `app: ${isObject(raw) ? raw.app : typeof raw}` };
  }
  if (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) {
    return { ok: false, error: 'invalid', detail: 'schemaVersion: must be a positive integer' };
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'newer-version',
      detail: `file v${raw.schemaVersion} > supported v${SCHEMA_VERSION}`,
    };
  }
  if (!Array.isArray(raw.boards)) return { ok: false, error: 'invalid', detail: 'boards: must be an array' };
  if (raw.boards.length === 0) return { ok: false, error: 'empty', detail: 'boards: empty' };
  if (raw.boards.length > MAX_IMPORT_BOARDS) {
    return { ok: false, error: 'too-large', detail: `boards: ${raw.boards.length} > ${MAX_IMPORT_BOARDS}` };
  }

  let migrated;
  try {
    // 저장소 로드와 같은 마이그레이션 경로 (data-schema §7). 설정은 가져오지 않는다.
    migrated = migrate({ schemaVersion: raw.schemaVersion, boards: raw.boards, settings: {} });
  } catch (error) {
    return { ok: false, error: 'invalid', detail: String(error) };
  }

  const errors = migrated.boards.flatMap((/** @type {any} */ b, /** @type {number} */ i) =>
    validateBoard(b, `boards[${i}]`),
  );
  if (errors.length > 0) return { ok: false, error: 'invalid', detail: errors.join('; ') };

  const assets = parseAssets(raw.assets, migrated.boards);
  if (typeof assets === 'string') return { ok: false, error: 'invalid', detail: assets };

  return { ok: true, boards: migrated.boards.map(reassignIds), assets };
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * 파일의 assets 필드 검사·디코딩. 가져오는 보드가 참조하는 이미지만 남긴다 (나머지는 무시).
 * 형식이 틀리면 오류 문자열 (부분 가져오기 없음)
 * @param {unknown} raw
 * @param {any[]} boards
 * @returns {ImportedAsset[] | string}
 */
function parseAssets(raw, boards) {
  if (raw === undefined) return [];
  if (!isObject(raw)) return 'assets: must be an object';
  const wanted = referencedAssetIds(boards);
  /** @type {ImportedAsset[]} */
  const out = [];
  for (const [id, a] of Object.entries(/** @type {Record<string, any>} */ (raw))) {
    const at = `assets.${id}`;
    if (!isAssetId(id)) return `${at}: invalid id`;
    if (!isObject(a)) return `${at}: must be an object`;
    if (!IMAGE_TYPES.includes(a.type)) return `${at}.type: unsupported`;
    if (![a.width, a.height].every((n) => Number.isInteger(n) && n > 0 && n <= 16384)) return `${at}: invalid size`;
    if (a.tone !== undefined && a.tone !== 'light' && a.tone !== 'dark') return `${at}.tone: invalid`;
    if (typeof a.data !== 'string' || a.data.length % 4 !== 0 || !BASE64_RE.test(a.data)) return `${at}.data: must be base64`;
    if ((a.data.length * 3) / 4 > MAX_IMPORT_ASSET_BYTES) return `${at}.data: too large`;
    if (!wanted.has(id)) continue;
    const { type, width, height, tone } = a;
    out.push({ id, type, width, height, ...(tone ? { tone } : {}), bytes: base64ToBytes(a.data) });
  }
  return out;
}

/**
 * 이미지 내용이 ID(내용 해시)와 맞는지 확인 (변조·손상 파일 거부)
 * @param {ImportedAsset[]} assets
 * @returns {Promise<string | null>} 오류 설명 또는 null
 */
export async function verifyAssets(assets) {
  for (const a of assets) {
    if ((await assetIdFor(a.bytes)) !== a.id) return `assets.${a.id}: content does not match id`;
  }
  return null;
}

/** @param {Uint8Array} bytes */
export function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

/** @param {string} b64 */
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 파일명에 쓸 수 있게 이름을 정리한다. 한글 등 유니코드 문자는 허용.
 * @param {string} name
 */
export function slugify(name) {
  return String(name)
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '') // Windows·macOS 금지 문자, 제어 문자
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 50)
    .toLowerCase();
}

/**
 * 마지막 백업 이후 지난 날짜 수 (로컬 달력 기준). 없거나 잘못된 값이면 null.
 * @param {string | undefined} iso
 * @param {Date} [now]
 */
export function daysSince(iso, now = new Date()) {
  if (typeof iso !== 'string') return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOf = (/** @type {Date} */ d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((startOf(now) - startOf(then)) / 86_400_000));
}

/**
 * @param {string | null} boardName null이면 전체 내보내기 ("all")
 * @param {Date} [now]
 */
export function exportFileName(boardName, now = new Date()) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  // 사용자 기준 날짜이므로 로컬 시간 사용
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const slug = boardName === null ? 'all' : slugify(boardName) || 'board';
  return `classboardkit-${slug}-${date}${FILE_EXTENSION}`;
}
