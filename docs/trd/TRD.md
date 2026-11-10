# TRD: ClassBoardKit

| status | version | updated | owner |
|---|---|---|---|
| draft | 0.5 | 2026-11-09 | @owner |

관련 문서: [PRD](../prd/PRD.md) · [데이터 스키마](data-schema.md) · [ADR 목록](adr/)

## 1. 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 마크업/스타일 | HTML5, CSS (Custom Properties, Container Queries) | 표준만 사용 |
| 스크립트 | Vanilla JavaScript ES2020+, ES Modules | [ADR-0001](adr/ADR-0001-no-build-vanilla-js.md) |
| 빌드 | 없음 | 1인 유지보수, 소스 = 배포물 |
| 저장 | localStorage (보드), IndexedDB (이미지, M4) | [ADR-0002](adr/ADR-0002-local-only-storage.md), [ADR-0007](adr/ADR-0007-indexeddb-image-assets.md) |
| 호스팅 | GitHub Pages | 무료, HTTPS 기본 제공 (마이크·Wake Lock 등 보안 컨텍스트 필요) |
| CI/CD | GitHub Actions | 테스트 후 Pages 배포 |
| 테스트 | Node.js 내장 `node:test` (개발 환경에서만) | npm 의존성 없이 순수 로직 테스트 |
| 오프라인 | Service Worker + Web App Manifest (직접 작성) | 라이브러리 불필요 |

## 2. 아키텍처

```
index.html, manifest.webmanifest, sw.js(서비스 워커, 루트 = 범위 전체)
  └─ src/main.js ─ 진입점: 첫 화면 문구·테마만 먼저 그리고 app.js를 동적 import (M4, LCP)
     src/app.js  ─ 앱 부트스트랩 (저장소·스토어·UI 마운트, 이미지 정리, SW 등록)
       ├─ core/
       │   ├─ store.js        단일 상태 저장소 (get / update / subscribe)
       │   ├─ persistence.js  localStorage 저장·복원, 디바운스, 할당량 오류 처리
       │   ├─ schema.js       검증, 마이그레이션 (schemaVersion)
       │   ├─ registry.js     위젯 등록·조회, 정의 검증, 위젯 버전 마이그레이션(prepareWidget)
       │   ├─ board-ops.js    보드·위젯 상태 변경 순수 함수 (추가/삭제/이동/z-order/복제…)
       │   ├─ geometry.js     비율 좌표 이동·크기 조절·배치 계산
       │   ├─ backgrounds.js  배경 프리셋, 밝기(tone) 판정
       │   ├─ transfer.js     내보내기 파일 생성(이미지 base64 포함), 가져오기 파싱·검증·새 ID 발급·이미지 해시 확인, 파일명
       │   ├─ assets.js       이미지 저장소 규칙: 내용 해시 ID, 참조 수집, GC, 축소 크기 (백엔드 주입)
       │   ├─ history.js      실행 취소 기록: record/undo/redo, 상한 50, 합치기(mergeKey), 없어진 대상 건너뜀 (M5, ADR-0009)
       │   ├─ undoable.js     실행 취소할 수 있는 작업 = board-ops 적용 + 역연산 항목 (M5)
       │   ├─ templates.js    템플릿 → 새 보드 (레지스트리로 위젯 기본 state, M5)
       │   ├─ contrast.js     WCAG 상대 휘도·대비율 (토큰 대비 테스트, M6)
       │   ├─ share.js        공유 링크: 페이로드(이미지·명단 제외), 인코딩/디코딩(압축 주입), 길이 판정 (M5, ADR-0008)
       │   ├─ i18n.js         메시지 조회, 언어 감지
       │   └─ utils/          id, debounce, memory-storage, sound(Web Audio)
       ├─ ui/
       │   ├─ shell.js        언어·테마 설정, 알림(error/info, 매개변수, 액션 버튼, 자동 닫힘 시간)
       │   ├─ actions.js      "적용 + 기록" 단일 헬퍼 perform(op), 실행 취소/다시 실행, 삭제 알림의 실행 취소 버튼 (M5)
       │   ├─ undo-controls.js 툴바 실행 취소·다시 실행 버튼, 단축키 (M5)
       │   ├─ announce.js     낭독기 전용 알림 영역(#announcer, 300ms 디바운스) (M6)
       │   ├─ shortcuts.js    단축키 도움말(? 키·설정 버튼), "위젯 독으로 건너뛰기" (M6)
       │   ├─ template-dialog.js 템플릿 고르기 대화상자 (메뉴를 열 때 동적 import, M5)
       │   ├─ share-dialog.js 공유 링크 대화상자: 복사·공유·QR·길이 초과 안내 (동적 import, M5)
       │   ├─ share-open.js   #share= 링크 열기: 디코딩·검증·확인 후 추가 (동적 import, M5)
       │   ├─ share-codec.js  CompressionStream/DecompressionStream('deflate-raw'), 1MB 상한 스트림 해제 (M5)
       │   ├─ i18n-dom.js     정적 문구 번역 (main.js·shell.js 공용)
       │   ├─ idb-assets.js   IndexedDB 백엔드, 이미지 준비(축소·WebP), object URL 캐시
       │   ├─ canvas.js       위젯 프레임 렌더, 드래그·리사이즈·키보드 (Pointer Events)
       │   ├─ dock.js         위젯 독, 접기
       │   ├─ board-menu.js   보드 목록·관리, 배경 선택(내 이미지 포함), 내보내기/가져오기, 마지막 백업 표시
       │   ├─ display-controls.js  전체 화면·화면 켜두기 (기능 감지, 미지원 시 숨김)
       │   ├─ updates.js      서비스 워커 등록, 새 버전 알림, 저장소 영구 보관 요청
       │   ├─ dialog.js       <dialog> 확인·입력 대화상자, 내용 대화상자(openContentDialog)
       │   ├─ popover.js      <details> 팝오버 공통 동작
       │   └─ dom.js          DOM·아이콘 헬퍼
       └─ widgets/
           ├─ index.js        기본 위젯 등록 (배열 순서 = 독 순서)
           ├─ shared/         ui.js(설정 패널·입력 요소), list.js(명단 파싱)
           ├─ timer/ stopwatch/ clock/ randomizer/ groups/ scoreboard/ traffic/ text/
           ├─ countdown/ dice/ draw/ image/ noise/ qr/   (M4)
           ├─ symbols/         활동 상징 (M6, 그림은 assets/symbols.svg)
           │                  각 index.js + *.css (+ *-logic.js: 순수 상태 전이)
       templates/index.js     보드 템플릿 6종 데이터 (M5, i18n 키·비율 좌표)
       vendor/qrcodegen.js    QR 인코더 (Nayuki v1.4.0, 원본 그대로, QR 위젯이 지연 로드 — ADR-0006)
       styles/widgets.css     위젯 공통 스타일(.w-*), 팀 색 팔레트
```

