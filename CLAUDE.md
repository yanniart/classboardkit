# ClassBoardKit — 작업 안내 (Claude용)

오프라인 우선 교실 위젯 보드. Classroomscreen을 참고한 **독립 서비스**(이름·아이콘·디자인 복제 금지).
1인 개발 개인 포트폴리오, MIT 라이선스(저작권자 yanniart).

## 사용자 규칙
- **응답은 한국어**, 코드는 영어, 코드 주석은 한국어
- 확정된 제약 (바꾸자고 제안하지 말 것):
  - 빌드 도구·프레임워크 없음 → Vanilla JS ES Modules, GitHub Pages
  - 서버·계정·BaaS 없음 → localStorage(+ 추후 IndexedDB), 학생 기기 참여 기능 없음
  - 대상: 해외 포함 누구나, 기기: 노트북·태블릿(터치)
  - 런타임 외부 라이브러리 0 (도입 시 ADR + 벤더링)
- **git 커밋·푸시·태그는 사용자가 요청할 때만**. 원격: `origin` = https://github.com/yanniart/classboardkit (공개), `main` 푸시 = Pages 자동 배포 → https://yanniart.github.io/classboardkit/
- 이 PC에 `gh` CLI 없음 → GitHub 웹 작업(Release·Settings·Labels)은 사용자에게 요청. 공개 API(curl)로 Actions 상태 확인 가능:
  `curl -s "https://api.github.com/repos/yanniart/classboardkit/actions/runs?per_page=3"`
- 계획에 없는 선택은 권장안으로 정하고 진행 → devlog "결정 사항"에 기록 (사용자가 권장안 위임을 선호, 2026-11-05)
- 마일스톤마다: 단위 테스트 + 브라우저 E2E + 스크린샷 확인 → 문서 갱신(ROADMAP·devlog·CHANGELOG·README·TRD/스키마·QA)

