# M3 실행 계획: 안정화·출시 (v0.1.0)

| status | version | updated | owner |
|---|---|---|---|
| ready | 1.0 | 2026-11-04 | @owner |

> 다음 세션에서 "m3 진행해줘"라고 하면 이 문서 순서대로 바로 진행한다.
> 범위: F-005(내보내기/가져오기), F-009(전체 화면·화면 꺼짐 방지), F-010(PWA 오프라인), Lighthouse 90+, v0.1.0 준비.
> F-011(테마)은 M0에서 이미 완료.

## 0. 시작 전 확인 (1분)

```bash
cd C:/dev/boardkit
.tools/node/node.exe --test            # 112개 통과 확인 (M2 종료 시점)
python -m http.server 8765 --bind 127.0.0.1   # 백그라운드
.tools/node/node.exe tools/e2e/m1.mjs   # 34/34
.tools/node/node.exe tools/e2e/m2.mjs   # 36/36
```

`.tools/node`가 없으면 → [CLAUDE.md](../../CLAUDE.md) "환경" 절의 포터블 Node 설치 명령 실행.

## 1. 작업 순서

### 1-1. 내보내기/가져오기 (F-005) — 가장 먼저
**새 파일 `src/core/transfer.js`** (순수 함수, 테스트 대상)
- `createExport(boards, { settings?, now })` → data-schema §1 형식 `{ app: 'classboardkit', schemaVersion, exportedAt, boards, settings? }`
- `parseImport(text)` → `{ ok, boards, errors }`
  - JSON 파싱 실패, `app` 불일치, 크기 초과(5MB), `schemaVersion` 더 높음 → 오류
  - `migrate()` 후 `validateBoard()`로 보드별 검증
  - 가져온 보드·위젯에 **새 ID 발급** (기존 보드와 충돌 방지), 이름 그대로
  - 알 수 없는 위젯 타입은 보존 (캔버스가 플레이스홀더 표시)
- `exportFileName(boardName | 'all', now)` → `classboardkit-<slug>-YYYYMMDD.classboardkit.json` (파일명 금지 문자 제거, 한글 허용)
- `importBoards(state, boards)` (board-ops에 추가 가능) → 기존 보드 뒤에 추가, 첫 가져온 보드 활성화

**UI (`src/ui/board-menu.js`, `index.html`)**
- 보드 메뉴 actions에 `export`(현재 보드), `exportAll`(전체), `import` 버튼 추가 → 2열 그리드 유지 (총 7개면 마지막 줄 정리)
- 다운로드: `Blob` + `URL.createObjectURL` + `<a download>` (CSP `blob:` 이미 허용됨) → 이후 `revokeObjectURL`
- 가져오기: 숨긴 `<input type="file" accept=".json,application/json">` → `file.text()` → `parseImport`
- 결과 알림: 성공 "보드 n개를 가져왔어요" / 실패 사유별 메시지 → `shell.notify`는 현재 오류 스타일(빨간 띠)만 있음 → **알림 종류(info/error) 추가** 필요 (`notify(key, { type, params })`)
- 백업 권장(ADR-0002 보완): `settings.lastExportAt` (선택 필드, ISO) 저장 → 보드 메뉴 하단에 "마지막 백업: n일 전 / 백업한 적 없음" 표시 (선택 구현, 시간 남으면)

**i18n**: `board.export`, `board.exportAll`, `board.import`, `transfer.*` (성공·오류 메시지), `board.lastBackup*`

**테스트 `tests/transfer.test.js`**: 왕복(export→parse) 동일성, 새 ID 발급, 잘못된 JSON·다른 app·미래 버전·검증 실패·빈 boards, 파일명 slug

### 1-2. 전체 화면·화면 꺼짐 방지 (F-009)
- 툴바 오른쪽(설정 버튼 왼쪽)에 아이콘 버튼 2개: 전체 화면(`maximize`/`minimize` 아이콘 신규), 화면 꺼짐 방지(`sun` 아이콘 신규, `aria-pressed`)
- 전체 화면: `document.fullscreenEnabled` 아니면 버튼 숨김. `document.documentElement.requestFullscreen()` / `exitFullscreen()`, `fullscreenchange`로 상태 동기화
  - iPadOS Safari는 `webkitRequestFullscreen` 접두어 필요할 수 있음 [검토] → 둘 다 감지
- Wake Lock: `'wakeLock' in navigator` 아니면 숨김. 켜면 `navigator.wakeLock.request('screen')`, `visibilitychange`(visible)에서 재요청, 해제 이벤트 처리. **저장하지 않음**(세션 단위) 또는 `settings.keepAwake` 저장 후 첫 사용자 제스처에서 재요청 — 후자 권장
- 새 모듈 `src/ui/display-controls.js`, i18n `display.*`

### 1-3. PWA 오프라인 (F-010)
- `manifest.webmanifest`: name/short_name "ClassBoardKit", `start_url: "./"`, `scope: "./"`, `display: "standalone"`, theme/background color, icons
- 아이콘: `assets/icons/icon.svg`(any) + **PNG 192·512, maskable 512, apple-touch-icon 180** 필요
  - 빌드 없이 생성: 헤드리스 Edge로 SVG 스크린샷 → `tools/make-icons.mjs` 작성 (harness 재사용, `Emulation.setDeviceMetricsOverride` + `Page.captureScreenshot` with `clip`, 투명 배경은 `Emulation.setDefaultBackgroundColorOverride({color:{r:0,g:0,b:0,a:0}})`)