### 2.1 원칙
- **단방향 데이터 흐름**: UI 이벤트 → `store.update()` → 구독자 재렌더 → persistence 저장
- **순수 로직 분리**: DOM에 의존하지 않는 계산(`*-logic.js`, `core/utils`)을 분리해 Node에서 테스트
- **위젯은 플러그인**: 코어는 개별 위젯을 알지 못함. 레지스트리를 통해서만 연결 ([ADR-0003](adr/ADR-0003-widget-plugin-interface.md))

### 2.2 위젯 인터페이스 (계약)

```js
// widgets/<type>/index.js
export default {
  type: 'timer',                 // 고유 키 (스키마에 저장됨)
  version: 1,                    // 위젯 state 스키마 버전
  icon: 'timer',                 // 아이콘 키
  titleKey: 'widget.timer.title',// i18n 키
  defaultSize: { w: 0.3, h: 0.36 },   // 캔버스 대비 비율
  minSize: { w: 0.14, h: 0.18 },      // defaultSize 이하
  styleUrl: new URL('./timer.css', import.meta.url).href, // 선택: 부팅 시 <link>로 로드
  createState() { return { durationMs: 300000, mode: 'digital', status: 'idle', sound: true }; },
  migrate(state, fromVersion) { return state; }, // version > 1이면 필수
  mount(container, ctx) {
    // ctx: { state, setState(next | (prev) => next), t(key, params) }
    // 반환: { update(nextState), destroy(), openSettings?() }
  },
};
```

