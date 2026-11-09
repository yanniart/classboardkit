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
- **v0.3.0 출시** (M0~M5 완료, 태그 `v0.1.0`·`v0.2.0`·`v0.3.0`, https://yanniart.github.io/classboardkit/)
  - 위젯 14종, 템플릿 6종, 실행 취소, 공유 링크(#share=), 보드 관리·배경(내 이미지), 이미지 포함 백업, 전체 화면·화면 켜두기, PWA 오프라인, ko/en, 테마 4종
  - 기준선: 단위 **205개**, E2E m1 **34** · m2 **36** · m3 **43**(전체 화면 검사가 환경에 따라 1개 적을 수 있음, M4 기록 44) · m4 **72** · m5 **68** (로컬·배포 URL 모두 통과), Lighthouse(배포) 100/100/100, 첫 로드 gzip 130.7KB
  - 릴리스 노트 `docs/releases/v0.1.0.md`~`v0.3.0.md`, 개발 로그 `docs/devlog/2026/`
- 배포 URL 검증: `E2E_URL=<pages url> node tools/e2e/m1.mjs` 등(m1~m5), `tools/e2e/pwa-remote.mjs`
- 사용자 작업 대기: GitHub Release 페이지(v0.2.0·v0.3.0, 본문 = `docs/releases/*.md`), Labels·Milestones
- 미완료: 실기기 QA(qa-checklist 8·9·10절 — iPad·Safari·Firefox, QR 스캔, 메신저 공유), 서비스명 상표 확인
- 로컬 `m4`·`m5` 브랜치는 `main`에 병합 완료 (남아 있어도 무방)

## ▶ 다음 작업: M6 (접근성·디자인 → v0.4.0)
- 계획서: [docs/roadmap/M6-plan.md](docs/roadmap/M6-plan.md) (결정 D1~D9 = 권장안, D1 = 개발용 axe-core를 `.tools/axe/`에 받아 E2E에서만 사용)
- **사용자가 "m6 진행해줘"라고 하면 확인 질문 없이 바로 시작** (D1 승인 포함):
  1. `git switch -c m6` (main에서) → 단위 205 → 8765 서버 백그라운드 → E2E m1~m5 기준선
  2. 계획서 3-0(진단 기준선 → devlog 표) → 3-1 … 3-7 순서대로. 계획에 없는 선택은 권장안 → devlog "결정 사항"
  3. 끝나면 단위 + E2E(m1~m6) + 스크린샷 + Lighthouse → 문서 갱신 → 보고
- 이월 과제: 시스템 테마 전환 시 그리기 'ink' 즉시 반영, 이미지 배경 위 빈 보드 문구 대비 (devlog M4·M5 "미완료")
- 커밋·병합·푸시(배포)·태그는 **사용자가 요청할 때만**

## 환경 (Windows)
- **시스템에 Node.js 없음.** 포터블 Node를 `.tools/node/node.exe`(git 제외)에 둠
  - 없으면 다시 받기 (Git Bash):
    ```bash
    mkdir -p .tools && cd .tools && curl -sSfLO https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip \
      && curl -sSfL https://nodejs.org/dist/v22.11.0/SHASUMS256.txt | grep node-v22.11.0-win-x64.zip | sha256sum -c \
      && unzip -q node-v22.11.0-win-x64.zip && mv node-v22.11.0-win-x64 node && rm node-v22.11.0-win-x64.zip
    ```
  - 시스템 설치를 원하면 사용자에게 `! winget install OpenJS.NodeJS.LTS` 안내
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
- **상태 변경은 `actions.perform(op)`로** (core/undoable.js 작업) — `store.update`로 직접 바꾸면 실행 취소 기록이 빠짐 (위젯 내부 state·z·보드 전환·설정은 예외)
- DOM `append(null)`은 "null" 글자를 넣음 (`h()` 헬퍼만 거름) → 조건부 요소는 걸러서 append (M5)
- 템플릿·공유 대화상자는 동적 import — 첫 로드에 넣지 말 것 (`tools/first-load.mjs`로 gzip 합계·lazy 모듈 0 확인)
- `src/vendor/qrcodegen.js`는 수정 금지 (해시 테스트). 갱신 절차는 ADR-0006
