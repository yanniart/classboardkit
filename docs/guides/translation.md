# Translating ClassBoardKit

**English** · [한국어](translation.ko.md)

ClassBoardKit is used in classrooms around the world, so good wording matters as much as code. Texts are shown on a big screen and read from the back of the room: keep them **short, plain and friendly**.

## Fixing a translation

The easiest way: in the app open **Settings → "Suggest a better translation"** (or the "Translation" issue form) and write the current and the suggested text. Any language is fine.

To send a PR instead, edit the value in `src/locales/<code>.js`, then run `node tools/i18n-check.mjs`.

## Files

| File | Language |
|---|---|
| `src/locales/en.js` | English — the **reference** and the fallback for missing keys |
| `src/locales/es.js` | Español (region-neutral: works for Latin America and Spain) |
| `src/locales/ja.js` | 日本語 (です・ます) |
| `src/locales/ko.js` | 한국어 |
| `src/locales/index.js` | The list of languages and their own names |

Keys look like `widget.timer.start`. Never change keys or `{placeholders}` — only the text.

## Rules the check enforces

`node tools/i18n-check.mjs` prints a table per language and fails (exit code 1, also in CI) when:

| Problem | Example |
|---|---|
| A key is missing or extra | `es` has no `widget.qr.title` |
| An empty value | `title: ' '` |
| Different placeholders | en `'{n} of {total} left'` → es `'Quedan {n}'` (missing `{total}`) |
| Wrong plural forms | es has only `other`; ja has `one` (Japanese has no singular form) |

It also **warns** (without failing) when a value is identical to English — usually an untranslated text. `--strict` turns warnings into failures. Words that really are the same (e.g. "widget" in Spanish) can stay.

## Placeholders and plurals

- `{name}`, `{n}`, `{total}`… are replaced by the app. Keep them, move them anywhere in the sentence.
- A count is always `{n}`. When the word changes with the number, the value is an object of [CLDR plural categories](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html):

```js
// en.js / es.js
daysAgo: { one: 'Last backup: {n} day ago', other: 'Last backup: {n} days ago' },
// ja.js / ko.js — no singular/plural distinction: one string
daysAgo: '前回のバックアップ：{n}日前',
```

The app picks the form with `Intl.PluralRules` for the language. Required forms: English and Spanish `one` + `other`, Japanese and Korean only `other` (a plain string). Spanish `many` (for 1,000,000 etc.) is optional.

## Style

- **Short**: dock labels have about 9 characters of room; buttons should stay one line on a tablet. `tools/e2e/m7.mjs` checks every screen for text that overflows.
- **Students read some texts** (traffic-light messages, activity symbols, template texts): use short nouns or simple instructions.
- **Same word for the same thing** — follow the glossary below.
- Spanish: avoid `vosotros`; prefer infinitives or nouns, `usted` when needed. Prefer the more widely used word when Latin America and Spain differ ("cuenta regresiva", "agregar").
- Japanese: です・ます for messages; short nouns for buttons and titles.

### Glossary

| Concept | en | es | ja | ko |
|---|---|---|---|---|
| board | board | pizarra | ボード | 보드 |
| widget | widget | widget | ウィジェット | 위젯 |
| dock | dock | barra (de widgets) | ドック | 독 |
| template | template | plantilla | テンプレート | 템플릿 |
| random picker | Random picker | Sorteo de nombres | ランダム指名 | 랜덤 뽑기 |
| group maker | Group maker | Hacer grupos | グループ分け | 모둠 편성 |
| scoreboard | Scoreboard | Marcador | 得点板 | 점수판 |
| traffic light | Traffic light | Semáforo | 信号 | 신호등 |
| activity symbol | Activity symbol | Símbolo de actividad | 活動シンボル | 활동 상징 |
| countdown | Countdown | Cuenta regresiva | カウントダウン | 카운트다운 |
| undo | Undo | Deshacer | 元に戻す | 실행 취소 |

## Adding a language

1. Copy `src/locales/en.js` to `src/locales/<code>.js` (a [BCP 47](https://www.rfc-editor.org/info/bcp47) language code such as `fr`, `pt`, `de`; regional codes like `pt-BR` only if the language really differs).
2. Translate every value. Use plural objects with the categories your language needs — `node tools/i18n-check.mjs` prints them in the table.
3. Register it in `src/locales/index.js`: add the import, add it to `messages` **in code order**, and add its own name to `localeNames` (e.g. `fr: 'Français'`).
4. Update the test that lists the shipped languages in `tests/i18n.test.js` (`['en', 'es', …]`).
5. Fonts: if the script needs a specific font order (as Japanese does — see `:root:lang(ja)` in `src/styles/tokens.css`), add one.
6. Run `node --test`, `node tools/i18n-check.mjs`, `node tools/sw-stamp.mjs`, then check the app in that language — or run `M7_LOCALES=<code> node tools/e2e/m7.mjs` for the overflow and accessibility checks.
7. Add the language to the README lists and a line in `CHANGELOG.md`.

Right-to-left languages (Arabic, Hebrew) need layout work across the app and are not supported in v1.
