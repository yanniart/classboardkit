// 번역 검사 CLI: node tools/i18n-check.mjs [--strict]
// 키 누락·여분·빈 값·자리표시자·복수형 범주 문제가 있으면 종료 코드 1.
// 영어와 같은 값(번역 누락 의심)은 경고로만 보여 주고, --strict면 그것도 실패로 친다.
import { messages, FALLBACK_LOCALE } from '../src/locales/index.js';
import { lintLocales, requiredPluralCategories as pluralCategories } from './i18n-lint.mjs';

const strict = process.argv.includes('--strict');
const { errors, warnings, counts } = lintLocales(messages, FALLBACK_LOCALE);

console.log('locale  keys  plural categories      errors  same-as-' + FALLBACK_LOCALE);
for (const locale of Object.keys(messages)) {
  const e = errors.filter((i) => i.locale === locale).length;
  const w = warnings.filter((i) => i.locale === locale).length;
  console.log(
    `${locale.padEnd(7)} ${String(counts[locale]).padStart(4)}  ${pluralCategories(locale).join(',').padEnd(22)} ${String(e).padStart(6)}  ${String(w).padStart(5)}`,
  );
}

const show = (list, label) => {
  if (!list.length) return;
  console.log(`\n${label}:`);
  for (const i of list) console.log(`  [${i.locale}] ${i.kind.padEnd(12)} ${i.key}${i.detail ? `  ${i.detail}` : ''}`);
};
show(errors, 'Errors');
show(warnings, 'Same as fallback (check if untranslated)');

const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(failed ? '\ni18n-check: FAILED' : '\ni18n-check: OK');
process.exit(failed ? 1 : 0);
