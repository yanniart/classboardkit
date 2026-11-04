/**
 * @typedef {{ [key: string]: string | Messages }} Messages
 */

/**
 * 중첩 메시지 객체를 "a.b.c" 키의 평면 Map으로 변환한다.
 * @param {Messages} messages
 * @param {string} [prefix]
 * @param {Map<string, string>} [out]
 */
export function flattenMessages(messages, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else flattenMessages(value, path, out);
  }
  return out;
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
  /** @type {Map<string, Map<string, string>>} */
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
     *
     * @param {string} key
     * @param {Record<string, string | number>} [params]
     */
    t(key, params) {
      let text = tables.get(current)?.get(key);
      if (text === undefined) {
        onMissing(key, current);
        text = tables.get(fallback)?.get(key) ?? key;
      }
      if (!params) return text;
      return text.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(params, name) ? String(params[name]) : match,
      );
    },
  };
}
