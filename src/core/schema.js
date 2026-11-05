import { createId } from './utils/id.js';

/** 현재 데이터 스키마 버전. 변경 시 docs/trd/data-schema.md 갱신 필수 */
export const SCHEMA_VERSION = 1;

export const APP_ID = 'classboardkit';

export const THEMES = /** @type {const} */ (['system', 'light', 'dark', 'contrast']);
export const BACKGROUND_TYPES = /** @type {const} */ (['color', 'gradient', 'image']);

/**
 * 버전별 마이그레이션. migrations[n]은 버전 n 데이터를 n+1로 변환한다.
 * @type {Record<number, (data: any) => any>}
 */
export const migrations = {};

/**
 * @param {string} name
 * @param {Date} [now]
 */
export function createBoard(name, now = new Date()) {
  const iso = now.toISOString();
  return {
    id: createId('b'),
    name,
    createdAt: iso,
    updatedAt: iso,
    background: { type: 'gradient', value: 'default' },
    widgets: [],
  };
}

/** @param {string} [locale] */
export function createDefaultSettings(locale = 'en') {
  return {
    locale,
    theme: 'system',
    dockCollapsed: false,
    /** @type {string | null} */
    activeBoardId: null,
  };
}

/**
 * 최초 실행 시 데이터: 보드 1개 + 기본 설정.
 * @param {{ boardName: string, locale: string }} options
 */
export function createDefaultData({ boardName, locale }) {
  const board = createBoard(boardName);
  const settings = createDefaultSettings(locale);
  settings.activeBoardId = board.id;
  return { schemaVersion: SCHEMA_VERSION, boards: [board], settings };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isString = (v) => typeof v === 'string';
const isRatio = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * 위젯 1개 검증. state 내부는 각 위젯이 검증하므로 객체 여부만 확인한다.
 * @param {any} widget
 * @param {string} path 오류 메시지용 경로
 * @returns {string[]}
 */
export function validateWidget(widget, path) {
  if (!isObject(widget)) return [`${path}: must be an object`];
  const errors = [];
  if (!isString(widget.id) || !widget.id) errors.push(`${path}.id: must be a non-empty string`);
  if (!isString(widget.type) || !widget.type) errors.push(`${path}.type: must be a non-empty string`);
  if (!Number.isInteger(widget.version) || widget.version < 1) {
    errors.push(`${path}.version: must be a positive integer`);
  }
  for (const key of ['x', 'y', 'w', 'h']) {
    if (!isRatio(widget[key])) errors.push(`${path}.${key}: must be a number between 0 and 1`);
  }
  if (!Number.isInteger(widget.z)) errors.push(`${path}.z: must be an integer`);
  if (!isObject(widget.state)) errors.push(`${path}.state: must be an object`);
  return errors;
}

/**
 * @param {any} board
 * @param {string} path
 * @returns {string[]}
 */
export function validateBoard(board, path) {
  if (!isObject(board)) return [`${path}: must be an object`];
  const errors = [];
  if (!isString(board.id) || !board.id) errors.push(`${path}.id: must be a non-empty string`);
  if (!isString(board.name)) errors.push(`${path}.name: must be a string`);
  for (const key of ['createdAt', 'updatedAt']) {
    if (!isString(board[key]) || Number.isNaN(Date.parse(board[key]))) {
      errors.push(`${path}.${key}: must be an ISO date string`);
    }
  }
  const bg = board.background;
  if (!isObject(bg) || !BACKGROUND_TYPES.includes(bg.type) || !isString(bg.value)) {
    errors.push(`${path}.background: must be { type: ${BACKGROUND_TYPES.join('|')}, value: string }`);
  }
  if (!Array.isArray(board.widgets)) {
    errors.push(`${path}.widgets: must be an array`);
  } else {
    board.widgets.forEach((w, i) => errors.push(...validateWidget(w, `${path}.widgets[${i}]`)));
  }
  return errors;
}

/**
 * @param {any} settings
 * @returns {string[]}
 */
export function validateSettings(settings) {
  if (!isObject(settings)) return ['settings: must be an object'];
  const errors = [];
  if (!isString(settings.locale)) errors.push('settings.locale: must be a string');
  if (!THEMES.includes(settings.theme)) errors.push(`settings.theme: must be one of ${THEMES.join('|')}`);
  if (typeof settings.dockCollapsed !== 'boolean') errors.push('settings.dockCollapsed: must be a boolean');
  if (settings.activeBoardId !== null && !isString(settings.activeBoardId)) {
    errors.push('settings.activeBoardId: must be a string or null');
  }
  // 선택 필드 (M3): 없으면 기본값으로 읽는다
  if (settings.lastExportAt !== undefined && (!isString(settings.lastExportAt) || Number.isNaN(Date.parse(settings.lastExportAt)))) {
    errors.push('settings.lastExportAt: must be an ISO date string');
  }
  if (settings.keepAwake !== undefined && typeof settings.keepAwake !== 'boolean') {
    errors.push('settings.keepAwake: must be a boolean');
  }
  return errors;
}

/**
 * 현재 버전 데이터 전체 검증 (마이그레이션 이후 호출).
 * @param {any} data
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateData(data) {
  if (!isObject(data)) return { ok: false, errors: ['data: must be an object'] };
  const errors = [];
  if (data.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${SCHEMA_VERSION}, got ${data.schemaVersion}`);
  }
  if (!Array.isArray(data.boards)) {
    errors.push('boards: must be an array');
  } else {
    data.boards.forEach((b, i) => errors.push(...validateBoard(b, `boards[${i}]`)));
    const ids = data.boards.map((b) => b?.id);
    if (new Set(ids).size !== ids.length) errors.push('boards: duplicate board ids');
  }
  errors.push(...validateSettings(data.settings));
  return { ok: errors.length === 0, errors };
}

/**
 * 구버전 데이터를 현재 버전으로 순차 변환한다. 원본은 변경하지 않는다.
 * @param {any} data schemaVersion 필드를 가진 데이터
 * @param {Record<number, (data: any) => any>} [table] 테스트용 마이그레이션 테이블 주입
 * @param {number} [targetVersion]
 */
export function migrate(data, table = migrations, targetVersion = SCHEMA_VERSION) {
  if (!isObject(data) || !Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) {
    throw new Error('migrate: data.schemaVersion must be a positive integer');
  }
  if (data.schemaVersion > targetVersion) {
    // 더 최신 앱에서 만든 데이터 — 임의 변환하지 않는다
    throw new Error(
      `migrate: data version ${data.schemaVersion} is newer than supported ${targetVersion}`,
    );
  }
  let current = structuredClone(data);
  while (current.schemaVersion < targetVersion) {
    const step = table[current.schemaVersion];
    if (!step) throw new Error(`migrate: missing migration from v${current.schemaVersion}`);
    current = step(current);
    current.schemaVersion += 1;
  }
  return current;
}