## 현재 상태 (2026-11-09)
- **v0.3.0 출시** (M0~M5, 태그 `v0.1.0`~`v0.3.0`, https://yanniart.github.io/classboardkit/)
- **M6 구현 완료 — `m6` 브랜치, 커밋 전** (접근성 점검·개선 NFR-005 · 활동 상징 F-115 · 위젯 모양 → v0.4.0)
  - 기준선: 단위 **226개**, E2E m1 **34** · m2 **36** · m3 **43**(환경에 따라 44) · m4 **72** · m5 **68** · m6 **58** (40개 화면 상태 axe 위반 0)
  - 첫 로드 gzip 145.1KB, Lighthouse 로컬 데스크톱 100 · 모바일 89 (python 서버 편차, 배포 URL에서 재확인)
  - 기록: `docs/devlog/2026/2026-11-09-m6.md`(진단 기준선 표), ADR-0010, 릴리스 노트 `docs/releases/v0.4.0.md`(배포 날짜 비어 있음), CHANGELOG `[0.4.0] - 미출시`
  - 로컬 `main`에 M6 계획서 커밋 `291154c`이 **푸시 안 된 상태** (m6은 그 위에서 분기) — 병합·푸시 때 함께 올라감
- 사용자 작업 대기: GitHub Release 페이지(v0.2.0~v0.4.0), Labels·Milestones
- 미완료: 실기기 QA(qa-checklist 8~11절 — iPad·Safari·Firefox, QR 스캔, 메신저 공유, NVDA·VoiceOver·Windows 고대비), 서비스명 상표 확인

## ▶ 다음 작업: M6 출시 (사용자 요청 시에만)
- "커밋해줘" → `m6`에 커밋 / "병합하고 배포해줘" → `main` fast-forward 병합·푸시 → Actions 확인 → 배포 URL E2E(`E2E_URL=... m1~m6`, pwa-remote)·Lighthouse / "문서 반영하고 태그 달아줘" → 릴리스 노트·CHANGELOG 날짜, ROADMAP·PRD·M6 계획서·devlog "출시" 절·README 상태 갱신 → `v0.4.0` 태그
- 그다음 M7(생태계: 추가 언어·기여 가이드·v1.0.0) 계획서 작성

## 환경 (Windows)
- **시스템에 Node.js 없음.** 포터블 Node를 `.tools/node/node.exe`(git 제외)에 둠
  - 없으면 다시 받기 (Git Bash):
    ```bash
    mkdir -p .tools && cd .tools && curl -sSfLO https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip \
      && curl -sSfL https://nodejs.org/dist/v22.11.0/SHASUMS256.txt | grep node-v22.11.0-win-x64.zip | sha256sum -c \
      && unzip -q node-v22.11.0-win-x64.zip && mv node-v22.11.0-win-x64 node && rm node-v22.11.0-win-x64.zip
    ```
  - 시스템 설치를 원하면 사용자에게 `! winget install OpenJS.NodeJS.LTS` 안내
- **개발 전용 axe-core** `.tools/axe/axe.min.js`(git 제외, ADR-0010). 없으면 m6·a11y-audit이 트리 검사만 함. 다시 받기 (Git Bash):
    ```bash
    mkdir -p .tools/axe && cd .tools/axe && curl -sSfLO https://registry.npmjs.org/axe-core/-/axe-core-4.10.3.tgz       && [ "sha512-$(openssl dgst -sha512 -binary axe-core-4.10.3.tgz | base64 -w0)" = "sha512-Xm7bpRXnDSX2YE2YFfBk2FnF0ep6tmG7xPh8iHee8MIcrgq762Nkce856dYtJYLkuIoYZvGfTs/PbZhideTcEg==" ]       && tar -xzf axe-core-4.10.3.tgz package/axe.min.js package/LICENSE && mv package/* . && rmdir package && rm axe-core-4.10.3.tgz
    ```
- Python 3.13 있음 → 정적 서버. Edge 설치됨 → E2E 브라우저
- Bash 도구에서 heredoc 안의 따옴표가 섞인 긴 파이썬은 실패할 수 있음 → 스크립트는 파일로 써서 실행

## 명령
```bash
.tools/node/node.exe --test                         # 단위 테스트 (tests/*.test.js)
python -m http.server 8765 --bind 127.0.0.1          # 앱 서버 (백그라운드로)
.tools/node/node.exe tools/e2e/m1.mjs                # E2E (서버 필요), 스크린샷 → tools/e2e/out/
.tools/node/node.exe tools/e2e/m2.mjs
.tools/node/node.exe tools/e2e/m3.mjs                # 포트 8766도 사용 (오프라인 검사용 자체 서버)
.tools/node/node.exe tools/e2e/m4.mjs                # M4 위젯 (가짜 마이크 인자 사용, 8766도 사용)
.tools/node/node.exe tools/e2e/m5.mjs                # M5 실행 취소·템플릿·공유 (보조 브라우저 1개 더 띄움, 8767 사용)
.tools/node/node.exe tools/e2e/m6.mjs                # M6 접근성(axe 40개 상태)·활동 상징·위젯 모양 (~3분)
.tools/node/node.exe tools/e2e/a11y-audit.mjs        # 접근성 진단 표 (상태별 axe·이름 없는 요소) → tools/e2e/out/a11y-audit.json
.tools/node/node.exe tools/first-load.mjs            # 첫 로드 gzip 합계 + 지연 로드 모듈이 섞였는지
.tools/node/node.exe tools/sw-stamp.mjs              # ★ 앱 파일(index.html·manifest·src·assets) 변경 후 필수
.tools/node/node.exe tools/make-icons.mjs            # 아이콘 SVG 변경 시 PNG 재생성 (서버 필요)
```
- Lighthouse (npx 일회성 실행, 사용자 승인 받음 2026-11-05):
  `PATH="$PWD/.tools/node:$PATH" CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx --yes lighthouse@12 http://127.0.0.1:8765/ --only-categories=performance,accessibility,best-practices --chrome-flags="--headless=new" --output=json --output-path=tools/e2e/out/lh-mobile.json --quiet` (데스크톱은 `--preset=desktop`) → `node tools/lh-summary.mjs <json>`
- E2E 후 남은 헤드리스 Edge 확인: PowerShell `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ? { $_.CommandLine -like '*cbk-e2e-*' }` (하네스가 자동 정리함)
- 작업 끝나면 8765 서버 종료

## 구조 요약
- `src/core/` 순수 로직(store, schema, persistence, board-ops, geometry, registry, backgrounds, i18n, history·undoable, templates, share, utils/random 등) → Node 테스트 대상
- `src/templates/index.js` 템플릿 데이터 (위 10%·아래 12% 비우기, 겹침 금지 — 테스트가 강제)
- `src/ui/` 셸·캔버스·독·보드 메뉴·대화상자·팝오버, actions(실행 취소)·undo-controls·template-dialog·share-*
- `assets/symbols.svg` 활동 상징 12종 (48px, currentColor, 인라인 style 금지 — 테스트가 검사)
- `src/widgets/<type>/` index.js(계약) + css + `*-logic.js`(순수). 등록: `src/widgets/index.js` 배열 1줄
- `src/widgets/shared/` 설정 패널·입력 요소·명단 파서, `src/styles/widgets.css` 공통 위젯 스타일
- 위젯 계약: TRD 2.2 (`setState`는 교체, `openSettings` 선택, 난수는 `core/utils/random.js`만)
- 새 문구는 `src/locales/en.js`·`ko.js` 둘 다 (키 일치 테스트 있음)
- 문서: `docs/README.md` 인덱스, PRD·TRD·data-schema·ADR·ROADMAP·QA·devlog

## 반복해서 겪은 함정
- **sw-stamp 잊으면** `tests/sw-manifest.test.js` 실패 (BUILD 해시 불일치). 브라우저에서 수정이 안 보이면 SW 캐시 탓 → 새 버전 알림의 새로고침 또는 DevTools "Update on reload"
- E2E 하네스는 `console.warn`도 오류로 집계 → 예상된 실패는 `console.info`
- DevTools 네트워크 오프라인 에뮬레이션은 SW fetch를 못 막음 → 서버를 실제로 꺼서 검증
- Bash 도구에서 `cat > file` 뒤에 heredoc 없이 쓰면 입력 대기로 멈춤
- 같은 CSS 클래스를 다른 역할 버튼에 재사용하지 말 것 (M2: 설정 버튼에 `widget__remove` 재사용 → 선택자 충돌)
- E2E 클릭은 하네스 `click()` 사용 (스크롤 영역 자동 처리). 겹친 위젯은 먼저 배치를 정리
- 원거리 가독성: 스크린샷으로 글자 크기 확인 (기본 크기 위젯에서 본문 18px 이상)
- **Bash에서 `node -e "..."` 안에 백틱 템플릿 문자열을 쓰면 셸이 명령 치환으로 해석**해 코드가 깨짐(M4에서 2번) → 긴 수정은 Edit 도구나 Write로 만든 스크립트 파일로
- Bash heredoc 안의 `\\`는 `\`로 바뀔 수 있음 → 백슬래시가 든 스크립트도 Write 도구로 작성
- `src/main.js`는 첫 화면만 그리고 `app.js`를 동적 import → E2E는 `b.ready()`로 대기 (고정 sleep은 가끔 실패)
- 이미지 저장소는 IndexedDB(`classboardkit`/`assets`), 이미지 ID는 내용 해시. 위젯은 `state.assetId` 한 필드만 써야 백업·GC가 인식
- **접근성 (M6)**: 새 색은 `--team-*`(면 3:1)/`--team-*-text`(글자 4.5:1) 토큰만 → `tests/contrast.test.js`가 계산. 위젯 결과 알림은 `liveRegion().say()`로 사용자 조작 직후 1번만 (연출 중·다시 그리기 때 aria-live 금지). 새 버튼은 이름 필수(접근성 트리 검사가 잡음). 기능 추가 후 `a11y-audit.mjs`
- `base.css`는 `app.css`보다 먼저 로드 → base.css에서 app.css 규칙을 덮으려면 명시도를 올릴 것 (강제 색상 블록은 `:root ` 접두어)
- E2E 하네스 `key()`는 `rawKeyDown`만 보냄 → **Enter로 버튼 누르기는 안 됨** (m6의 `enter()`처럼 `text: '\r'` 포함 keyDown)
- 툴바는 쌓임 맥락(z 100) — 팝오버가 독(z 100) 위로 오려면 `.toolbar:has(details[open])` 규칙이 필요 (이미 있음)
- **상태 변경은 `actions.perform(op)`로** (core/undoable.js 작업) — `store.update`로 직접 바꾸면 실행 취소 기록이 빠짐 (위젯 내부 state·z·보드 전환·설정은 예외)
- DOM `append(null)`은 "null" 글자를 넣음 (`h()` 헬퍼만 거름) → 조건부 요소는 걸러서 append (M5)
- 템플릿·공유 대화상자는 동적 import — 첫 로드에 넣지 말 것 (`tools/first-load.mjs`로 gzip 합계·lazy 모듈 0 확인)
- `src/vendor/qrcodegen.js`는 수정 금지 (해시 테스트). 갱신 절차는 ADR-0006
