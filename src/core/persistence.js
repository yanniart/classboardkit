import { APP_ID, SCHEMA_VERSION, migrate, validateData } from './schema.js';
import { debounce } from './utils/debounce.js';

/** @param {number} version */
export const boardsKey = (version) => `${APP_ID}:v${version}:boards`;
export const SETTINGS_KEY = `${APP_ID}:settings`;
export const CORRUPT_KEY_PREFIX = `${APP_ID}:corrupt:`;

/**
 * @typedef {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} StorageLike
 * @typedef {{ type: 'corrupt' | 'invalid' | 'newer-version' | 'quota' | 'write', detail: string }} PersistenceIssue
 */

/**
 * 가장 최신 버전 키부터 내려가며 저장된 보드를 찾는다.
 * @param {StorageLike} storage
 * @returns {{ version: number, raw: string } | null}
 */
function findStoredBoards(storage) {
  for (let v = SCHEMA_VERSION; v >= 1; v -= 1) {
    const raw = storage.getItem(boardsKey(v));
    if (raw !== null) return { version: v, raw };
  }
  return null;
}

/**
 * 손상된 원본을 지우지 않고 별도 키로 보관한다 (사용자 데이터 보호).
 * @param {StorageLike} storage
 * @param {string} raw
 * @param {Date} now
 */
function backupCorrupt(storage, raw, now) {
  try {
    storage.setItem(`${CORRUPT_KEY_PREFIX}${now.toISOString()}`, raw);
  } catch {
    // 백업조차 실패하면 더 할 수 있는 것이 없다
  }
}

/**
 * 저장소에서 데이터를 읽어 현재 스키마로 변환한다.
 * 문제가 있으면 createDefault() 결과로 대체하고 issues에 사유를 남긴다.
 *
 * @param {{
 *   storage: StorageLike,
 *   createDefault: () => any,
 *   now?: Date,
 * }} options
 * @returns {{ data: any, issues: PersistenceIssue[], isFirstRun: boolean }}
 */
export function loadData({ storage, createDefault, now = new Date() }) {
  /** @type {PersistenceIssue[]} */
  const issues = [];
  const stored = findStoredBoards(storage);
  const rawSettings = storage.getItem(SETTINGS_KEY);

  if (!stored) {
    const data = createDefault();
    // 보드는 없고 설정만 남은 경우(예: 보드 키만 삭제됨) 설정은 살린다
    if (rawSettings !== null) {
      try {
        const settings = JSON.parse(rawSettings);
        const candidate = { ...data, settings: { ...data.settings, ...settings, activeBoardId: data.settings.activeBoardId } };
        if (validateData(candidate).ok) return { data: candidate, issues, isFirstRun: true };
      } catch {
        // 설정 손상은 기본값으로 대체
      }
    }
    return { data, issues, isFirstRun: true };
  }

  let parsed;
  try {
    parsed = {
      schemaVersion: stored.version,
      boards: JSON.parse(stored.raw),
      settings: rawSettings === null ? undefined : JSON.parse(rawSettings),
    };
  } catch (error) {
    backupCorrupt(storage, stored.raw, now);
    issues.push({ type: 'corrupt', detail: String(error) });
    return { data: createDefault(), issues, isFirstRun: false };
  }

  // 설정이 없으면 기본 설정으로 보충
  if (parsed.settings === undefined) parsed.settings = createDefault().settings;

  let data;
  try {
    data = migrate(parsed);
  } catch (error) {
    const type = String(error).includes('newer') ? 'newer-version' : 'invalid';
    if (type === 'invalid') backupCorrupt(storage, stored.raw, now);
    issues.push({ type, detail: String(error) });
    return { data: createDefault(), issues, isFirstRun: false };
  }

  const result = validateData(data);
  if (!result.ok) {
    backupCorrupt(storage, stored.raw, now);
    issues.push({ type: 'invalid', detail: result.errors.join('; ') });
    return { data: createDefault(), issues, isFirstRun: false };
  }

  // 활성 보드가 사라졌으면 첫 보드로 보정
  if (!data.boards.some((b) => b.id === data.settings.activeBoardId)) {
    data.settings.activeBoardId = data.boards[0]?.id ?? null;
  }
  return { data, issues, isFirstRun: false };
}

/**
 * @param {StorageLike} storage
 * @param {{ boards: any[], settings: any }} data
 * @returns {PersistenceIssue | null}
 */
export function saveData(storage, data) {
  try {
    storage.setItem(boardsKey(SCHEMA_VERSION), JSON.stringify(data.boards));
    storage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    return null;
  } catch (error) {
    const isQuota =
      error instanceof Error &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return { type: isQuota ? 'quota' : 'write', detail: String(error) };
  }
}

/**
 * 스토어 변경을 디바운스해 자동 저장한다.
 *
 * @param {{
 *   storage: StorageLike,
 *   store: { getState: () => any, subscribe: (fn: () => void) => () => void },
 *   wait?: number,
 *   onIssue?: (issue: PersistenceIssue) => void,
 * }} options
 * @returns {{ flush: () => void, stop: () => void }}
 */
export function startAutoSave({ storage, store, wait = 500, onIssue = () => {} }) {
  const save = debounce(() => {
    const issue = saveData(storage, store.getState());
    if (issue) onIssue(issue);
  }, wait);
  const unsubscribe = store.subscribe(() => save());
  return {
    flush: () => save.flush(),
    stop: () => {
      save.flush();
      unsubscribe();
    },
  };
}
