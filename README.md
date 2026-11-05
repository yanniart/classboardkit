# ClassBoardKit

> 설치·로그인 없이 브라우저에서 바로 쓰는 오프라인 우선 교실 위젯 보드

**👉 바로 사용하기: https://yanniart.github.io/classboardkit/**

ClassBoardKit은 노트북·태블릿 화면을 수업용 대시보드로 바꿔 주는 웹 서비스입니다.
타이머, 랜덤 뽑기, 모둠 편성, 점수판 같은 위젯을 자유롭게 배치하고, 모든 데이터는 사용자의 브라우저에만 저장됩니다.

- **누구나, 제한 없이**: 계정·결제·기능 제한 없음
- **서버 없음**: GitHub Pages 정적 호스팅, 데이터 외부 전송 없음
- **오프라인**: 한 번 열면 인터넷 없이도 동작, 홈 화면에 앱으로 설치 가능
- **빌드 없음**: HTML · CSS · Vanilla JavaScript(ES Modules), 런타임 의존성 0
- **다국어**: 한국어 · 영어

![위젯 8종을 배치한 보드 (한국어, 데스크톱)](docs/images/board-desktop-ko.png)

## 현재 상태

✅ **v0.1.0 (MVP) 공개** — M0~M3 완료, GitHub Pages 배포 (2026-11-05)

## 기능

| 구분 | 내용 |
|---|---|
| 위젯 8종 | 타이머(숫자/원형), 스톱워치(랩), 시계(디지털/아날로그), 랜덤 뽑기(중복 제외), 모둠 편성, 점수판(2~8팀), 신호등, 텍스트 |
| 보드 | 여러 보드 만들기·이름 변경·복제·삭제, 배경 12종, 위젯 드래그·크기 조절(마우스·터치·키보드) |
| 백업 | 현재 보드 또는 전체를 JSON 파일로 내보내기·가져오기, 마지막 백업 시점 표시 |
| 화면 | 전체 화면, 화면 켜두기(Wake Lock), 테마(시스템·라이트·다크·고대비) |
| 오프라인 | Service Worker로 앱 파일 전체 캐시, 새 버전 알림 |

| 다크 테마 (영어) | 태블릿 가로 | 보드 메뉴 · 백업 |
|---|---|---|
| ![다크 테마](docs/images/board-dark-en.png) | ![태블릿](docs/images/board-tablet.png) | ![보드 메뉴](docs/images/board-menu-backup.png) |

## 사용법

1. 아래 독에서 위젯을 누르면 보드에 추가됩니다. 제목 막대를 끌어 옮기고, 오른쪽 아래 모서리로 크기를 바꿉니다.
2. 위젯의 ⚙ 버튼에서 명단·시간·팀 등을 설정합니다.
3. 왼쪽 위 보드 이름을 누르면 보드 전환·관리, 배경, **백업(내보내기/가져오기)** 메뉴가 열립니다.
4. 오른쪽 위 버튼: 화면 켜두기 ☀ · 전체 화면 ⛶ · 설정(언어·테마)
5. 태블릿에서는 브라우저의 "홈 화면에 추가"로 설치하면 전체 화면 앱처럼 쓸 수 있고, 데이터도 더 안전하게 보관됩니다.

키보드: 위젯 선택 후 화살표(이동), Alt+화살표(크기), Delete(삭제)

## 개인정보

- 보드·명단 등 모든 데이터는 **사용 중인 브라우저(localStorage)에만** 저장되며 어떤 서버로도 전송되지 않습니다.
- 브라우저 데이터를 지우거나 다른 기기로 옮길 때는 **보드 메뉴 → 백업 → 전체 내보내기**로 파일을 저장해 두세요.
- 내보낸 파일에는 랜덤 뽑기·모둠 편성 명단(학생 이름 등)이 들어 있으니 공유할 때 주의하세요.

## 문서

| 문서 | 설명 |
|---|---|
| [문서 인덱스](docs/README.md) | 문서 작성 규칙과 전체 목록 |
| [PRD](docs/prd/PRD.md) | 제품 요구사항 |
| [TRD](docs/trd/TRD.md) | 기술 요구사항 |
| [데이터 스키마](docs/trd/data-schema.md) | 보드·위젯·내보내기 JSON 구조 |
| [로드맵](docs/roadmap/ROADMAP.md) | 단계별 마일스톤 |
| [릴리스 노트](docs/releases/v0.1.0.md) | v0.1.0 |
| [개발 로그](docs/devlog/) | 날짜별 작업 기록 |
| [벤치마킹](docs/research/benchmark-classroomscreen.md) | 참고 서비스 분석 |

## 로컬 실행

ES Modules·Service Worker는 `file://`에서 동작하지 않으므로 정적 서버가 필요합니다.

```bash
python -m http.server 8765 --bind 127.0.0.1
```

> 개발 중에는 Service Worker가 이전 파일을 캐시에서 내줄 수 있습니다. 파일을 바꾼 뒤 `node tools/sw-stamp.mjs`를 실행하면 화면에 "새 버전" 알림이 뜨고, DevTools → Application → Service Workers → "Update on reload"를 켜 두면 편합니다.

## 테스트

Node.js 20 이상이 필요합니다. 설치할 패키지는 없습니다.

```bash
node --test                      # 단위 테스트
node tools/sw-stamp.mjs          # 앱 파일을 바꾼 뒤 (오프라인 캐시 목록·버전 갱신, 잊으면 테스트 실패)
node tools/e2e/m1.mjs            # 브라우저 E2E (서버 실행 후, Edge/Chrome 필요) — m1·m2·m3
```

## 라이선스

[MIT](LICENSE) — [ADR-0005](docs/trd/adr/ADR-0005-license.md)