- `openSettings`를 반환하면 캔버스가 제목 막대에 설정(⚙) 버튼을 표시한다. 위젯은 `shared/ui.js`의 `createSettingsPanel`로 본문 위에 겹치는 패널을 연다 (Esc·완료로 닫힘)
- 난수는 `core/utils/random.js`(crypto + 거부 샘플링, Fisher–Yates)만 사용한다 — `Math.random` 금지 (공정성)

- `setState`는 **교체**다 (병합 아님). 필드 삭제(예: 타이머 일시정지 시 `endAt` 제거)를 표현하기 위함. 같은 참조를 반환하면 변경 없음
- `update(nextState)`는 상태가 바뀔 때만 호출된다. 위젯은 입력 중인 값을 덮어쓰지 않도록 스스로 비교한다
- 보드 전환·언어 변경 시 위젯은 `destroy()` 후 다시 `mount()`된다 (문구 재번역)
- 정의 검증은 `registry.js`의 `validateWidgetDefinition`이 담당하며, 기본 위젯 전체가 단위 테스트로 계약 준수를 확인한다
- 위젯 내부 런타임 값(진행 중 타이머의 남은 시간 등)도 `state`에 기록하되, **시작 시각 기반**으로 저장해 새로고침 후에도 복원
- 정의가 없거나 저장 버전이 더 높은 위젯은 데이터를 보존한 채 "지원되지 않는 위젯" 프레임으로 표시

### 2.2.1 캔버스 조작
| 입력 | 동작 |
|---|---|
| 위젯 제목 막대 드래그 (마우스·터치) | 이동. 드래그 중에는 DOM만 갱신하고 놓을 때 한 번 저장 |
| 오른쪽 아래 모서리 드래그 | 크기 조절 (`minSize` ~ 캔버스 끝) |
| 위젯 어디든 누르기 / 포커스 | 맨 앞으로 |
| 프레임 포커스 + 화살표 | 1% 이동 (Shift: 5%) |
| 프레임 포커스 + Alt+화살표 | 크기 조절 |
| 프레임 포커스 + Delete/Backspace | 삭제 |

- 드래그는 제목 막대로만 시작해 위젯 내부 조작(버튼·입력)과 충돌하지 않는다 (태블릿 리스크 대응)
- `.canvas`는 `z-index: 0`으로 쌓임 맥락을 만들어 위젯 z가 커져도 툴바·독을 덮지 않는다
- 독이 넘치면(위젯 15종, 태블릿 세로) 가로 스크롤 + 남은 쪽 끝 흐림(`has-more-start/end`), 키보드 포커스 시 해당 항목이 보이게 스크롤

### 2.2.2 M4 위젯 구현 규칙
- **그리기**: 획을 벡터로 저장(data-schema §4). `<canvas>`(devicePixelRatio 반영), Pointer Events + `touch-action: none`, 획이 끝날 때 한 번만 `setState`. 첫 획의 영역 비율(`aspect`)로 **contain** 배치 → 위젯 크기가 바뀌어도 글씨가 늘어나지 않음. 지우개는 `destination-out` 획. 양자화(0~10000) + RDP 단순화(허용 오차 0.2%), 위젯당 점 20,000개 상한. 'ink' 색은 테마 글자색을 따름
  - **키보드 예외(NFR-005)**: 그리기 자체는 포인터 전용. 도구 막대(펜·색·굵기·지우개·취소·모두 지우기)는 키보드로 조작 가능
- **이미지·배경**: 위젯은 `state.assetId`, 배경은 `{ type: 'image', value }` (ADR-0007). 파일 선택·끌어 놓기·붙여넣기(위젯 포커스). object URL은 세션 캐시 공유
- **카운트다운**: 목표는 시간대 없는 로컬 시각. 하루 이상 남고 초를 안 보이면 분 경계마다, 아니면 초마다 갱신. D-day는 달력 날짜 차이(서머타임 무관)
- **소음 측정기**: "측정 시작"(사용자 제스처)에서만 `getUserMedia`, 음성 처리(에코·잡음 억제·자동 이득) 끔, `AnalyserNode`는 스피커에 연결하지 않음. RMS → dBFS → 0~100(감도별 바닥 -45/-55/-65dB, 천장 -10dB), 올라갈 때 빠르고 내려갈 때 느린 평활, 임계값을 **1초 이상** 넘을 때만 시각 경고(소리 경고 없음). `destroy()`·탭 숨김 시 트랙 중지
- **QR**: 라이브러리를 첫 사용 때 `<script>`로 로드, SVG(가로 연속 모듈 합친 path, 여백 4모듈, 흰 바탕 고정)
- **주사위**: `randomInt(6)`, 굴리는 연출은 `prefers-reduced-motion`이면 생략. 결과는 누르는 즉시 저장