- `index.html`: `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`
- `sw.js` (루트): 버전 포함 캐시 이름 `cbk-v0.1.0-<n>`, install 시 **앱 파일 목록 전부 precache**, fetch는 같은 출처 GET에 cache-first → 실패 시 네트워크, activate에서 옛 캐시 삭제
  - 빌드가 없으므로 목록은 `sw.js` 안 배열로 직접 관리 → **`tests/sw-manifest.test.js`**: `src/`·`assets/` 아래 모든 파일과 `index.html`·`manifest.webmanifest`가 목록에 있는지, 목록 파일이 실제 존재하는지 검사 (빠뜨림 방지)
- `src/main.js`: `navigator.serviceWorker.register('./sw.js')` (지원 시). 새 버전 대기 시 알림 "새 버전이 있어요 — 새로고침" (info 알림 재사용)
- `deploy.yml`: `_site`에 `sw.js`, `manifest.webmanifest` 복사 추가
- CSP: `default-src 'self'`가 manifest·worker를 포함하므로 변경 불필요 (확인만)
- 오프라인 설치 안내: 보드 메뉴 또는 설정에 "홈 화면에 추가하면 데이터가 더 안전하게 보관돼요" (Safari 저장소 정리 정책 대응, TRD 3) — 선택

### 1-4. 품질: Lighthouse 90+ / 접근성 점검
- 측정: `npx lighthouse http://127.0.0.1:8765/ --only-categories=performance,accessibility,best-practices --chrome-flags="--headless=new" --output=json --output-path=tools/e2e/out/lh.json`
  - Edge 사용 시 `CHROME_PATH`에 msedge.exe 경로 지정. `npx`는 일회성 다운로드(런타임 의존성 아님) — **실행 전 사용자 확인**
  - 대안: Edge DevTools → Lighthouse 탭에서 수동 측정
- 예상 지적 사항과 대응
  - 모듈 요청이 많음 → `index.html`에 핵심 모듈 `<link rel="modulepreload">` 추가
  - 위젯 CSS 동적 로드 → 렌더 차단 아님(괜찮음), 필요 시 `index.html`에 직접 link
  - 대비: `--color-text-muted`(#5b6676) on surface-muted 확인, 독 라벨 0.75rem 대비
  - `<main>` 랜드마크·제목: 화면에 `h1` 없음 → 시각적으로 숨긴 `h1` 추가 (`.sr-only`)
- 결과 점수를 개발 로그에 기록

### 1-5. 출시 준비 (v0.1.0)
- README: 스크린샷(`docs/images/` — `tools/e2e/out/m2-desktop-ko.png` 등 복사), 기능 목록, 사용법, 개인정보 안내(데이터는 브라우저에만)
- CHANGELOG: `[Unreleased]` → `[0.1.0] - YYYY-MM-DD`
- `package.json` version 0.1.0
- PRD 릴리스 범위 확인, ROADMAP M3 완료 표시, QA 체크리스트 8절(M3) 추가
- **git 커밋·태그·원격 저장소·Pages 배포는 사용자 승인 후** (현재까지 커밋 0개, 사용자 "차후 진행" 결정)

## 2. E2E `tools/e2e/m3.mjs` (신규)
- 내보내기: `Browser.setDownloadBehavior({ behavior: 'allow', downloadPath: OUT_DIR, eventsEnabled: true })` → 버튼 클릭 → `Browser.downloadProgress` completed → 파일 JSON 검증
- 가져오기: `DOM.getDocument` → `DOM.querySelector('input[type=file]')` → `DOM.setFileInputFiles({ files: [path], nodeId })` → 보드 수 증가·이름·위젯 확인
- 잘못된 파일 가져오기 → 오류 알림 표시, 보드 수 그대로
- 전체 화면 버튼 존재·`aria-pressed` 토글(헤드리스에서 실제 전체 화면은 제한될 수 있음 → 상태만 확인)
- PWA: `navigator.serviceWorker.ready` 대기 → `Network.enable` + `Network.emulateNetworkConditions({ offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })` → 새로고침 → 위젯 렌더·콘솔 오류 0
- M1·M2 회귀 실행

## 3. 완료 기준 (DoD)
- [ ] 단위 테스트 전부 통과 (신규: transfer, sw-manifest)
- [ ] E2E m1·m2·m3 전부 통과, 콘솔 오류 0
- [ ] 오프라인 새로고침 동작
- [ ] Lighthouse Performance·Accessibility·Best Practices 각 90+
- [ ] 문서 갱신: PRD 미결·TRD(transfer·PWA·SW 목록 규칙)·data-schema(settings.lastExportAt/keepAwake 추가 시)·ROADMAP·QA·devlog·CHANGELOG·README
- [ ] v0.1.0 릴리스 노트 초안 (태그는 사용자 승인 후)

## 4. 리스크
| 리스크 | 대응 |
|---|---|
| SW 캐시로 새 버전이 안 보임 | 캐시 이름 버전 + 새 버전 알림 + 개발 중엔 DevTools "Update on reload" |
| SW 파일 목록 누락 | `sw-manifest.test.js`로 강제 |
| 헤드리스에서 Fullscreen/Wake Lock 동작 제한 | E2E는 버튼 상태·기능 감지만 검사, 실기기 QA로 확인 |
| 대용량 가져오기 | 5MB 제한, 명단 200명 제한은 위젯 파서가 이미 적용 |
