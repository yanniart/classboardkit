# ClassBoardKit 문서 인덱스

## 1. 문서 목록

| 구분 | 경로 | 목적 | 갱신 시점 |
|---|---|---|---|
| 벤치마킹 | `research/benchmark-classroomscreen.md` | 참고 서비스 분석, 차별화 근거 | 필요 시 |
| PRD | `prd/PRD.md` | 무엇을·누구를 위해·왜 만드는가 | 범위 변경 시 |
| 기능 상세 | `prd/features/F-xxx-*.md` | 복잡한 기능의 상세 요구사항 | 기능 착수 전 |
| TRD | `trd/TRD.md` | 어떻게 구현하는가 | 아키텍처 변경 시 |
| 데이터 스키마 | `trd/data-schema.md` | 저장·내보내기 JSON 구조 | 스키마 변경 시 (버전 업) |
| ADR | `trd/adr/ADR-xxxx-*.md` | 중요한 기술 결정 기록 | 결정 시 (불변, 대체만 가능) |
| 로드맵 | `roadmap/ROADMAP.md` | 단계·마일스톤·순서 | 마일스톤 완료/변경 시 |
| 마일스톤 계획 | `roadmap/Mn-plan.md` | 마일스톤 실행 순서·완료 기준 (M3~M7) | 착수 전 |
| 기여 가이드 | `guides/new-widget(.ko).md`·`guides/translation(.ko).md`, `../CONTRIBUTING(.ko).md` | 외부 기여자용 (영어 원문 + 한국어, M7 D4) | 계약·도구 변경 시 |
| 릴리스 노트 | `releases/vX.Y.Z.md` | 버전별 사용자 안내 (GitHub Release 본문) | 릴리스 시 |
| QA 체크리스트 | `trd/qa-checklist.md` | 기기별 수동 점검 항목 | 마일스톤마다 |
| 작업 안내 | `../CLAUDE.md` | 환경·명령·규칙·현재 상태 (세션 인계용) | 마일스톤마다 |
| E2E | `../tools/e2e/README.md` | 브라우저 자동 검증 실행법 | 시나리오 추가 시 |
| 개발 로그 | `devlog/YYYY/YYYY-MM-DD.md` | 작업일별 기록 | 작업일마다 |
| 템플릿 | `templates/` | 위 문서들의 작성 양식 | — |

## 2. 공통 규칙

### 2.1 메타데이터
모든 문서 상단에 아래 표를 둡니다 (개발 로그 제외).

```markdown
| status | version | updated | owner |
|---|---|---|---|
| draft | 0.1 | 2026-11-04 | @owner |
```

- `status`: `draft` → `review` → `approved` → `deprecated`
- `version`: 범위·내용이 바뀌면 minor(0.1→0.2), 승인 시 1.0

### 2.2 ID 체계

| 접두어 | 의미 | 예 | 정의 위치 |
|---|---|---|---|
| `F-0xx` | 플랫폼(공통) 기능 | `F-001` 보드 캔버스 | PRD |
| `F-1xx` | 위젯 | `F-101` 타이머 | PRD |
| `NFR-0xx` | 비기능 요구사항 | `NFR-002` 터치 지원 | PRD |
| `ADR-xxxx` | 기술 결정 | `ADR-0001` | TRD/adr |
| `M0`~`Mn` | 마일스톤 | `M1` 캔버스 | ROADMAP |

### 2.3 추적성 (Traceability)

```
PRD F-101 ──▶ TRD 모듈 / ADR ──▶ GitHub Issue (#12, label prd:F-101)
         ──▶ PR ("Closes #12", 본문에 F-101) ──▶ devlog 기록 ──▶ CHANGELOG
```

### 2.4 GitHub 연동
- **Labels**: `type:feature` `type:bug` `type:docs` `type:chore` / `area:core` `area:widget` `area:ui` `area:i18n` / `prd:F-xxx`
- **Milestones**: ROADMAP의 `M0`~`Mn`과 1:1 (제목 = "M7 생태계"처럼 번호 + 이름, 완료된 마일스톤은 닫음)
- 라벨·마일스톤은 2026-11-10 `gh`로 생성. `prd:F-xxx` 라벨은 이슈를 만들 때 필요한 것만 추가
- **Projects**: (보류 — 1인 개발, `project` 토큰 권한 필요) Backlog → Ready → In progress → Review → Done
- 문서 변경 커밋은 `docs:` 접두어 (Conventional Commits)

### 2.5 정보 신뢰도 표기
외부 정보나 미검증 내용은 다음 태그로 구분합니다.
- **[확인]** 출처에서 직접 확인 / **[추정]** 추론, 검증 필요 / **[검토]** 개발 전 검증해야 할 항목
