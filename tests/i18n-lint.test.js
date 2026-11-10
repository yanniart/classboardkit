import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintLocales, requiredPluralCategories } from '../tools/i18n-lint.mjs';
import { flattenMessages } from '../src/core/i18n.js';
import { messages, FALLBACK_LOCALE } from '../src/locales/index.js';

test('shipped locales have no i18n-check errors', () => {
  const { errors } = lintLocales(messages, FALLBACK_LOCALE);
  assert.deepEqual(errors, []);
});

test('English has no "(s)" pseudo-plurals left (use plural objects)', () => {
  for (const [key, value] of flattenMessages(messages.en)) {
    const forms = typeof value === 'string' ? [value] : Object.values(value);
    for (const f of forms) assert.ok(!f.includes('(s)'), key);
  }
});

test('required plural categories: only those used by integers', () => {
  assert.deepEqual(requiredPluralCategories('en'), ['one', 'other']);
  // es의 many(1,000,000 등)는 정수 0~1000에서 쓰이지 않으므로 선택 (없으면 other)
  assert.deepEqual(requiredPluralCategories('es'), ['one', 'other']);
  assert.deepEqual(requiredPluralCategories('ja'), ['other']);
  assert.deepEqual(requiredPluralCategories('ko'), ['other']);
});

test('lint reports missing, extra, empty, placeholder and plural problems', () => {
  const sample = {
    en: { a: 'Hi {name}', b: { one: '{n} item', other: '{n} items' }, c: 'C', d: 'D' },
    es: { a: 'Hola {nombre}', b: { other: '{n} cosas' }, c: ' ', x: 'extra' },
    ja: { a: 'こんにちは {name}', b: '{n}個', c: 'シー', d: 'D' },
  };
  const { errors, warnings } = lintLocales(sample, 'en');
  const kinds = errors.map((e) => `${e.locale}:${e.kind}:${e.key}`).sort();
  assert.deepEqual(kinds, [
    'es:empty:c',
    'es:extra:x',
    'es:missing:d',
    'es:placeholders:a',
    'es:plural:b',
  ]);
  // ja는 복수형 범주가 other 하나라 문자열로 써도 됨, 영어와 같은 값은 경고
  assert.deepEqual(warnings.map((w) => `${w.locale}:${w.key}`), ['ja:d']);
});

test('lint rejects plural categories a language does not use', () => {
  const sample = { en: { b: { one: 'x {n}', other: 'y {n}' } }, ja: { b: { one: 'a {n}', other: 'b {n}' } } };
  const { errors } = lintLocales(sample, 'en');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].kind, 'plural');
});
