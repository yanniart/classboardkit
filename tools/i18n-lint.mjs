// 번역 파일 검사 (순수 함수) — tools/i18n-check.mjs(CLI)와 tests/i18n-lint.test.js가 공유 (M7 D3)
import { flattenMessages, isPluralValue } from '../src/core/i18n.js';

/** 영어와 같아도 되는 키 (고유명사·기호 등) */
export const SAME_AS_FALLBACK_OK = new Set(['app.name']);

/** @param {string} text */
function placeholders(text) {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

/** 문자열 또는 복수형 객체의 모든 형태 */
function forms(value) {
  return typeof value === 'string' ? [value] : Object.values(value);
}

/** 자리표시자를 빼고도 글자가 남는지 ('{names} → {groups}'처럼 기호뿐이면 번역할 것이 없음) */
function hasWords(text) {
  return /\p{L}/u.test(text.replace(/\{\w+\}/g, ''));
}

/** 모든 형태의 자리표시자 합집합 (정렬된 배열) */
function placeholderUnion(value) {
  const all = new Set();
  for (const f of forms(value)) for (const p of placeholders(f)) all.add(p);
  return [...all].sort();
}

/** 언어가 가진 복수형 범주 전체 (CLDR) @param {string} locale */
export function pluralCategories(locale) {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

/**
 * 반드시 써야 하는 범주 = 정수 0~1000 중 하나라도 선택되는 범주 (CLDR 순서 유지, other는 맨 뒤).
 * es·fr·pt의 many(1,000,000 등)처럼 큰 수에만 쓰이는 범주는 선택 — 없으면 t()가 other로 대체한다.
 * @param {string} locale
 */
export function requiredPluralCategories(locale) {
  const rules = new Intl.PluralRules(locale);
  const used = new Set();
  for (let n = 0; n <= 1000; n += 1) used.add(rules.select(n));
  const order = ['zero', 'one', 'two', 'few', 'many', 'other'];
  return order.filter((c) => used.has(c));
}

/**
 * @typedef {{ locale: string, key: string, kind: string, detail?: string }} Issue
 * kind: missing | extra | empty | placeholders | plural | same (same = 경고만)
 */

/**
 * @param {Record<string, object>} messages 언어 코드 → 메시지 트리
 * @param {string} fallback 기준 언어
 * @returns {{ errors: Issue[], warnings: Issue[], counts: Record<string, number> }}
 */
export function lintLocales(messages, fallback) {
  const base = flattenMessages(messages[fallback]);
  /** @type {Issue[]} */
  const errors = [];
  /** @type {Issue[]} */
  const warnings = [];
  /** @type {Record<string, number>} */
  const counts = {};

  for (const [locale, tree] of Object.entries(messages)) {
    const table = flattenMessages(tree);
    counts[locale] = table.size;
    const needed = requiredPluralCategories(locale);
    const allowed = pluralCategories(locale);

    for (const key of base.keys()) if (!table.has(key)) errors.push({ locale, key, kind: 'missing' });

    for (const [key, value] of table) {
      const baseValue = base.get(key);
      if (baseValue === undefined) {
        errors.push({ locale, key, kind: 'extra' });
        continue;
      }
      if (forms(value).some((f) => f.trim() === '')) errors.push({ locale, key, kind: 'empty' });

      const want = placeholderUnion(baseValue).join(',');
      const got = placeholderUnion(value).join(',');
      if (want !== got) errors.push({ locale, key, kind: 'placeholders', detail: `{${got}} ≠ {${want}}` });

      if (isPluralValue(value)) {
        const have = Object.keys(value);
        const lacking = needed.filter((c) => !have.includes(c));
        const unknown = have.filter((c) => !allowed.includes(c));
        if (lacking.length || unknown.length) {
          errors.push({
            locale,
            key,
            kind: 'plural',
            detail: [lacking.length && `missing ${lacking}`, unknown.length && `unused ${unknown}`].filter(Boolean).join('; '),
          });
        }
      } else if (isPluralValue(baseValue) && needed.length > 1) {
        // 기준이 복수형인데 단·복수 구분이 있는 언어에서 문자열 하나만 쓴 경우
        errors.push({ locale, key, kind: 'plural', detail: `needs ${needed}` });
      }

      if (
        locale !== fallback &&
        !SAME_AS_FALLBACK_OK.has(key) &&
        forms(value).some(hasWords) &&
        JSON.stringify(value) === JSON.stringify(baseValue)
      ) {
        warnings.push({ locale, key, kind: 'same' });
      }
    }
  }
  return { errors, warnings, counts };
}
