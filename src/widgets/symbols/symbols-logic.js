/**
 * 활동 상징 (F-115) 순수 로직. 그림은 assets/symbols.svg의 `sym-<키>`.
 *
 * label이 비어 있으면 현재 언어의 기본 문구(widget.symbols.name.<키>)를 표시한다.
 * @typedef {{ symbol: SymbolKey, label: string }} SymbolsState
 * @typedef {typeof SYMBOLS[number]} SymbolKey
 */

/** 고르기 격자 순서 (수업 흐름: 주의 → 활동 방식 → 할 일 → 마무리) */
export const SYMBOLS = /** @type {const} */ ([
  'quiet',
  'raise-hand',
  'listen',
  'solo',
  'pair',
  'group',
  'write',
  'read',
  'present',
  'think',
  'tidy',
  'break',
]);

export const MAX_LABEL_LENGTH = 40;
/** 고르기 격자 열 수 (키보드 위·아래 이동 계산) */
export const GRID_COLUMNS = 4;

/** @returns {SymbolsState} */
export function createSymbolsState() {
  return { symbol: 'quiet', label: '' };
}

/**
 * 다른 상징을 고르면 직접 쓴 문구는 지운다 (예전 상징의 문구가 남아 헷갈리지 않게)
 * @param {SymbolsState} s @param {string} symbol @returns {SymbolsState}
 */
export function setSymbol(s, symbol) {
  if (!SYMBOLS.includes(/** @type {any} */ (symbol)) || s.symbol === symbol) return s;
  return { symbol: /** @type {SymbolKey} */ (symbol), label: '' };
}

/** @param {SymbolsState} s @param {string} label @returns {SymbolsState} */
export function setLabel(s, label) {
  const clean = String(label).slice(0, MAX_LABEL_LENGTH);
  return s.label === clean ? s : { ...s, label: clean };
}

/**
 * 알 수 없는 상징(더 새 버전 데이터 등)은 기본값으로 표시만 바꾼다 (저장 데이터는 그대로)
 * @param {SymbolsState} s
 * @returns {SymbolKey}
 */
export const displaySymbol = (s) => (SYMBOLS.includes(/** @type {any} */ (s?.symbol)) ? s.symbol : 'quiet');

/**
 * 고르기 격자 키보드 이동 (화살표·Home·End). 범위를 넘으면 그 자리
 * @param {number} index
 * @param {string} key
 * @param {number} [count]
 * @param {number} [cols]
 */
export function moveIndex(index, key, count = SYMBOLS.length, cols = GRID_COLUMNS) {
  const next = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    ArrowUp: index - cols,
    ArrowDown: index + cols,
    Home: 0,
    End: count - 1,
  }[key];
  if (next === undefined) return index;
  return next < 0 || next >= count ? index : next;
}
