# ADR-0011: v1 공개 계약과 버전 정책

- 상태: Accepted
- 날짜: 2026-11-11

## 배경
- v1.0.0은 "백업 파일·공유 링크·위젯 코드가 다음 버전에서도 동작한다"는 약속이다 (M7 결정 D6).
- 이미 사용자 데이터가 있다: 브라우저 저장소의 보드, 내보낸 백업 파일, 메신저로 보낸 공유 링크. 이것을 깨면 교사의 수업 자료가 사라진다.
- 기여자가 새 위젯을 만들 때 어디까지 기대도 되는지(쓸 수 있는 모듈, 넘겨받는 값)가 문서로 정해져 있지 않았다. 내장 위젯 일부는 내부 모듈(`ui/dialog.js`·`ui/idb-assets.js` 등)을 직접 쓴다.
- 시계 위젯은 언어를 `document.documentElement.lang`에서 직접 읽었다 (계약 밖 경로).

## 선택지
1. 약속 없이 1.0 — 버전 숫자만 올림
2. 1.0에서 계약을 정리하며 깨는 변경도 함께 (예: 위젯 state 형식 개편, 저장 키 변경)
3. **현재 동작을 v1 공개 계약으로 고정하고, 감사에서 찾은 문제는 추가형 변경으로만 보완**

## 결정
3을 채택한다. 다음 네 가지가 **v1 공개 계약**이고, [SemVer](https://semver.org/lang/ko/)를 이것에 대해 적용한다.

| # | 계약 | 정의 위치 | v1 동안 약속 |
|---|---|---|---|
| ① | 내보내기 파일 형식 `schemaVersion: 1` | data-schema §1~§5 | v1.x 앱은 v1.0 이후 만든 모든 백업 파일을 가져온다. 선택 필드만 추가 |
| ② | 공유 링크 형식 `#share=1.<base64url(deflate-raw(JSON))>` | data-schema §1.1, ADR-0008 | `1.` 링크는 v1.x에서 계속 열린다 |
| ③ | 위젯 정의 계약 `WidgetDefinition`·`WidgetContext`·`WidgetInstance` + **공개 모듈** | TRD 2.2, `core/registry.js` | v1.0 계약을 지킨 위젯은 v1.x에서 고치지 않아도 동작 |
| ④ | 저장 키 `classboardkit:v1:boards`·`classboardkit:settings`, IndexedDB `classboardkit`/`assets` | data-schema §6 | 업데이트 후에도 보드·이미지가 그대로 |

- **공개 모듈** (위젯이 import해도 되는 것): `ui/dom.js`(`h`·`icon`·`iconButton`), `widgets/shared/ui.js`(설정 패널·입력 요소·`liveRegion` 등), `widgets/shared/list.js`(명단 파서), `core/utils/random.js`(공정한 난수), `core/registry.js`(JSDoc 타입만). 대비 토큰 `--team-*`/`--team-*-text`·`--color-*` CSS 변수도 공개
- **내부 모듈**: 그 밖의 모든 것. 내장 위젯 3개의 예외(`timer` → `core/utils/sound.js`, `draw` → `ui/dialog.js`, `image` → `ui/idb-assets.js`·`core/assets.js`)는 `tests/widget-imports.test.js`가 목록으로 관리하며, 새 위젯에는 허용하지 않는다
- **버전 규칙**
  - **major**: 위 계약 중 하나라도 깨짐 (필수 필드 추가·제거·의미 변경, 공개 모듈 함수 제거·시그니처 변경, 저장 키 변경, `schemaVersion` 2로 올리면서 v1 앱이 새 파일을 못 읽게 되는 경우)
  - **minor**: 새 기능, 선택 필드·선택 계약 항목 추가(예: v1.0의 `ctx.locale`), 공개 모듈에 함수 추가, 새 언어·위젯
  - **patch**: 버그 수정, 번역 수정, 문서
- **폐기 절차**: 공개 항목을 없애려면 ① 문서와 JSDoc에 `@deprecated` + 대체 방법, ② 최소 1개 minor 버전 동안 그대로 동작(개발 중 `console.info` 안내 — `console.warn`은 E2E가 오류로 셈), ③ 다음 major에서 제거, CHANGELOG `Removed`
- **저장 데이터 하위 호환**: 위젯 state는 위젯의 `version`·`migrate`로만 바꾼다. 더 새 버전 앱에서 만든 위젯·보드는 지금처럼 "지원되지 않는 위젯"으로 **보존**하고 지우지 않는다
- **v1.0 감사에서 반영한 추가형 변경** (M7 3-5)
  - `WidgetContext.locale` 추가 — 시계가 `document.documentElement.lang` 대신 사용
  - `validateWidgetDefinition`: `styleUrl`이 있으면 `.css` URL이어야 함 (내장 위젯은 모두 충족 → 기존 정의를 거부하지 않음)
  - 테스트: 위젯 제목이 모든 언어에 있는지, `styleUrl`이 자기 폴더인지, 위젯 import가 공개 모듈·자기 폴더·예외 목록뿐인지

## 결과
- 장점: 교사의 백업·공유 링크가 v1.x 내내 동작한다는 약속을 테스트로 지킨다. 기여자는 공개 모듈만 알면 위젯을 만들 수 있다
- 단점: 계약 정리(예: 내장 위젯의 내부 모듈 의존, `setState` 교체형 의미)를 v1 동안 바꾸기 어렵다. 공개 모듈의 함수 시그니처를 함부로 바꿀 수 없다
- 보완: 내부 모듈 예외는 목록으로 가시화해 늘지 않게 막고, 필요하면 minor에서 공개 모듈로 승격(예: 소리 재생)한다. 외부 위젯 동적 로딩은 여전히 범위 밖(M7 D8) — 기여는 저장소 PR로
