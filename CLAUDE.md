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
- **git 커밋·푸시·원격 저장소 생성은 사용자가 요청할 때만** (로컬 `main`에 커밋 있음, 원격 저장소 없음 — GitHub 연결은 사용자가 "차후 진행"으로 보류)
- 마일스톤마다: 단위 테스트 + 브라우저 E2E + 스크린샷 확인 → 문서 갱신(ROADMAP·devlog·CHANGELOG·README·TRD/스키마·QA)

## 현재 상태 (2026-11-04)
- M0·M1·M2 완료. 위젯 8종(타이머·스톱워치·시계·랜덤 뽑기·모둠 편성·점수판·신호등·텍스트)
- 단위 테스트 112개, E2E m1 34항목·m2 36항목 통과
- **다음: M3** → [docs/roadmap/M3-plan.md](docs/roadmap/M3-plan.md) 순서대로 진행 ("m3 진행해줘")
- 미완료: iPad Safari 실기기 QA, 원격 저장소·Labels·Milestones·Pages 배포 확인

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
```
- E2E 후 남은 헤드리스 Edge 확인: PowerShell `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ? { $_.CommandLine -like '*cbk-e2e-*' }` (하네스가 자동 정리함)
- 작업 끝나면 8765 서버 종료

## 구조 요약
- `src/core/` 순수 로직(store, schema, persistence, board-ops, geometry, registry, backgrounds, i18n, utils/random 등) → Node 테스트 대상
- `src/ui/` 셸·캔버스·독·보드 메뉴·대화상자·팝오버
- `src/widgets/<type>/` index.js(계약) + css + `*-logic.js`(순수). 등록: `src/widgets/index.js` 배열 1줄
- `src/widgets/shared/` 설정 패널·입력 요소·명단 파서, `src/styles/widgets.css` 공통 위젯 스타일
- 위젯 계약: TRD 2.2 (`setState`는 교체, `openSettings` 선택, 난수는 `core/utils/random.js`만)
- 새 문구는 `src/locales/en.js`·`ko.js` 둘 다 (키 일치 테스트 있음)
- 문서: `docs/README.md` 인덱스, PRD·TRD·data-schema·ADR·ROADMAP·QA·devlog

## 반복해서 겪은 함정
- 같은 CSS 클래스를 다른 역할 버튼에 재사용하지 말 것 (M2: 설정 버튼에 `widget__remove` 재사용 → 선택자 충돌)
- E2E 클릭은 하네스 `click()` 사용 (스크롤 영역 자동 처리). 겹친 위젯은 먼저 배치를 정리
- 원거리 가독성: 스크린샷으로 글자 크기 확인 (기본 크기 위젯에서 본문 18px 이상)
