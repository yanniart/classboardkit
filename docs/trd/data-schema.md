# 데이터 스키마

| status | version | updated | owner |
|---|---|---|---|
| v1 | 1.0 | 2026-11-11 | @owner |

현재 스키마 버전: **1**

> **v1 공개 계약** ([ADR-0011](adr/ADR-0011-v1-public-contract.md)): 내보내기 형식(§1~§5), 공유 링크 `1.`(§1.1), 저장 키(§6)는 v1.x 동안 하위 호환. 변경은 선택 필드 추가만 (§7·§8에 기록)

## 1. 내보내기 파일 (`*.classboardkit.json`)

```json
{
  "app": "classboardkit",
  "schemaVersion": 1,
  "exportedAt": "2026-11-04T09:00:00.000Z",
  "boards": [ /* Board[] */ ],
  "settings": { /* Settings, 전체 내보내기 시에만 */ },
  "assets": {                       /* 선택 (M4): 보드가 참조하는 이미지만 */
    "a_2cf24dba5fb0a30e": { "type": "image/webp", "width": 2048, "height": 1365, "tone": "light", "data": "<base64>" }
  }
}
```

- 파일명: `classboardkit-<보드 이름 slug | all>-YYYYMMDD.classboardkit.json` (금지 문자 `/:*?"<>|`·제어 문자 제거, 공백 → `-`, 최대 50자, 한글 허용, 날짜는 로컬 기준)
- 가져오기 제한: **30MB**(M4, 이미지 포함 때문에 5MB에서 상향), 보드 1~200개, 이미지 하나 10MB. 처리 순서와 오류 코드(`too-large`·`not-json`·`wrong-app`·`newer-version`·`invalid`·`empty`)는 `src/core/transfer.js`
- 가져오기는 보드만 추가한다 (`settings`는 무시). 보드·위젯 ID는 새로 발급, **이미지 ID는 내용 해시라 그대로**
- `assets` (M4, 선택 필드 → `schemaVersion` 1 유지): 키 = 이미지 ID, `type` ∈ png·jpeg·webp·gif, `width`·`height` 1~16384, `tone?`, `data` = base64
  - 가져오기: 형식 검사 → 가져오는 보드가 참조하는 것만 → **내용 해시 = ID 확인**(불일치 시 `invalid`, 전체 취소) → IndexedDB 저장 → 보드 반영
  - 참조되지 않은 항목은 무시. v0.1.0 앱은 `assets`를 모르므로 보드만 가져오고 이미지는 "찾을 수 없음"으로 표시됨

### 1.1 공유 링크 (M5, ADR-0008) — 저장 스키마 변화 없음

```
<앱 주소>#share=1.<base64url( deflate-raw( JSON ) )>
```

- JSON = 위 내보내기 형식에 **보드 1개**, `settings`·`assets` 없음. `1.`은 공유 형식 버전 (더 높으면 "새 버전" 안내)
- 만들 때 바꾸는 것: 이미지 위젯 `state.assetId` → `null`, 이미지 배경 → `{ type: 'gradient', value: 'default' }`, "명단 제외"(기본 켬)면 `randomizer`의 `items·picked·history`, `groups`의 `items·result` → `[]`
- 제한: 링크 전체 32,000자(넘으면 파일 내보내기 안내), 압축 해제 결과 1MB, QR은 2,000자 이하일 때만
- 받는 쪽은 `parseImport` 경로 그대로 (검증·마이그레이션·새 ID), 확인 후 새 보드로 추가
- 실행 취소 기록(M5)은 저장하지 않는다 (세션 메모리)

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
| `background.type` | `"color" \| "gradient" \| "image"` | `image`는 M4 (F-007): `value` = 이미지 ID |
| `background.value` | string | 색상 코드, 프리셋 키, 또는 이미지 ID (`a_` + 16진수 16자, [ADR-0007](adr/ADR-0007-indexeddb-image-assets.md)) |
| `widgetStyle?` | `{ look: "solid"\|"glass"\|"outline", accent: "default"\|"blue"\|"green"\|"orange"\|"red"\|"purple"\|"teal" }` | 선택 (M6): 보드의 위젯 모양. 없으면 `solid`·`default` — 기본값으로 되돌리면 필드를 지운다. 내보내기·공유 링크·복제에 그대로 |

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

## 4. 위젯 state

