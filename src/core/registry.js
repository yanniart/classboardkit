/**
 * 위젯 레지스트리 — 코어는 이 모듈을 통해서만 위젯을 안다 (ADR-0003).
 * 아래 WidgetDefinition·WidgetContext·WidgetInstance가 v1 공개 계약이다 (ADR-0011, TRD 2.2).
 *
 * @typedef {{
 *   state: any,
 *   setState: (next: any | ((prev: any) => any)) => void,
 *   t: (key: string, params?: Record<string, string | number>) => string,
 *   locale: string,
 * }} WidgetContext
 * locale: 현재 UI 언어 코드(예: 'en', 'ja') — Intl 날짜·숫자 형식용. 언어가 바뀌면 위젯을 다시 mount하므로 고정값 (v1.0 추가)
 *
 * openSettings가 있으면 캔버스가 제목 막대에 설정 버튼을 표시한다.
 * @typedef {{ update: (state: any) => void, destroy: () => void, openSettings?: () => void }} WidgetInstance
 *
 * @typedef {{
 *   type: string,
 *   version: number,
 *   icon: string,
 *   titleKey: string,
 *   defaultSize: { w: number, h: number },
 *   minSize: { w: number, h: number },
 *   createState: () => any,
 *   migrate?: (state: any, fromVersion: number) => any,
 *   mount: (container: HTMLElement, ctx: WidgetContext) => WidgetInstance,
 *   styleUrl?: string,
 * }} WidgetDefinition
 */

const isSize = (s) =>
  s !== null &&
  typeof s === 'object' &&
  [s.w, s.h].every((n) => typeof n === 'number' && n > 0 && n <= 1);

/**
 * 위젯 정의가 계약을 지키는지 검사한다.
 * @param {any} def
 * @returns {string[]}
 */
export function validateWidgetDefinition(def) {
  if (def === null || typeof def !== 'object') return ['definition must be an object'];
  const errors = [];
  const name = typeof def.type === 'string' ? def.type : '(unknown)';
  if (typeof def.type !== 'string' || !/^[a-z][a-z0-9-]*$/.test(def.type)) {
    errors.push(`${name}: type must be a lowercase identifier`);
  }
  if (!Number.isInteger(def.version) || def.version < 1) errors.push(`${name}: version must be a positive integer`);
  for (const key of ['icon', 'titleKey']) {
    if (typeof def[key] !== 'string' || !def[key]) errors.push(`${name}: ${key} must be a non-empty string`);
  }
  if (!isSize(def.defaultSize)) errors.push(`${name}: defaultSize must be { w, h } in (0, 1]`);
  if (!isSize(def.minSize)) errors.push(`${name}: minSize must be { w, h } in (0, 1]`);
  if (isSize(def.defaultSize) && isSize(def.minSize)) {
    if (def.minSize.w > def.defaultSize.w || def.minSize.h > def.defaultSize.h) {
      errors.push(`${name}: minSize must not exceed defaultSize`);
    }
  }
  for (const key of ['createState', 'mount']) {
    if (typeof def[key] !== 'function') errors.push(`${name}: ${key} must be a function`);
  }
  if (def.migrate !== undefined && typeof def.migrate !== 'function') {
    errors.push(`${name}: migrate must be a function`);
  }
  if (def.version > 1 && typeof def.migrate !== 'function') {
    errors.push(`${name}: migrate is required when version > 1`);
  }
  if (def.styleUrl !== undefined && (typeof def.styleUrl !== 'string' || !/\.css(?:[?#].*)?$/.test(def.styleUrl))) {
    errors.push(`${name}: styleUrl must be a .css URL`);
  }
  return errors;
}

export function createRegistry() {
  /** @type {Map<string, WidgetDefinition>} */
  const defs = new Map();

  return {
    /** @param {WidgetDefinition} def */
    register(def) {
      const errors = validateWidgetDefinition(def);
      if (errors.length) throw new Error(`Invalid widget definition: ${errors.join('; ')}`);
      if (defs.has(def.type)) throw new Error(`Widget type "${def.type}" is already registered`);
      defs.set(def.type, def);
    },
    /** @param {string} type */
    get(type) {
      return defs.get(type);
    },
    /** 등록 순서대로 (독 표시 순서) */
    list() {
      return [...defs.values()];
    },
  };
}

/**
 * 저장된 위젯을 현재 정의 버전에 맞춘다.
 * - ok: 그대로 사용
 * - migrated: 변환됨 (호출자가 저장해야 함)
 * - unsupported: 정의 없음 또는 더 최신 버전 → 데이터 보존, 플레이스홀더 표시
 *
 * @param {WidgetDefinition | undefined} def
 * @param {any} widget
 * @returns {{ status: 'ok' | 'migrated' | 'unsupported', widget: any }}
 */
export function prepareWidget(def, widget) {
  if (!def || widget.version > def.version) return { status: 'unsupported', widget };
  if (widget.version === def.version) return { status: 'ok', widget };
  const state = def.migrate ? def.migrate(structuredClone(widget.state), widget.version) : widget.state;
  return { status: 'migrated', widget: { ...widget, version: def.version, state } };
}
