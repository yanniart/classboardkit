# ClassBoardKit 번역하기

[English](translation.md) · **한국어**

ClassBoardKit은 세계 여러 교실에서 쓰이므로 좋은 문구는 코드만큼 중요합니다. 문구는 큰 화면에 보이고 교실 뒤에서 읽힙니다 — **짧고, 쉽고, 친절하게**.

## 번역 고치기

가장 쉬운 방법: 앱의 **설정 → "번역 개선 제안"**(또는 "Translation / 번역" 이슈 양식)에서 지금 문구와 제안 문구를 적어 주세요. 어떤 언어로 써도 됩니다.

PR로 보내려면 `src/locales/<코드>.js`의 값을 고친 뒤 `node tools/i18n-check.mjs`를 실행합니다.

## 파일

| 파일 | 언어 |
|---|---|
| `src/locales/en.js` | English — **기준**, 빠진 키의 대체 언어 |
| `src/locales/es.js` | Español (지역 중립: 중남미·스페인 공통) |
| `src/locales/ja.js` | 日本語 (です・ます) |
| `src/locales/ko.js` | 한국어 |
| `src/locales/index.js` | 언어 목록과 자기 언어 이름 |

키는 `widget.timer.start` 형태입니다. 키와 `{자리표시자}`는 바꾸지 말고 문구만 바꿉니다.

## 검사 규칙

`node tools/i18n-check.mjs`는 언어별 표를 출력하고, 다음이면 실패합니다(종료 코드 1, CI에서도):

| 문제 | 예 |
|---|---|
| 키 누락·여분 | `es`에 `widget.qr.title` 없음 |
| 빈 값 | `title: ' '` |
| 자리표시자 불일치 | en `'{n} of {total} left'` → es `'Quedan {n}'` (`{total}` 빠짐) |
| 복수형 범주 오류 | es에 `other`만, ja에 `one` (일본어에는 단수형이 없음) |

영어와 **같은 값**은 경고만 합니다(번역 누락 의심). `--strict`면 경고도 실패. 실제로 같은 말(스페인어 "widget" 등)은 그대로 둬도 됩니다.

## 자리표시자·복수형

- `{name}`·`{n}`·`{total}` 등은 앱이 채웁니다. 지우지 말고 문장 안 어디로든 옮길 수 있습니다
- 개수는 항상 `{n}`. 숫자에 따라 말이 바뀌면 값을 [CLDR 복수형 범주](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) 객체로:

```js
// en.js / es.js
daysAgo: { one: 'Last backup: {n} day ago', other: 'Last backup: {n} days ago' },
// ja.js / ko.js — 단·복수 구분 없음: 문자열 하나
daysAgo: '마지막 백업: {n}일 전',
```

앱이 언어에 맞는 `Intl.PluralRules`로 형태를 고릅니다. 필수 범주: 영어·스페인어 `one` + `other`, 일본어·한국어는 `other`만(문자열). 스페인어 `many`(1,000,000 등)는 선택.

## 문체

- **짧게**: 독 라벨은 약 9자, 버튼은 태블릿에서 한 줄. `tools/e2e/m7.mjs`가 모든 화면의 글자 넘침을 검사합니다
- **학생이 읽는 문구**(신호등 문구·활동 상징·템플릿 문구)는 짧은 명사나 간단한 지시
- **같은 대상은 같은 말** — 아래 용어집
- 스페인어: `vosotros` 피하기, 부정사·명사형, 필요하면 `usted`. 중남미·스페인 표현이 다르면 더 널리 쓰는 쪽("cuenta regresiva", "agregar")
- 일본어: 안내문은 です・ます, 버튼·제목은 짧은 명사

### 용어집

| 개념 | en | es | ja | ko |
|---|---|---|---|---|
| 보드 | board | pizarra | ボード | 보드 |
| 위젯 | widget | widget | ウィジェット | 위젯 |
| 독 | dock | barra (de widgets) | ドック | 독 |
| 템플릿 | template | plantilla | テンプレート | 템플릿 |
| 랜덤 뽑기 | Random picker | Sorteo de nombres | ランダム指名 | 랜덤 뽑기 |
| 모둠 편성 | Group maker | Hacer grupos | グループ分け | 모둠 편성 |
| 점수판 | Scoreboard | Marcador | 得点板 | 점수판 |
| 신호등 | Traffic light | Semáforo | 信号 | 신호등 |
| 활동 상징 | Activity symbol | Símbolo de actividad | 活動シンボル | 활동 상징 |
| 카운트다운 | Countdown | Cuenta regresiva | カウントダウン | 카운트다운 |
| 실행 취소 | Undo | Deshacer | 元に戻す | 실행 취소 |

## 새 언어 추가

1. `src/locales/en.js`를 `src/locales/<코드>.js`로 복사 ([BCP 47](https://www.rfc-editor.org/info/bcp47) 언어 코드 — `fr`·`pt`·`de` 등, `pt-BR` 같은 지역 코드는 언어가 실제로 다를 때만)
2. 모든 값을 번역. 복수형은 그 언어에 필요한 범주로 — `node tools/i18n-check.mjs` 표에 나옵니다
3. `src/locales/index.js`에 등록: import 추가, `messages`에 **코드 순서**로, `localeNames`에 자기 언어 이름(예: `fr: 'Français'`)
4. `tests/i18n.test.js`의 언어 목록 테스트(`['en', 'es', …]`) 갱신
5. 글꼴: 문자에 맞는 글꼴 순서가 필요하면(일본어처럼 — `src/styles/tokens.css`의 `:root:lang(ja)`) 추가
6. `node --test`, `node tools/i18n-check.mjs`, `node tools/sw-stamp.mjs` 후 그 언어로 앱 확인 — 또는 `M7_LOCALES=<코드> node tools/e2e/m7.mjs`로 넘침·접근성 검사
7. README 언어 목록과 `CHANGELOG.md` 한 줄

오른쪽→왼쪽 언어(아랍어·히브리어)는 앱 전체 배치 작업이 필요해 v1에서는 지원하지 않습니다.
