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
