/**
 * @typedef {{ zero?: string, one?: string, two?: string, few?: string, many?: string, other: string }} PluralValue
 * @typedef {string | PluralValue} MessageValue
 * @typedef {{ [key: string]: string | PluralValue | Messages }} Messages
 */

/** CLDR 복수형 범주 이름 */
const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

/**
 * 복수형 객체인지: `other`가 있고 모든 키가 CLDR 범주이며 값이 모두 문자열 (M7 D2).
 * @param {unknown} value
 * @returns {value is PluralValue}
 */
export function isPluralValue(value) {
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value);
  return (
    Object.hasOwn(value, 'other') &&
    entries.every(([k, v]) => PLURAL_CATEGORIES.has(k) && typeof v === 'string')
  );
}

/**
 * 중첩 메시지 객체를 "a.b.c" 키의 평면 Map으로 변환한다. 복수형 객체는 한 항목.
 * @param {Messages} messages
 * @param {string} [prefix]
 * @param {Map<string, MessageValue>} [out]
 */
export function flattenMessages(messages, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralValue(value)) out.set(path, value);
    else flattenMessages(value, path, out);
  }
  return out;
}

/** @type {Map<string, Intl.PluralRules>} */
const pluralRulesCache = new Map();

/**
 * 복수형 값에서 문자열 하나를 고른다. n이 숫자가 아니거나 범주가 없으면 other.
 * @param {MessageValue} value
 * @param {string} locale 값이 속한 언어 (폴백이면 폴백 언어의 규칙)
 * @param {unknown} n
 */
function selectForm(value, locale, n) {
  if (typeof value === 'string') return value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return value.other;
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return value[rules.select(n)] ?? value.other;
}

/**
 * 브라우저 선호 언어 목록에서 지원 언어를 고른다.
 * "ko-KR" → "ko" 처럼 기본 언어 코드로도 매칭한다.
 *
 * @param {readonly string[]} preferred navigator.languages
 * @param {readonly string[]} supported
 * @param {string} fallback
 */
export function detectLocale(preferred, supported, fallback) {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = supported.find((s) => s.toLowerCase() === lower);
    if (exact) return exact;
    const base = lower.split('-')[0];
    const partial = supported.find((s) => s.toLowerCase() === base);
    if (partial) return partial;
  }
  return fallback;
}

/**
 * @param {{
 *   messages: Record<string, Messages>,
 *   locale: string,
 *   fallback: string,
 *   onMissing?: (key: string, locale: string) => void,
 * }} options
 */
export function createI18n({ messages, locale, fallback, onMissing = () => {} }) {
  /** @type {Map<string, Map<string, MessageValue>>} */
  const tables = new Map(
    Object.entries(messages).map(([code, tree]) => [code, flattenMessages(tree)]),
  );
  if (!tables.has(fallback)) throw new Error(`i18n: fallback locale "${fallback}" has no messages`);

  let current = tables.has(locale) ? locale : fallback;

  return {
    get locale() {
      return current;
    },

    get supported() {
      return [...tables.keys()];
    },

    /** @param {string} next */
    setLocale(next) {
      if (!tables.has(next)) throw new Error(`i18n: unsupported locale "${next}"`);
      current = next;
    },

    /**
     * 메시지 조회. "{name}" 형태의 자리표시자를 params로 치환한다.
     * 현재 언어에 없으면 fallback, 그마저 없으면 키를 그대로 반환한다.
     * 값이 복수형 객체면 params.n(숫자)으로 범주를 고른다.
     *
     * @param {string} key
     * @param {Record<string, string | number>} [params]
     */
    t(key, params) {
      let value = tables.get(current)?.get(key);
      let valueLocale = current;
      if (value === undefined) {
        onMissing(key, current);
        value = tables.get(fallback)?.get(key);
        valueLocale = fallback;
      }
      if (value === undefined) return key;
      const text = selectForm(value, valueLocale, params?.n);
      if (!params) return text;
      return text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : match,
      );
    },
  };
}