### 2.2.3 실행 취소·템플릿·공유 (M5)
- **실행 취소 모델** (ADR-0009): 작업마다 `{ label, boardId, undo, redo, mergeKey? }`를 세션 메모리에 기록(최대 50). 역연산은 ID로 대상을 찾고, 없으면 no-op → 건너뜀. 위젯 state는 건드리지 않으므로 "이동 → 입력 → 실행 취소" 때 입력은 유지
- **기록 지점** (모두 `actions.perform` 경유):

| 위치 | 작업 | 항목 |
|---|---|---|
| 독 | 위젯 추가 | `addWidgetOp` |
| 캔버스 | 삭제 버튼·Delete 키 | `removeWidgetOp` + "위젯을 삭제했어요 — 실행 취소" 알림(6초) |
| 캔버스 | 드래그 끝(이동·크기) | `setRectOp` (값이 같으면 기록 안 함) |
| 캔버스 | 화살표·Alt+화살표 | `setRectOp` merge — 같은 위젯 1초 이내 연속 입력은 한 항목 |
| 보드 메뉴 | 새 보드·복제·템플릿·파일 가져오기 | `addBoardsOp` (취소 시 이전 활성 보드로) |
| 보드 메뉴 | 이름 변경·배경(프리셋·내 이미지) | `renameBoardOp`·`setBackgroundOp` |
| 보드 메뉴 | 보드 삭제 | `deleteBoardOp` + "보드를 삭제했어요 — 실행 취소" 알림. 마지막 보드 삭제로 생긴 빈 보드는 취소 시 비어 있으면 함께 정리 |
| 공유 링크 열기 | 보드 추가 | `addBoardsOp` |

- 기록하지 않음: 위젯 내부 상태, 맨 앞으로(z), 보드 전환, 언어·테마·독 접기, 위젯 버전 마이그레이션
- **단축키**: Ctrl/⌘+Z 실행 취소, Ctrl+Shift+Z·Ctrl+Y·⌘⇧Z 다시 실행. 물리 키(`code`) 기준이라 한글 자판에서도 동작. `input/textarea/select/contenteditable`·위젯 설정 패널·열린 대화상자 안에서는 앱이 가로채지 않음
- 실행 취소 대상이 다른 보드면 그 보드로 전환 후 적용, "실행 취소: 위젯 이동" 알림(3초). 새로고침하면 기록은 사라짐 (언어 변경은 유지 — devlog 결정)
- **템플릿**: `src/templates/index.js` 데이터 → `createBoardFromTemplate`(현재 언어로 문구, 위젯 기본 state에 덮어쓰기, 새 ID). 배치는 위 10%(툴바)·아래 12%(독)를 비우고 겹치지 않게 — 단위 테스트로 강제
- **공유 링크** (ADR-0008): 형식 `#share=1.<base64url(deflate-raw(JSON))>`, JSON = 내보내기 형식. 링크 32,000자 초과 → 파일 내보내기 안내, 2,000자 이하 → QR(오류 정정 L). `CompressionStream('deflate-raw')` 미지원이면 메뉴 숨김
- 템플릿·공유 대화상자 모듈은 메뉴를 열 때 동적 import → 첫 로드에 포함되지 않음 (precache에는 포함되어 오프라인 동작)

