# 데이터 스키마

| status | version | updated | owner |
|---|---|---|---|
| draft | 0.2 | 2026-11-05 | @owner |

현재 스키마 버전: **1**

## 1. 내보내기 파일 (`*.classboardkit.json`)

```json
{
  "app": "classboardkit",
  "schemaVersion": 1,
  "exportedAt": "2026-11-04T09:00:00.000Z",
  "boards": [ /* Board[] */ ],
  "settings": { /* Settings, 전체 내보내기 시에만 */ }
}
```

- 파일명: `classboardkit-<보드 이름 slug | all>-YYYYMMDD.classboardkit.json` (금지 문자 `/:*?"<>|`·제어 문자 제거, 공백 → `-`, 최대 50자, 한글 허용, 날짜는 로컬 기준)
- 가져오기 제한: 5MB, 보드 1~200개. 처리 순서와 오류 코드(`too-large`·`not-json`·`wrong-app`·`newer-version`·`invalid`·`empty`)는 `src/core/transfer.js`
- 가져오기는 보드만 추가한다 (`settings`는 무시). 보드·위젯 ID는 새로 발급

## 2. Board

```json
{
  "id": "b_k3x9a2",
  "name": "월요일 1교시",
  "createdAt": "2026-11-04T09:00:00.000Z",
  "updatedAt": "2026-11-04T09:10:00.000Z",
  "background": { "type": "gradient", "value": "sunrise" },
  "widgets": [ /* Widget[] */ ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `background.type` | `"color" \| "gradient" \| "image"` | `image`는 Phase 2, `value`에 IndexedDB 키 |
| `background.value` | string | 색상 코드, 프리셋 키, 또는 이미지 키 |

## 3. Widget

```json
{
  "id": "w_8fj2l1",
  "type": "timer",
  "version": 1,
  "x": 0.05, "y": 0.10, "w": 0.25, "h": 0.30,
  "z": 3,
  "state": { }
}
```

- `x, y, w, h`: 캔버스 대비 비율 0~1 ([ADR-0004](adr/ADR-0004-relative-coordinates.md))
- `version`: 위젯별 state 스키마 버전 → 위젯의 `migrate()`가 처리

## 4. MVP 위젯 state

| type | state 필드 |
|---|---|
| `timer` | `durationMs`, `mode: "digital"\|"visual"`, `status: "idle"\|"running"\|"paused"\|"done"`, `endAt?` (running), `remainingMs?` (paused), `sound: boolean` |
| `stopwatch` | `status: "idle"\|"running"\|"paused"`, `startedAt?` (running), `elapsedMs`, `laps: number[]` (각 랩 시점 누적 ms, 최대 99) |
| `clock` | `style: "digital"\|"analog"`, `hour12: boolean`, `showSeconds: boolean`, `showDate: boolean` |
| `randomizer` | `items: string[]` (최대 200, 각 60자, 중복 없음), `excludePicked: boolean`, `picked: string[]`, `history: {value, at}[]` (최신순, 최대 50) |
| `groups` | `items: string[]`, `by: "count"\|"size"`, `n: number` (1~20), `result: string[][]` (명단·규칙 변경 시 비움) |
| `scoreboard` | `teams: {id, name, color, score}[]` (2~8팀, `name` 빈 값 = 언어별 기본 "n팀", `color` ∈ red·blue·green·orange·purple·teal·pink·yellow, `score` -999~9999) |
| `traffic` | `light: "red"\|"yellow"\|"green"`, `labels: {red, yellow, green}` (빈 값 = 언어별 기본 문구, 각 40자) |
| `text` | `content` (최대 2000자), `size: "s"\|"m"\|"l"\|"xl"`, `align: "left"\|"center"\|"right"`, `color?: "default"\|"red"\|"blue"\|"green"\|"orange"\|"purple"` (M2 추가, 없으면 default) |

> 선택 필드를 **추가**하고 없을 때 기본값으로 읽을 수 있으면 위젯 `version`을 올리지 않는다 (예: `text.color`). 기존 필드의 의미·형식이 바뀌면 `version`을 올리고 `migrate`를 구현한다.

> `randomizer.items`와 `groups.items`는 학생 이름 등 개인정보일 수 있음 → URL 공유(F-012) 시 제외 옵션 기본 ON

## 5. Settings

```json
{ "locale": "ko", "theme": "system", "dockCollapsed": false, "activeBoardId": "b_k3x9a2",
  "lastExportAt": "2026-11-05T09:00:00.000Z", "keepAwake": true }
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `lastExportAt?` | ISO 문자열 | 마지막 내보내기 시각 (M3 추가, 선택). 보드 메뉴 "마지막 백업" 표시용 |
| `keepAwake?` | boolean | 화면 켜두기 사용 여부 (M3 추가, 선택). 다음 실행 시 재요청 |

> 선택 필드 추가이므로 `schemaVersion`은 1 그대로다 (없으면 기본값으로 읽음).

## 6. localStorage 키

| 키 | 값 |
|---|---|
| `classboardkit:v1:boards` | `Board[]` |
| `classboardkit:settings` | `Settings` |

## 7. 마이그레이션 규칙
- `schemaVersion` 증가 시 `core/schema.js`에 `migrations[n] = (data) => data'` 추가 (n → n+1)
- 로드 시 순차 적용 → 성공 후 새 키에 저장, 구 키는 1개 버전 동안 보존
- 가져오기 파일도 동일 경로로 마이그레이션
- 모든 마이그레이션은 단위 테스트 필수
- 변경 시 이 문서의 버전과 변경 이력 갱신

## 8. 변경 이력

| 스키마 | 날짜 | 내용 |
|---|---|---|
| 1 | 2026-11-04 | 최초 정의 |
| 1 | 2026-11-05 | Settings 선택 필드 `lastExportAt`·`keepAwake` 추가 (버전 유지), 내보내기 파일명·가져오기 규칙 명시 |