| type | state 필드 |
|---|---|
| `timer` | `durationMs`, `mode: "digital"\|"visual"`, `status: "idle"\|"running"\|"paused"\|"done"`, `endAt?` (running), `remainingMs?` (paused), `sound: boolean` |
| `stopwatch` | `status: "idle"\|"running"\|"paused"`, `startedAt?` (running), `elapsedMs`, `laps: number[]` (각 랩 시점 누적 ms, 최대 99) |
| `clock` | `style: "digital"\|"analog"`, `hour12: boolean`, `showSeconds: boolean`, `showDate: boolean` |
| `randomizer` | `items: string[]` (최대 200, 각 60자, 중복 없음), `excludePicked: boolean`, `picked: string[]`, `history: {value, at}[]` (최신순, 최대 50) |
| `groups` | `items: string[]`, `by: "count"\|"size"`, `n: number` (1~20), `result: string[][]` (명단·규칙 변경 시 비움) |
| `scoreboard` | `teams: {id, name, color, score}[]` (2~8팀, `name` 빈 값 = 언어별 기본 "n팀", `color` ∈ red·blue·green·orange·purple·teal·pink·yellow, `score` -999~9999) |
| `traffic` | `light: "red"\|"yellow"\|"green"`, `labels: {red, yellow, green}` (빈 값 = 언어별 기본 문구, 각 40자) |
| `symbols` (M6) | `symbol`: `quiet\|raise-hand\|listen\|solo\|pair\|group\|write\|read\|present\|think\|tidy\|break`, `label`: 문구 (빈 값 = 언어별 상징 이름, 40자). 다른 상징을 고르면 `label`은 비움. 알 수 없는 상징은 `quiet`로 표시(데이터는 보존) |
| `text` | `content` (최대 2000자), `size: "s"\|"m"\|"l"\|"xl"`, `align: "left"\|"center"\|"right"`, `color?: "default"\|"red"\|"blue"\|"green"\|"orange"\|"purple"` (M2 추가, 없으면 default) |
| `dice` (M4) | `count` 1~6, `values: number[]` (마지막 결과, 각 1~6, 굴리기 전·개수 변경 후 빈 배열), `sides: 6` |
| `countdown` (M4) | `title` (최대 60자, 빈 값 = 언어별 기본), `target: "YYYY-MM-DDTHH:mm"` (**시간대 없는 로컬 시각** — 기기 시간대가 바뀌어도 그 날 그 시각), `showSeconds: boolean` |
| `draw` (M4) | `strokes: {c, w, e?, p}[]`, `aspect: number\|null` (첫 획 때 영역 가로/세로 비, 비우면 null). `c` ∈ ink·red·blue·green·orange·purple, `w` ∈ s·m·l, `e: true` = 지우개 획, `p` = x,y 교대 정수 0~10000 (영역 비율 × 10000, RDP 단순화). 위젯당 점 **20,000개 상한** |
| `image` (M4) | `assetId: string\|null` (이미지 ID), `fit: "contain"\|"cover"`, `alt` (최대 120자) |
| `noise` (M4) | `threshold` 5~95, `sensitivity: "low"\|"mid"\|"high"`, `style: "bar"\|"face"` — **소리·측정값은 저장하지 않음** |
| `qr` (M4) | `text` (최대 500자), `caption` (최대 60자, 빈 값 = 주소를 짧게 표시), `ecc: "M"` |

> 이미지를 쓰는 위젯은 `state.assetId` **한 필드만** 쓴다 → 코어의 `referencedAssetIds`가 위젯 내부를 몰라도 백업·정리 대상을 찾을 수 있다 (ADR-0007).

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

IndexedDB (M4): DB `classboardkit`, 저장소 `assets` (keyPath `id`) — `{ id, type, blob, width, height, tone?, createdAt }`. 참조되지 않고 10분 지난 레코드는 앱 시작 시 정리 ([ADR-0007](adr/ADR-0007-indexeddb-image-assets.md))

## 7. 마이그레이션 규칙
- `schemaVersion` 증가 시 `core/schema.js`에 `migrations[n] = (data) => data'` 추가 (n → n+1)
- 로드 시 순차 적용 → 성공 후 새 키에 저장, 구 키는 1개 버전 동안 보존
- 가져오기 파일도 동일 경로로 마이그레이션
- 모든 마이그레이션은 단위 테스트 필수
- 변경 시 이 문서의 버전과 변경 이력 갱신

## 8. 변경 이력

| 스키마 | 날짜 | 내용 |
|---|---|---|
| 1 | 2026-11-11 (M7) | **v1 공개 계약으로 고정** (ADR-0011) — 형식 변화 없음 |
| 1 | 2026-11-04 | 최초 정의 |
| 1 | 2026-11-05 | Settings 선택 필드 `lastExportAt`·`keepAwake` 추가 (버전 유지), 내보내기 파일명·가져오기 규칙 명시 |
| 1 | 2026-11-09 (M6) | 위젯 `symbols` state, Board 선택 필드 `widgetStyle` 추가 (버전 유지 — 이전 앱은 필드를 무시) |
| 1 | 2026-11-09 (M5) | 공유 링크 형식(§1.1) 추가 — 내보내기 형식 재사용, 저장 스키마·버전 변화 없음 |
| 1 | 2026-11-05 (M4) | 위젯 6종 state(dice·countdown·draw·image·noise·qr), 배경 `image`, 내보내기 `assets` 선택 필드, 가져오기 한도 30MB, IndexedDB 저장소 (버전 유지) |