### 2.2.4 접근성 (M6, NFR-005, ADR-0010)
- **구조**: 툴바 2개는 이름 있는 `<section>`(보드 도구·화면 설정), 캔버스 `<main>`, 독 `<nav>`. DOM 순서 = 탭 순서: 건너뛰기 링크 → 보드 툴바 → 화면 설정 → 캔버스(위젯) → 독. `<h1>`(숨김)은 보드 도구 영역 안
- **포커스 표시**: 전역 `:focus-visible` = 3px `--color-focus` 링 + 요소와 링 사이 2px 바탕색 띠(`box-shadow`) → 사진·어두운 배경에서도 3:1. 위젯 본문은 `overflow: hidden`이라 텍스트 위젯 입력은 안쪽 링. 선택됨(`aria-pressed`)은 안쪽 링, 포커스는 바깥 링
- **포커스 가림 방지(2.4.11)**: 위쪽 알림이 포커스된 요소(위젯은 제목 막대)를 완전히 덮으면 `.notices--low`로 독 위로 이동
- **대화상자 포커스 복귀**: 연 요소 → (숨겨졌으면) `returnFocus`(보드 메뉴 버튼) → 캔버스 순으로, 실제로 포커스가 옮겨졌는지 확인하며 시도
- **위젯 프레임**: `aria-roledescription="위젯"` + 이름 + `aria-describedby="widget-help"`(조작 안내 1개 공유). 키보드 이동·크기 조절 시 `#announcer`에 "타이머: 가로 30%, 세로 23%"
- **낭독기 알림 정책** — 위젯은 `widgets/shared/ui.js`의 `liveRegion()`으로 사용자 조작의 **최종 결과만** 알린다 (연출 중 바뀌는 글자는 live 아님, 페이지 로드·다시 그리기에서는 알리지 않음):

| 사건 | 알림 | 방식 |
|---|---|---|
| 타이머 종료 | "시간 종료!" | assertive (기존 `.timer__status`) |
| 랜덤 뽑기 · 주사위 | "뽑힌 사람: 김민수" · "주사위 1, 3, 합계 4" | polite, 연출이 끝난 뒤 1회 |
| 모둠 편성 | "8명 · 4개 모둠" | polite, 만들기·다시 섞기 직후 |
| 점수 변경 | "1팀 5점" | polite, ± 버튼으로 바꾼 팀만 |
| 신호등 · 활동 상징 | 상태 문구 | polite |
| 위젯 추가·삭제·실행 취소 | 알림 띠 문구 | `#notices` (status) |
| 키보드 이동·크기 | 위치·크기 % | `#announcer`, 300ms 디바운스 |
| 시계·타이머·스톱워치 숫자 | 읽지 않음 | `aria-live="off"` |

- **색**: 팀 색은 `--team-*`(테두리·면, 바탕 대비 3:1) / `--team-*-text`(글자, 4.5:1) 두 벌, 테마별 값. 신호등 문구·점수판 팀 이름·모둠 이름·글자 색·위젯 강조색이 모두 이 토큰 → `tests/contrast.test.js`가 테마 3종 × 바탕 2종을 계산
- **강제 색상 모드**(`forced-colors: active`): 위젯·버튼 경계 `CanvasText`/`ButtonText`, 선택 상태 `Highlight`, 포커스 `Highlight`. 색이 곧 내용인 견본·신호등·그림·QR·팀 색은 `forced-color-adjust: none`. app.css보다 먼저 로드되므로 선택자에 `:root`를 붙여 우선
- **움직임 줄이기**: 전역 규칙에 `animation-iteration-count: 1` (반복 애니메이션이 1ms 간격으로 번쩍이는 문제 방지), 뽑기·주사위 연출 생략
- **대상 크기(2.5.8)**: 점수판은 카드가 3.75rem보다 좁아지면 열을 줄이고, 그래도 모자라면 겹치는 대신 스크롤. 팀 5개 이상은 버튼 36px(24px 이상)
- **위젯 모양**(M6 결정 D6): 캔버스 `data-look`(solid·glass·outline)·`data-accent` → 위젯 배경·테두리·위쪽 띠·제목 색. 고대비 테마·강제 색상 모드에서는 적용 안 함
- **예외**: 그리기 획은 포인터 전용(TRD 2.2.2) — 도구 막대는 키보드 가능

### 2.3 좌표계
- 위젯 위치·크기는 **캔버스 대비 비율(0~1)** 로 저장 → 노트북·태블릿 간 화면 비율이 달라도 동일 배치 ([ADR-0004](adr/ADR-0004-relative-coordinates.md))
- 위젯 내부 글자 크기는 CSS Container Queries(`cqmin`)로 위젯 크기에 비례

