import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, detectLocale, flattenMessages } from '../src/core/i18n.js';
import { messages, localeNames, FALLBACK_LOCALE } from '../src/locales/index.js';

const sample = {
  en: { greet: 'Hello {name}', only: { en: 'English only' } },
  ko: { greet: '안녕 {name}' },
};

test('flattenMessages builds dotted keys', () => {
  const flat = flattenMessages({ a: { b: 'x', c: { d: 'y' } } });
  assert.deepEqual([...flat], [['a.b', 'x'], ['a.c.d', 'y']]);
});

test('t interpolates params and leaves unknown placeholders', () => {
  const i18n = createI18n({ messages: sample, locale: 'ko', fallback: 'en' });
  assert.equal(i18n.t('greet', { name: '민수' }), '안녕 민수');
  assert.equal(i18n.t('greet'), '안녕 {name}');
  assert.equal(i18n.t('greet', { other: 1 }), '안녕 {name}');
});

test('t falls back to fallback locale, then to the key, reporting missing keys', () => {
  const missing = [];
  const i18n = createI18n({
    messages: sample,
    locale: 'ko',
    fallback: 'en',
    onMissing: (key, locale) => missing.push(`${locale}:${key}`),
  });
  assert.equal(i18n.t('only.en'), 'English only');
  assert.equal(i18n.t('nope'), 'nope');
  assert.deepEqual(missing, ['ko:only.en', 'ko:nope']);
});

test('unsupported initial locale uses fallback; setLocale validates', () => {
  const i18n = createI18n({ messages: sample, locale: 'fr', fallback: 'en' });
  assert.equal(i18n.locale, 'en');
  i18n.setLocale('ko');
  assert.equal(i18n.locale, 'ko');
  assert.throws(() => i18n.setLocale('fr'));
});

test('detectLocale matches exact tags, base languages, and falls back', () => {
  assert.equal(detectLocale(['ko-KR', 'en'], ['en', 'ko'], 'en'), 'ko');
  assert.equal(detectLocale(['fr-FR', 'en-US'], ['en', 'ko'], 'en'), 'en');
  assert.equal(detectLocale(['fr'], ['en', 'ko'], 'en'), 'en');
  assert.equal(detectLocale([], ['en', 'ko'], 'en'), 'en');
});

test('all locale files define exactly the same keys as the fallback', () => {
  const base = [...flattenMessages(messages[FALLBACK_LOCALE]).keys()].sort();
  for (const [code, tree] of Object.entries(messages)) {
    const keys = [...flattenMessages(tree).keys()].sort();
    assert.deepEqual(keys, base, `locale "${code}" keys differ from "${FALLBACK_LOCALE}"`);
  }
});

test('every locale has a display name', () => {
  for (const code of Object.keys(messages)) assert.ok(localeNames[code], code);
});

test('plural objects select by Intl.PluralRules using params.n', () => {
  const plural = {
    en: { days: { one: '{n} day ago', other: '{n} days ago' }, plain: 'Plain {n}' },
    es: { days: { one: 'hace {n} día', other: 'hace {n} días' } },
    ja: { days: '{n}日前' },
  };
  const i18n = createI18n({ messages: plural, locale: 'en', fallback: 'en' });
  assert.equal(i18n.t('days', { n: 1 }), '1 day ago');
  assert.equal(i18n.t('days', { n: 2 }), '2 days ago');
  assert.equal(i18n.t('days', { n: 0 }), '0 days ago');
  assert.equal(i18n.t('plain', { n: 1 }), 'Plain 1');
  i18n.setLocale('es');
  assert.equal(i18n.t('days', { n: 1 }), 'hace 1 día');
  assert.equal(i18n.t('days', { n: 2 }), 'hace 2 días');
  // es의 many(1,000,000) 범주가 없으면 other
  assert.equal(i18n.t('days', { n: 1000000 }), 'hace 1000000 días');
  i18n.setLocale('ja');
  assert.equal(i18n.t('days', { n: 1 }), '1日前');
  assert.equal(i18n.t('days', { n: 2 }), '2日前');
});

test('plural without a numeric n uses other; missing locale falls back with its own rules', () => {
  const plural = {
    en: { w: { one: '{n} widget', other: '{n} widgets' } },
    ko: {},
  };
  const i18n = createI18n({ messages: plural, locale: 'ko', fallback: 'en' });
  assert.equal(i18n.t('w'), '{n} widgets');
  assert.equal(i18n.t('w', { n: '1,234' }), '1,234 widgets');
  assert.equal(i18n.t('w', { n: 1 }), '1 widget');
});

test('flattenMessages keeps plural objects as one entry', () => {
  const flat = flattenMessages({ a: { one: 'x', other: 'y' }, b: { low: 'l', other: 'o' } });
  assert.deepEqual([...flat.keys()], ['a', 'b.low', 'b.other']);
  assert.deepEqual(flat.get('a'), { one: 'x', other: 'y' });
});

test('detectLocale maps regional Spanish and Japanese, unsupported Portuguese falls back', () => {
  const supported = ['en', 'es', 'ja', 'ko'];
  assert.equal(detectLocale(['es-419'], supported, 'en'), 'es');
  assert.equal(detectLocale(['es-ES'], supported, 'en'), 'es');
  assert.equal(detectLocale(['ja-JP'], supported, 'en'), 'ja');
  assert.equal(detectLocale(['pt-BR', 'pt'], supported, 'en'), 'en');
});

test('locale names are listed in code order and every shipped locale has one', () => {
  assert.deepEqual(Object.keys(localeNames), Object.keys(messages));
  assert.deepEqual(Object.keys(messages), ['en', 'es', 'ja', 'ko']);
});
