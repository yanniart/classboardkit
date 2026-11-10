# 새 위젯 만들기

[English](new-widget.md) · **한국어**

위젯은 `src/widgets/` 안의 폴더 하나 + `src/widgets/index.js`의 한 줄입니다. 생성기가 바로 동작하는 작은 위젯(숫자 세기)을 만들어 주고, 그것을 고쳐서 원하는 위젯으로 만듭니다.

## 1. 생성

```bash
node tools/new-widget.mjs exit-ticket --title "Exit ticket"
node tools/new-widget.mjs exit-ticket --dry-run   # 바뀔 파일만 보기
```

| 생성 | 역할 |
|---|---|
| `src/widgets/exit-ticket/index.js` | 정의(아래 계약)와 DOM |
| `src/widgets/exit-ticket/exit-ticket-logic.js` | 순수 상태 함수 — DOM 없음, 테스트하기 쉬움 |
| `src/widgets/exit-ticket/exit-ticket.css` | 스타일 (시작할 때 한 번 로드) |
| `tests/exit-ticket.test.js` | 계약 + 로직 테스트 |

또 `src/widgets/index.js`의 `// new-widget:` 표식 바로 위에 import·목록 한 줄씩(독 맨 끝에 표시), `src/locales/`의 모든 파일에 `widget.exit-ticket` 문구 묶음을 넣고 `tools/sw-stamp.mjs`를 실행합니다.

그다음:

```bash
node --test                 # 생성된 테스트가 그대로 통과
node tools/i18n-check.mjs   # 새 문구가 "영어와 같음"으로 표시 → 번역
python -m http.server 8765 --bind 127.0.0.1   # 앱을 열고 독에서 위젯 추가
```

타입은 소문자·숫자·`-`만, 아직 없는 이름이어야 합니다. **타입은 사용자 보드에 저장되므로 출시 후에는 절대 바꾸지 마세요.**

## 2. 계약 (v1)

안정된 부분입니다 ([ADR-0011](../trd/adr/ADR-0011-v1-public-contract.md)). 이 계약대로 만든 위젯은 v1.x 내내 동작합니다.

```js
export default {
  type: 'exit-ticket',          // 고유, 보드에 저장됨
  version: 1,                    // state 형태의 버전
  icon: 'plus',                  // assets/icons.svg의 id
  titleKey: 'widget.exit-ticket.title',
  defaultSize: { w: 0.26, h: 0.3 },   // 캔버스 대비 비율
  minSize: { w: 0.14, h: 0.18 },      // ≤ defaultSize
  styleUrl: new URL('./exit-ticket.css', import.meta.url).href,
  createState() { return { count: 0, step: 1 }; },
  migrate(state, fromVersion) { return state; }, // version > 1이면 필수
  mount(container, ctx) {
    // ctx = { state, setState(next | prev => next), t(key, params), locale }
    return { update(nextState) {}, destroy() {}, openSettings() {} /* 선택 */ };
  },
};
```

- **`setState`는 교체**입니다(병합 아님). 같은 객체를 반환하면 "변경 없음"
- `update(next)`는 상태가 바뀔 때만 호출됩니다. 사용자가 입력 중인 값을 덮어쓰지 않도록 먼저 비교하세요
- 보드나 언어가 바뀌면 위젯을 destroy 후 다시 mount합니다 → `ctx.locale`과 문구는 `mount`에서 한 번 읽으면 됩니다
- `ctx.locale`(`'en'`·`'es'`·`'ja'`·`'ko'`)은 `Intl.DateTimeFormat`·`Intl.NumberFormat`용
- `openSettings`를 반환하면 제목 막대에 ⚙ 버튼이 생깁니다. 패널은 `createSettingsPanel`로

### import해도 되는 모듈

| 모듈 | 용도 |
|---|---|
| `ui/dom.js` | `h(tag, options, children)`, `icon(name)`, `iconButton(...)` |
| `widgets/shared/ui.js` | `button`, `createSettingsPanel`, `field`, `segmented`, `toggle`, `textInput`, `listEditor`, `stepper`, `svg`, `prefersReducedMotion`, `liveRegion` |
| `widgets/shared/list.js` | 명단 파서 `parseItems` |
| `core/utils/random.js` | `randomInt`, `shuffle`, `pickOne` — **`Math.random` 금지** (공정성) |

그 밖은 내부 모듈이라 바뀔 수 있고, 새 위젯이 import하면 `tests/widget-imports.test.js`가 실패합니다. npm 패키지·네트워크 요청 금지.

## 3. 상태 설계

- **JSON만** — 숫자·문자열·불리언·배열·일반 객체. 브라우저, 백업 파일, 공유 링크에 저장됩니다
- **작게.** 공유 링크는 보드 전체 32,000자 제한
- **시간은 카운터가 아니라 시각으로.** `endAt = Date.now() + remaining`을 저장하고 계산 → 새로고침·잠든 탭에서도 정확
- **학생 명단**을 저장하면 `src/core/share.js`의 `NAME_FIELDS`에 타입과 비울 필드를 추가하세요(PR에 명시) — 랜덤 뽑기·모둠 편성처럼 공유 링크가 기본으로 명단을 뺍니다
- **나중에 형태를 바꾸면** `version`을 올리고 `migrate(state, fromVersion)` 작성. 예전 보드는 불러올 때 변환됩니다. 더 새 버전 앱에서 만든 보드는 "지원되지 않는 위젯"으로 데이터를 보존합니다

## 4. 접근성 체크

- 모든 버튼에 이름 — 보이는 글자, 아이콘만 있으면 `label`(→ `aria-label`)
- **사용자 조작의 최종 결과만** `liveRegion(container).say(text)`로 알림 — 매초·연출 중 바뀌는 글자에 `aria-live` 금지
- 색: `--color-*` 토큰, 팀·분류 색은 면·테두리에 `--team-<이름>`, 글자에 `--team-<이름>-text` (대비 테스트됨)
- `prefersReducedMotion()`이면 애니메이션 생략
- 키보드로 모두 조작 가능해야 함 (포인터 전용 그리기만 예외)
- 교실 뒤에서도 읽히게: 컨테이너 단위(`cqmin`)로 크기, 기본 크기에서 본문 18px 이상

## 5. 문구·번역

모든 문구는 **모든** `src/locales/*.js`의 `widget.<type>.*`에. 개수는 `{n}`, 숫자에 따라 말이 바뀌면 영어·스페인어는 복수형:

```js
names: { one: '{n} name', other: '{n} names' },  // en, es
names: '{n}人',                                  // ja, ko — 문자열 하나
```

[번역 가이드](translation.ko.md) 참고.

## 6. 테스트·스크린샷

- 로직은 `<type>-logic.js`, 테스트는 `tests/<type>.test.js` (`node --test`)
- 앱에서 마우스·터치(DevTools 기기 모드)·키보드로, 다크 테마·다른 언어로 확인
- PR에는 기본 크기 스크린샷 첨부

## 7. PR 전에

- [ ] `node --test`, `node tools/i18n-check.mjs` 통과
- [ ] 마지막 변경 뒤 `node tools/sw-stamp.mjs`
- [ ] 새 아이콘? `assets/icons.svg`에 `<symbol id="…">`(24×24, `currentColor`, 선 굵기 2) 추가 후 `icon` 변경
- [ ] `CHANGELOG.md` 한 줄, README 기능 표에 위젯 추가