## 3. 데이터 모델과 저장
- 스키마 정의: [data-schema.md](data-schema.md)
- 저장 키: `classboardkit:v{schemaVersion}:boards`, `classboardkit:settings`
- 변경 후 **500ms 디바운스** 저장, `QuotaExceededError` 시 사용자에게 알림 + 내보내기 권유
- `navigator.storage.persist()` 요청 (지원 시) — 홈 화면 앱 실행 시와 첫 내보내기 후에만 (Firefox는 권한 창을 띄우므로 로드 시 호출하지 않음)
- **Safari 저장소 정리 정책**: 사이트와 상호작용이 일정 기간 없으면 스크립트 저장소가 삭제될 수 있음 (홈 화면 설치 PWA는 예외로 알려짐) [검토] → 홈 화면 설치 안내 + 주기적 내보내기 권장 UI

## 4. 브라우저 API

| API | 용도 | 미지원/거부 시 |
|---|---|---|
| Pointer Events | 드래그·리사이즈 (마우스·터치 통합) | — (NFR-001 범위에서 전부 지원) |
| `crypto.getRandomValues` | 공정한 뽑기·편성 (Fisher–Yates) | — |
| Web Audio API | 타이머 종료음 (합성음, 오디오 파일 불필요) | 첫 사용자 제스처 후 AudioContext 활성화 |
| Fullscreen API | 전체 화면 | 버튼 숨김. `webkitRequestFullscreen` 접두어도 감지 (iPadOS 실기기 확인 [검토]) |
| Screen Wake Lock API | 화면 꺼짐 방지 | 버튼 숨김. 요청 거부(저전력 등) 시 알림. 켜짐 여부는 `settings.keepAwake`에 저장하고 탭이 다시 보일 때·첫 제스처에서 재요청 |
| Service Worker / Cache API | 오프라인 | 온라인 전용 동작 |
| File API / `<a download>` | JSON 내보내기/가져오기 | — |
| getUserMedia + Web Audio `AnalyserNode` (M4) | 소음 측정기 | 거부·마이크 없음·사용 중·보안 컨텍스트 아님 각각 안내 |
| IndexedDB (M4) | 이미지·사용자 배경 | 이미지 기능만 비활성 + 안내 |
| `createImageBitmap` + canvas `toBlob` (M4) | 이미지 축소·WebP 재인코딩, 평균 밝기 | WebP 미지원 시 JPEG |
| `crypto.subtle.digest` (M4) | 이미지 ID(내용 해시), 가져오기 무결성 확인 | — (보안 컨텍스트) |
| `CompressionStream`/`DecompressionStream` 'deflate-raw' (M5) | 공유 링크 압축·해제 | 공유 링크 메뉴 숨김, 받은 링크는 "이 브라우저에서는 열 수 없어요" 안내 |
| Clipboard API `writeText` (M5) | 공유 링크 복사 | 링크 입력란을 선택하고 Ctrl+C 안내 |
| Web Share API (M5) | 태블릿에서 "공유…" | 버튼 숨김 |
| `history.replaceState`·`hashchange` (M5) | 공유 링크 처리 후 `#share` 제거, 열린 앱에서 링크 이동 감지 | — |

### 4.1 타이머 정확도
- `setInterval` 누적 방식 금지. **종료 목표 시각(`endAt = Date.now() + remaining`)** 을 저장하고 `requestAnimationFrame`/주기 갱신 시 차이로 계산 → 백그라운드 탭 스로틀링·새로고침에도 정확

## 5. 다국어 (i18n)
- `src/locales/en.js`·`es.js`·`ja.js`·`ko.js` — **JS 모듈로 export** (fetch 불필요, 정적 import). 등록·언어 이름은 `locales/index.js` (코드 순)
- 키 규칙: `영역.대상.속성` (예: `widget.timer.start`)
- 감지: `localStorage` 설정 → `navigator.languages`(지역 코드는 기본 언어로: `es-419` → `es`) → 기본 `en`
- 숫자·날짜는 `Intl.DateTimeFormat`, `Intl.NumberFormat` 사용
- 누락 키는 `en`으로 폴백 + 개발 모드 콘솔 경고
- **자리표시자** `{name}`: 개수는 항상 `{n}`. 여러 개수가 든 문장은 복수형 조각을 끼워 넣음 (`widget.groups.ready` = `{names} → {groups}`)
- **복수형 (M7 D2)**: 값이 `{ one, other, ... }`(CLDR 범주, `other` 필수)면 `t(key, { n })`가 `Intl.PluralRules(값의 언어)`로 고름. 범주가 없거나 `n`이 숫자가 아니면 `other`. ja·ko는 문자열 하나(= `other`)
- **번역 검사**: `tools/i18n-check.mjs` (CI) — 키 누락·여분, 빈 값, 자리표시자 불일치, 복수형 범주(정수 0~1000에서 쓰이는 범주 필수, 언어에 없는 범주 금지) = 오류 / 영어와 같은 값 = 경고(`--strict`면 오류). 순수 함수는 `tools/i18n-lint.mjs`
- 글꼴: `:root:lang(ja)`에서 일본어 글꼴을 `system-ui`보다 앞에 + `font-feature-settings: 'palt'`

