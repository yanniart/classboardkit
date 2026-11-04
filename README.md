# ClassBoardKit

> 설치·로그인 없이 브라우저에서 바로 쓰는 오프라인 우선 교실 위젯 보드

ClassBoardKit은 노트북·태블릿 화면을 수업용 대시보드로 바꿔 주는 웹 서비스입니다.
타이머, 랜덤 뽑기, 모둠 편성, 점수판 같은 위젯을 자유롭게 배치하고, 모든 데이터는 사용자의 브라우저에만 저장됩니다.

- **누구나, 제한 없이**: 계정·결제·기능 제한 없음
- **서버 없음**: GitHub Pages 정적 호스팅, 데이터 외부 전송 없음
- **빌드 없음**: HTML · CSS · Vanilla JavaScript(ES Modules)
- **다국어**: 한국어 · 영어 (MVP)

## 현재 상태

🚧 **M2 완료** — 위젯 8종(타이머·스톱워치·시계·랜덤 뽑기·모둠 편성·점수판·신호등·텍스트) (2026-11-04 기준)

## 문서

| 문서 | 설명 |
|---|---|
| [문서 인덱스](docs/README.md) | 문서 작성 규칙과 전체 목록 |
| [PRD](docs/prd/PRD.md) | 제품 요구사항 |
| [TRD](docs/trd/TRD.md) | 기술 요구사항 |
| [데이터 스키마](docs/trd/data-schema.md) | 보드·위젯 JSON 구조 |
| [로드맵](docs/roadmap/ROADMAP.md) | 단계별 마일스톤 |
| [개발 로그](docs/devlog/) | 날짜별 작업 기록 |
| [벤치마킹](docs/research/benchmark-classroomscreen.md) | 참고 서비스 분석 |

## 로컬 실행

ES Modules는 `file://`에서 동작하지 않으므로 정적 서버가 필요합니다.

```bash
# 둘 중 하나
python -m http.server 8080
npx serve .
```

## 라이선스

[MIT](LICENSE) — [ADR-0005](docs/trd/adr/ADR-0005-license.md)

## 테스트

Node.js 20 이상이 필요합니다. 설치할 패키지는 없습니다.

```bash
node --test
```
