# TRD: ClassBoardKit

| status | version | updated | owner |
|---|---|---|---|
| draft | 0.2 | 2026-11-05 | @owner |

관련 문서: [PRD](../prd/PRD.md) · [데이터 스키마](data-schema.md) · [ADR 목록](adr/)

## 1. 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 마크업/스타일 | HTML5, CSS (Custom Properties, Container Queries) | 표준만 사용 |
| 스크립트 | Vanilla JavaScript ES2020+, ES Modules | [ADR-0001](adr/ADR-0001-no-build-vanilla-js.md) |
| 빌드 | 없음 | 1인 유지보수, 소스 = 배포물 |
| 저장 | localStorage (보드), IndexedDB (이미지, Phase 2) | [ADR-0002](adr/ADR-0002-local-only-storage.md) |
| 호스팅 | GitHub Pages | 무료, HTTPS 기본 제공 (마이크·Wake Lock 등 보안 컨텍스트 필요) |
| CI/CD | GitHub Actions | 테스트 후 Pages 배포 |
| 테스트 | Node.js 내장 `node:test` (개발 환경에서만) | npm 의존성 없이 순수 로직 테스트 |
| 오프라인 | Service Worker + Web App Manifest (직접 작성) | 라이브러리 불필요 |

## 2. 아키텍처

```
index.html, manifest.webmanifest, sw.js(서비스 워커, 루트 = 범위 전체)
  └─ src/main.js ─ 앱 부트스트랩
       ├─ core/
       │   ├─ store.js        단일 상태 저장소 (get / update / subscribe)
       │   ├─ persistence.js  localStorage 저장·복원, 디바운스, 할당량 오류 처리
       │   ├─ schema.js       검증, 마이그레이션 (schemaVersion)
       │   ├─ registry.js     위젯 등록·조회, 정의 검증, 위젯 버전 마이그레이션(prepareWidget)
       │   ├─ board-ops.js    보드·위젯 상태 변경 순수 함수 (추가/삭제/이동/z-order/복제…)
       │   ├─ geometry.js     비율 좌표 이동·크기 조절·배치 계산
       │   ├─ backgrounds.js  배경 프리셋, 밝기(tone) 판정
       │   ├─ transfer.js     내보내기 파일 생성, 가져오기 파싱·검증·새 ID 발급, 파일명
       │   ├─ i18n.js         메시지 조회, 언어 감지
       │   └─ utils/          id, debounce, memory-storage, sound(Web Audio)
       ├─ ui/
       │   ├─ shell.js        언어·테마 설정, 정적 문구 번역, 알림(error/info, 매개변수, 액션 버튼)
       │   ├─ canvas.js       위젯 프레임 렌더, 드래그·리사이즈·키보드 (Pointer Events)
       │   ├─ dock.js         위젯 독, 접기
       │   ├─ board-menu.js   보드 목록·관리, 배경 선택, 내보내기/가져오기, 마지막 백업 표시
       │   ├─ display-controls.js  전체 화면·화면 켜두기 (기능 감지, 미지원 시 숨김)
       │   ├─ updates.js      서비스 워커 등록, 새 버전 알림, 저장소 영구 보관 요청
       │   ├─ dialog.js       <dialog> 확인·입력 대화상자
       │   ├─ popover.js      <details> 팝오버 공통 동작
       │   └─ dom.js          DOM·아이콘 헬퍼
       └─ widgets/
           ├─ index.js        기본 위젯 등록 (배열 순서 = 독 순서)
           ├─ shared/         ui.js(설정 패널·입력 요소), list.js(명단 파싱)
           ├─ timer/ stopwatch/ clock/ randomizer/ groups/ scoreboard/ traffic/ text/
           │                  각 index.js + *.css (+ *-logic.js: 순수 상태 전이)
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
| getUserMedia (Phase 2) | 소음 측정기 | 권한 거부 안내 |

### 4.1 타이머 정확도
- `setInterval` 누적 방식 금지. **종료 목표 시각(`endAt = Date.now() + remaining`)** 을 저장하고 `requestAnimationFrame`/주기 갱신 시 차이로 계산 → 백그라운드 탭 스로틀링·새로고침에도 정확

## 5. 다국어 (i18n)
- `src/locales/ko.js`, `en.js` — **JS 모듈로 export** (fetch 불필요, 정적 import)
- 키 규칙: `영역.대상.속성` (예: `widget.timer.start`)
- 감지: `localStorage` 설정 → `navigator.languages` → 기본 `en`
- 숫자·날짜는 `Intl.DateTimeFormat`, `Intl.NumberFormat` 사용
- 누락 키는 `en`으로 폴백 + 개발 모드 콘솔 경고

## 6. UI·스타일
- 디자인 토큰: `src/styles/tokens.css` (색, 간격, 반경, 그림자, z-index)
- 테마: `[data-theme="light|dark|contrast"]` 로 토큰 재정의, `prefers-color-scheme` 기본값
- `prefers-reduced-motion` 존중 (뽑기 연출 축소)
- 아이콘: 인라인 SVG 스프라이트 1개 파일 (외부 폰트 아이콘 불사용)

## 7. 보안·개인정보
- 사용자 입력은 `textContent`로만 렌더 (`innerHTML` 금지, 정적 템플릿 제외)
- CSP를 `<meta http-equiv="Content-Security-Policy">`로 지정: `default-src 'self'` 기반
- 가져오기 JSON은 스키마 검증 후 반영, 알 수 없는 위젯 타입은 "지원되지 않는 위젯" 플레이스홀더로 보존
  - 처리 순서: 크기(5MB) → JSON 파싱 → `app` 확인 → `schemaVersion`(더 높으면 거부) → 보드 수(1~200) → `migrate()` → 보드별 `validateBoard()` → 보드·위젯 **새 ID 발급** → 기존 보드 뒤에 추가
  - 하나라도 실패하면 아무것도 가져오지 않음 (부분 가져오기 없음). 설정(`settings`)은 가져오지 않음
- 외부 요청 없음 (NFR-007)

## 8. 테스트 전략

| 종류 | 대상 | 도구 |
|---|---|---|
| 단위 | 뽑기·편성 알고리즘, 타이머 계산, 스키마 검증·마이그레이션, i18n 폴백 | `node --test` |
| E2E | 실제 마우스·터치·키보드 입력으로 화면 조작 검증 (로컬 전용, CI 제외) | `tools/e2e/*.mjs` (Edge/Chrome 헤드리스 + DevTools Protocol, 의존성 없음) |
| 수동 | 기기·브라우저 체크리스트 (노트북 Chrome/Edge/Safari, iPad Safari, Android Chrome) | `docs/trd/qa-checklist.md` |
| 품질 | Lighthouse (데스크톱·모바일 프리셋) | `npx lighthouse@12` + 로컬 Edge(`CHROME_PATH`), 요약: `tools/lh-summary.mjs` |

- 테스트 파일: `tests/*.test.js` — DOM 비의존 모듈만 import
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
| QR 생성 라이브러리 (후보 미정) | F-109 | 확인 필요 | Phase 2 | [검토] 벤더링 예정 |
| 아이콘 | UI 아이콘 | 자체 제작 (MIT) | M0 | 결정: `assets/icons.svg` 스프라이트 |