## 6. UI·스타일
- 디자인 토큰: `src/styles/tokens.css` (색, 간격, 반경, 그림자, z-index)
- 테마: `[data-theme="light|dark|contrast"]` 로 토큰 재정의, `prefers-color-scheme` 기본값
- `prefers-reduced-motion` 존중 (뽑기 연출 축소)
- 아이콘: 인라인 SVG 스프라이트 1개 파일 (외부 폰트 아이콘 불사용)

## 7. 보안·개인정보
- 사용자 입력은 `textContent`로만 렌더 (`innerHTML` 금지, 정적 템플릿 제외)
- CSP를 `<meta http-equiv="Content-Security-Policy">`로 지정: `default-src 'self'` 기반
- 가져오기 JSON은 스키마 검증 후 반영, 알 수 없는 위젯 타입은 "지원되지 않는 위젯" 플레이스홀더로 보존
  - 처리 순서: 크기(30MB) → JSON 파싱 → `app` 확인 → `schemaVersion`(더 높으면 거부) → 보드 수(1~200) → `migrate()` → 보드별 `validateBoard()` → `assets` 형식 검사(참조된 것만) → 보드·위젯 **새 ID 발급** → 이미지 **내용 해시 = ID 확인** → IndexedDB 저장 → 기존 보드 뒤에 추가
  - 하나라도 실패하면 아무것도 가져오지 않음 (부분 가져오기 없음). 설정(`settings`)은 가져오지 않음
- 외부 요청 없음 (NFR-007)
- 이미지: SVG 업로드 금지(스크립트 포함 가능), 표시는 `blob:` URL(CSP `img-src blob:`)
- **소음 측정기 개인정보**: 소리는 기기 안에서 레벨 숫자로만 바뀌며 녹음·저장·전송하지 않는다. 위젯 state에도 설정값만 저장. 측정 중이 아니면 마이크를 잡지 않음(위젯 삭제·보드 전환·언어 변경·탭 숨김 시 트랙 중지 — E2E로 확인)
- **공유 링크** (ADR-0008): 내용은 URL 조각(#)에만 → HTTP 요청·서버 로그·리퍼러에 포함되지 않음. 이미지는 항상 제외, 명단(랜덤 뽑기·모둠 편성) 제외가 기본. 여는 쪽 처리 순서: `#share` 제거(replaceState) → 기능 감지 → 길이(32,000자) → 버전 접두어(더 높으면 "새 버전" 안내) → base64url 문자 집합 → **스트림 압축 해제 1MB 상한**(압축 폭탄) → UTF-8(fatal) → `parseImport`(위와 같은 검증·새 ID) → **확인 대화상자** → 새 보드로 추가. 링크를 여는 것만으로 데이터가 바뀌지 않음
- 서드파티 코드: `src/vendor/qrcodegen.js`(MIT, 해시 고정 — ADR-0006) 1개

## 8. 테스트 전략

| 종류 | 대상 | 도구 |
|---|---|---|
| 단위 | 뽑기·편성 알고리즘, 타이머 계산, 스키마 검증·마이그레이션, i18n 폴백 | `node --test` |
| E2E | 실제 마우스·터치·키보드 입력으로 화면 조작 검증 (로컬 전용, CI 제외) | `tools/e2e/*.mjs` (Edge/Chrome 헤드리스 + DevTools Protocol, 의존성 없음) |
| 수동 | 기기·브라우저 체크리스트 (노트북 Chrome/Edge/Safari, iPad Safari, Android Chrome) | `docs/trd/qa-checklist.md` |
| 품질 | Lighthouse (데스크톱·모바일 프리셋) | `npx lighthouse@12` + 로컬 Edge(`CHROME_PATH`), 요약: `tools/lh-summary.mjs` |
| 접근성 (M6) | 40개 화면 상태 axe(WCAG 2.0·2.1·2.2 AA + best-practice) + 접근성 트리 이름 검사, 색 대비 토큰 계산 | `tools/e2e/a11y-audit.mjs`·`m6.mjs`(개발 전용 axe-core, ADR-0010), `tests/contrast.test.js` |
| 성능 | 첫 로드에 실제로 요청된 파일 gzip 합계, 지연 로드 모듈이 섞이지 않았는지 | `tools/first-load.mjs` |

- 테스트 파일: `tests/*.test.js` — DOM 비의존 모듈만 import (QR 라이브러리는 `node:vm`에서 일반 스크립트로 실행해 검사)
- E2E 보조: `launch({ args })`로 브라우저 인자 전달(소음 측정기용 `--use-fake-device-for-media-stream`·`--use-fake-ui-for-media-stream`), `tools/e2e/png.mjs`(의존성 없는 PNG 생성), `ready()`(앱 본체가 뜰 때까지 대기)
- `package.json`은 `"type": "module"` 선언과 스크립트 별칭용이며 의존성은 없다 (`npm install` 불필요)
- 브라우저 저장소를 쓸 수 없을 때는 `core/utils/memory-storage.js`로 대체하고 사용자에게 알린다 (테스트용 가짜 저장소와 같은 구현)

## 9. CI/CD
- `.github/workflows/ci.yml`: PR 시 `node --test`
- `.github/workflows/deploy.yml`: `main` 푸시 → 테스트 → `actions/upload-pages-artifact` → `actions/deploy-pages`
- 배포물 = 저장소의 `index.html`, `src/`, `assets/`, `manifest.webmanifest`, `sw.js` (docs·tests 제외)
- Service Worker 캐시 이름 = `cbk-v{VERSION}-{BUILD}`. `BUILD`는 앱 파일 전체의 해시 → 파일이 바뀌면 sw.js도 바뀌어 브라우저가 새 버전을 설치
- **SW 파일 목록 규칙**: `sw.js`의 `PRECACHE`·`BUILD`는 `tools/sw-stamp.mjs`가 생성 (`index.html`, `manifest.webmanifest`, `src/**`, `assets/**`). 앱 파일을 바꾸면 실행. `tests/sw-manifest.test.js`가 누락·잔여 항목·해시 불일치·deploy.yml 포함 여부를 검사하므로 잊으면 CI 실패
- 캐시 전략: 같은 출처 GET은 캐시 우선(쿼리 무시) → 없으면 네트워크 → 오프라인 이동 요청은 `./`. 새 버전은 대기시키고 "새로고침" 알림에서 `SKIP_WAITING` → `controllerchange` 시 새로고침 (수업 중 자동 새로고침 방지). 열린 탭은 다시 보일 때 1시간 간격으로 업데이트 확인
- 아이콘 PNG는 `tools/make-icons.mjs`(헤드리스 Edge로 SVG 캡처)로 생성해 커밋

## 10. 계획 디렉터리 (개발 착수 후 생성)

```
index.html
manifest.webmanifest
sw.js
assets/        icons/, sprite.svg
src/
  main.js
  core/  ui/  widgets/  locales/  styles/
tests/
docs/
.github/
```

## 11. 의존성 목록

| 이름 | 용도 | 라이선스 | 도입 단계 | 상태 |
|---|---|---|---|---|
| (없음) | — | — | MVP | — |
| Nayuki QR Code generator v1.4.0 (`src/vendor/qrcodegen.js`) | F-109 QR 인코딩 | MIT | M4 | 결정: 원본 벤더링, 지연 로드 ([ADR-0006](adr/ADR-0006-qr-library-vendoring.md)) |
| 아이콘 | UI 아이콘 | 자체 제작 (MIT) | M0 | 결정: `assets/icons.svg` 스프라이트 |
| 활동 상징 픽토그램 | F-115 | 자체 제작 (MIT) | M6 | 결정: `assets/symbols.svg` 12종, 위젯을 그릴 때만 요청 |
| axe-core 4.10.3 (**개발 전용**, `.tools/axe/`, git 제외) | 접근성 자동 점검 | MPL-2.0 | M6 | 결정: 배포물·런타임에 포함하지 않음 ([ADR-0010](adr/ADR-0010-dev-accessibility-testing.md)) |
