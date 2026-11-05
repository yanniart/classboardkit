# M4 실행 계획: 위젯 확장 (v0.2.0)

| status | version | updated | owner |
|---|---|---|---|
| ready | 1.0 | 2026-11-05 | @owner |

> "m4 진행해줘"라고 하면 **추가 확인 없이** 1절부터 이 문서 순서대로 바로 진행한다 (0절 결정은 2026-11-05 사용자 확정).
> 범위: F-113 주사위, F-114 이벤트 카운트다운, F-111 그리기, F-112 이미지, F-007 사용자 이미지 배경, F-110 소음 측정기, F-109 QR 코드 + IndexedDB 도입.
> 기간: 약 3주 (ROADMAP 추정). 결과 버전: **v0.2.0**.

## 0. 결정 사항 (2026-11-05 사용자 확정: 권장안 전부 채택)

| # | 결정 | **확정** | 대안(기각) | 이유 |
|---|---|---|---|---|
| D1 | QR 생성 방법 | **MIT 라이브러리 벤더링** (Project Nayuki "QR Code generator" JS판, `src/vendor/`) + ADR-0006 | 직접 구현 | QR 인코딩(Reed–Solomon·마스크 선택)은 오류 시 스캔 실패가 조용히 나는 영역. 검증된 코드가 안전. 라이선스·최신 버전은 착수 시 확인 [검토] |
| D2 | 내보내기에 이미지 포함 | **포함** (`assets` 필드에 base64, 가져오기 한도 5MB → 30MB) | 제외 (보드만, 이미지는 "찾을 수 없음" 표시) | 다른 기기로 옮길 때 이미지가 사라지면 백업 의미가 약함 |
| D3 | 그리기 저장 방식 | **벡터(획 좌표)를 위젯 state에 저장**, 단순화 + 상한 | PNG를 IndexedDB에 저장 | 크기 조절 시 선명, 내보내기·복제에 그대로 포함. 상한으로 localStorage 5MB 보호 |
| D4 | 작업 브랜치 | **`m4` 브랜치에서 작업 → 완료 시 `main` 병합** | `main`에 바로 커밋 | `main` 푸시 = 즉시 배포. 반쯤 된 위젯이 사용자에게 나가지 않게. 브랜치 푸시는 CI(`node --test`)만 실행 |

> 바꾸려면 사용자가 먼저 말한다. 그 전까지는 이 표대로 진행한다.
> 진행 중 계획에 없는 선택이 생기면 권장안을 골라 진행하고 개발 로그 "결정 사항"에 기록한다 (사용자는 권장안 위임을 선호).

## 1. 시작 전 확인

```bash
cd C:/dev/boardkit
git switch -c m4                         # D4 (원격에 올릴 때: git push -u origin m4)
.tools/node/node.exe --test              # 128개
python -m http.server 8765 --bind 127.0.0.1   # 백그라운드
.tools/node/node.exe tools/e2e/m1.mjs    # 34 / m2 36 / m3 44
```

## 2. 공통 규칙 (M4 전체)

- 새 위젯 = `src/widgets/<type>/` (index.js + css + 순수 로직 `*-logic.js`) + `widgets/index.js` 배열 1줄 + 아이콘(`assets/icons.svg`) + ko/en 문구
- 독 순서(안): 타이머·스톱워치·시계·**카운트다운**·랜덤 뽑기·**주사위**·모둠 편성·점수판·신호등·**소음**·텍스트·**그리기**·**이미지**·**QR** (시간 → 무작위 → 진행 → 표시)
- 앱 파일을 바꾸면 `tools/sw-stamp.mjs` (잊으면 테스트 실패)
- 난수는 `core/utils/random.js`만, 움직임 연출은 `prefers-reduced-motion` 존중
- 위젯 state 형식은 data-schema §4에 추가, 위젯 `version`은 1부터
- 원거리 가독성: 기본 크기에서 핵심 숫자·글자 18px 이상 (스크린샷으로 확인)

## 3. 작업 순서

위험이 낮은 것 → 저장 기반(IndexedDB) → 권한·외부 코드가 필요한 것 순서.

### 3-0. 기반 정리 (0.5일)
- 독 14개: 현재 `.dock__items`는 가로 스크롤 → 768px 폭에서 스크롤 가능함이 보이도록 양 끝 그림자(fade) 추가, 키보드로 스크롤 시 포커스 항목이 보이는지 확인
- E2E 하네스 `launch({ args })`: 브라우저 추가 인자 지원 (3-8 소음 측정기용 `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`)
- 아이콘 6종 추가: `dice`, `hourglass`, `pen`, `image`, `mic`, `qr`

### 3-1. 주사위 F-113 (1일)
- state: `{ count: 1~6, values: number[] (각 1~6), sides: 6 }`
- `dice-logic.js`: `roll(count)` → `randomInt` 사용, 합계
- 화면: 주사위 면(점 배치, SVG 또는 CSS 그리드), 합계 표시(2개 이상일 때), 굴리기 버튼 / 위젯 탭으로도 굴리기, 짧은 흔들림 연출(움직임 줄이기 시 생략)
- 설정: 개수 1~6
- 테스트: 범위·개수, 6면 균등성(기존 random 테스트 방식)

### 3-2. 이벤트 카운트다운 F-114 (1일)
- state: `{ title: string(≤60), target: 'YYYY-MM-DDTHH:mm' (로컬 시각, 시간대 없음), showSeconds: boolean }`
  - 시간대 없이 저장 → 기기 시간대가 바뀌어도 "그 날 그 시각" 유지 (교실 행사 기준)
- `countdown-logic.js`: `remaining(target, now)` → `{ past, days, hours, minutes, seconds }`, D-day 문구(`D-3`, `D-Day`, `D+2`)
- 화면: 제목 + 큰 숫자(일 / 시:분(:초)), 지난 경우 "지났어요" 표시. 1일 이상 남으면 분 단위 갱신, 아니면 초 단위
- 설정: 제목, 날짜(`<input type="date">`), 시각(`<input type="time">`), 초 표시
- 테스트: 경계(정각, 자정, 윤년, 서머타임 전환일 [검토]), 지난 날짜

### 3-3. 그리기 F-111 (2~3일)
- state: `{ strokes: Stroke[], aspect: number }`, `Stroke = { c: 색키, w: 굵기키, e?: true(지우개), p: number[] }`
  - `p`: x,y 교대 정수 배열, 0~10000 (그리기 영역 비율 × 10000) → 소수 저장보다 JSON이 작음
  - `aspect`: 첫 획 때 영역 가로/세로 비. 크기가 바뀌면 **비율 유지(contain)** 로 그려 글씨가 늘어나지 않게
- `draw-logic.js` (순수): 점 단순화(Ramer–Douglas–Peucker, 허용 오차 약 0.2%), 좌표 양자화, 총 점 수 계산, 상한 확인
  - 상한: 위젯당 **점 20,000개** (약 150~250KB JSON) → 넘으면 새 획을 막고 "그리기 공간이 가득 찼어요" 안내
- 화면: `<canvas>` (devicePixelRatio 반영), Pointer Events로 그리기, `touch-action: none`, 획 끝날 때 한 번만 `setState`
  - 제목 막대 = 위젯 이동, 본문 = 그리기 (기존 캔버스 규칙과 일치)
  - 지우개는 획 단위 지우기가 아니라 `destination-out` 획 (벡터 유지)
- 도구 막대: 펜 색 6종, 굵기 3단계, 지우개, 마지막 획 취소(위젯 내부), 전체 지우기(확인 대화상자)
- 키보드: 그리기 자체는 포인터 전용 — 도구 막대·전체 지우기는 키보드 가능 (NFR-005 예외로 TRD에 기록)
- 테스트: RDP 단순화 결과, 양자화 왕복, 상한 판정 / E2E: 마우스·터치로 획 그리기 → 저장 → 새로고침 후 같은 픽셀 존재

### 3-4. IndexedDB 이미지 저장소 (2일) — ADR-0007
- **ADR-0007 "이미지는 IndexedDB에 저장"** 작성 (ADR-0002 로컬 전용 원칙 유지, localStorage 5MB 한계 때문에 바이너리만 분리)
- `core/assets.js` (저장소 주입형 → Node 테스트는 메모리 구현, 브라우저는 IndexedDB 구현 `ui/idb-assets.js` 또는 `core/utils/idb.js`)
  - DB `classboardkit`, store `assets`: `{ id, type, blob, width, height, createdAt }`
  - **ID = 내용 해시** (`a_` + SHA-256 앞 16자, `crypto.subtle.digest`) → 같은 이미지는 한 번만 저장, 가져오기를 여러 번 해도 중복 없음
  - API: `put(blob) → id`, `get(id) → Blob | null`, `delete(id)`, `listIds()`, `collectGarbage(referencedIds)`
- **참조 규칙 (코어가 위젯 내부를 몰라도 되도록)**: 이미지를 쓰는 위젯은 `state.assetId`(문자열) **한 필드만** 사용. 배경은 `background = { type: 'image', value: assetId }`
  - `referencedAssetIds(boards)` (순수 함수, 테스트 대상)
- 이미지 준비 `prepareImage(file)`: png/jpeg/webp/gif만 허용(svg 제외), `createImageBitmap` → 긴 변 2048px로 축소 → WebP(미지원 시 JPEG) 품질 0.85, 결과 2MB 초과 시 한 단계 더 축소
- 정리(GC): 앱 시작 시 저장 데이터를 읽은 뒤 참조되지 않는 이미지 삭제 (여러 탭 동시 사용 시 다른 탭의 새 이미지를 지우지 않도록 `createdAt` 10분 이내는 보존)
- IndexedDB 사용 불가(사생활 보호 모드 등) → 이미지 기능만 비활성 + 안내, 나머지는 정상
- 테스트: 해시 ID 동일성, 참조 수집, GC 보존 규칙, 축소 크기 계산

### 3-5. 이미지 위젯 F-112 (1일)
- state: `{ assetId: string | null, fit: 'contain' | 'cover', alt: string(≤120) }`
- 비어 있을 때: "이미지 선택" 버튼 + 위젯 위로 파일 끌어 놓기 + 붙여넣기(Ctrl+V, 위젯 포커스 시)
- 표시: `URL.createObjectURL(blob)` (CSP `img-src blob:` 이미 허용) → `destroy()`에서 `revokeObjectURL`
- 이미지가 저장소에 없으면 "이미지를 찾을 수 없어요" + 다시 선택
- 설정: 맞춤 방식, 대체 텍스트(스크린 리더), 이미지 바꾸기
- E2E: `DOM.setFileInputFiles`로 PNG 넣기 → 표시 → 새로고침 후 유지 → 위젯 삭제 후 재시작 시 GC로 삭제

### 3-6. 사용자 이미지 배경 F-007 (1일)
- 보드 메뉴 배경 견본 끝에 "내 이미지" (+) 견본 → 파일 선택 → `{ type: 'image', value: assetId }`
- `resolveBackground`: image 타입은 object URL + `cover`. 빈 보드 문구 색(밝기 tone)은 업로드 시 평균 밝기를 계산해 자산 레코드에 저장 → 렌더 시 사용
- 이미지 배경을 쓰는 보드가 여럿이어도 같은 해시면 한 번만 저장
- 고대비 테마에서는 기존 규칙대로 검정 고정

### 3-7. 내보내기/가져오기 확장 (1일) — D2
- 내보내기: 내보내는 보드가 참조하는 이미지만 `assets: { [id]: { type, data: base64 } }`로 포함
- 가져오기: `parseImport`가 `assets` 검증(크기·형식·ID = 내용 해시 일치) → 보드 반영 **전에** IndexedDB에 저장. 하나라도 실패하면 전체 취소
- `MAX_IMPORT_SIZE` 5MB → 30MB, `exportFileName` 그대로
- 스키마: 내보내기 파일에 **선택 필드 추가**이므로 `schemaVersion` 1 유지 (v0.1.0 앱은 `assets`를 무시하고 보드만 가져옴 → 이미지 "찾을 수 없음" 표시, data-schema에 명시)
- 테스트: 왕복(이미지 포함), 해시 불일치 거부, 참조 안 된 asset 무시

### 3-8. 소음 측정기 F-110 (2일)
- state: `{ threshold: 0~100, sensitivity: 'low'|'mid'|'high', style: 'bar'|'face' }` — **소리·측정값은 저장하지 않음**
- 시작은 사용자가 "측정 시작"을 눌렀을 때만 (권한 요청은 사용자 제스처에서). `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` → `AnalyserNode` RMS
- `noise-logic.js`: RMS → 0~100 레벨(로그 스케일 + 감도), 지수 평활, 임계값을 **1초 이상** 넘을 때만 경고(순간 소음 무시)
- 화면: 큰 막대(또는 얼굴 표정 3단계), 임계선, 경고 시 빨간 테두리 + "조금 조용히" — **소리로 경고하지 않음**(마이크 되먹임 방지)
- 마이크 정리: 위젯 `destroy()`(보드 전환·삭제·언어 변경), 탭 숨김 시 트랙 중지 → 다시 보이면 "측정 다시 시작" 버튼
- 오류 안내: 권한 거부, 마이크 없음, 보안 컨텍스트 아님 — 각각 문구
- 개인정보: 소리는 기기 안에서 레벨로만 변환되고 녹음·저장·전송되지 않음 → README·위젯 안내에 명시
- 테스트: 레벨 변환·평활·경고 지속 판정 / E2E: 가짜 마이크로 레벨 > 0, 위젯 삭제 시 트랙 종료(`readyState === 'ended'`)
- iPad Safari 동작은 실기기 확인 [검토]

### 3-9. QR 코드 F-109 (1.5일) — D1, ADR-0006
- ADR-0006 작성: 라이브러리·버전·라이선스·벤더링 위치, 갱신 방법, 대안 비교
- `src/vendor/qrcodegen.js` (원본 그대로 + 상단에 출처·버전·라이선스 주석), `LICENSE` 고지(README "서드파티" 절)
- 위젯 모듈에서 **동적 import** (QR 위젯을 쓸 때만 로드 → 첫 로드 크기 영향 없음, SW precache에는 포함)
- state: `{ text: string(≤500), caption: string(≤60), ecc: 'M' }`
- 화면: SVG(모듈 → path, 여백 4모듈, 흰 배경 고정 — 다크 테마에서도 스캔 가능하도록), 아래에 캡션 또는 URL 일부
- 텍스트가 너무 길어 생성 실패 시 안내
- 테스트: 라이브러리 원본 테스트 벡터 일부 + 버전/크기 계산, 빈 문자열 처리 / E2E: SVG 렌더·크기 비례 확인. 가능하면 Edge `BarcodeDetector`로 판독 검증 [검토]

### 3-10. 마무리·출시 (1.5일)
- 독 14개 레이아웃(데스크톱·태블릿 가로·세로 768px) 스크린샷 확인
- 성능: 위젯 20개(그리기 포함) 보드에서 드래그 끊김 확인(NFR-004), 첫 로드 전송량 측정(현재 gzip 78.6KB, 예산 200KB)
- Lighthouse 재측정 (로컬 + 배포 후)
- 문서: PRD(F-007·F-109~F-114 상태), TRD(이미지 저장소·참조 규칙·그리기 형식·소음 측정 개인정보), data-schema(위젯 6종 state, `assets`, 배경 image), ADR-0006·0007, QA 9절, devlog, CHANGELOG `[0.2.0]`, README(기능·스크린샷·서드파티 고지), 릴리스 노트 `docs/releases/v0.2.0.md`
- `package.json` 0.2.0, sw.js `VERSION` 0.2.0
- **사용자 승인 후**: `m4` → `main` 병합·푸시(=배포), 배포 URL에서 E2E·Lighthouse, `v0.2.0` 태그

## 4. E2E `tools/e2e/m4.mjs` (신규)
- 독 14개 순서, 768px 폭에서 마지막 항목까지 스크롤해 추가 가능
- 주사위: 3개 → 굴리기 5회 → 값 1~6, 합계 일치, 저장
- 카운트다운: 내일 09:00 설정 → `D-1`, 지난 날짜 → "지났어요"
- 그리기: 마우스 획 + 터치 획 → strokes 2개 저장, 새로고침 후 캔버스에 색 픽셀 존재, 지우개, 전체 지우기(취소/확인)
- 이미지: 파일 넣기 → 표시 → 새로고침 유지 → 맞춤 변경 → 위젯 삭제 후 재시작 시 IndexedDB에서 삭제
- 배경: 내 이미지 업로드 → 보드 배경 적용 → 다른 보드와 공유 시 저장 1개
- 내보내기/가져오기: 이미지 포함 파일 왕복(새 프로필이 아니라 IndexedDB 비운 뒤 가져오기), 해시 변조 파일 거부
- 소음: 가짜 마이크로 측정 시작 → 레벨 표시, 위젯 삭제 → 트랙 종료
- QR: 텍스트 입력 → SVG 생성, 긴 텍스트 오류 안내
- 오프라인: SW 설치 후 서버 종료 → QR(동적 import)·이미지 위젯 동작
- M1·M2·M3 회귀

## 5. 완료 기준 (DoD)
- [x] 0절 결정 사항 사용자 확인 (2026-11-05, 권장안 전부)
- [ ] 위젯 6종 + 사용자 배경 PRD 수용 기준 충족
- [ ] 단위 테스트 전부 통과 (신규: dice, countdown, draw, assets, noise, qr, transfer 확장)
- [ ] E2E m1·m2·m3·m4 전부 통과, 콘솔 오류 0
- [ ] 오프라인에서 새 위젯 전부 동작
- [ ] Lighthouse 각 90+, 첫 로드 gzip 200KB 이하
- [ ] ADR-0006(QR)·ADR-0007(IndexedDB) 작성
- [ ] 문서 갱신 (3-10 목록), v0.2.0 릴리스 노트
- [ ] 승인 후 병합·배포·태그

## 6. 리스크
| 리스크 | 영향 | 대응 |
|---|---|---|
| 그리기 데이터로 localStorage 5MB 초과 | 저장 실패 | 위젯당 점 20,000개 상한, 단순화, 기존 quota 알림 + 내보내기 권유 |
| IndexedDB 사용 불가·삭제 (사생활 보호 모드, Safari 정리 정책) | 이미지 사라짐 | 기능 감지 후 비활성, "찾을 수 없음" 표시, 내보내기에 이미지 포함(D2), 홈 화면 설치 권장 |
| 여러 탭에서 GC가 다른 탭의 새 이미지를 삭제 | 이미지 유실 | 10분 이내 생성 이미지는 GC 제외 |
| 소음 측정기 권한 거부·iPad 제약 | 기능 미동작 | 상황별 안내, 실기기 QA [검토] |
| 마이크가 계속 켜져 있음 | 개인정보 우려 | destroy·탭 숨김 시 트랙 중지를 E2E로 강제 확인 |
| QR 라이브러리 라이선스·유지보수 | 법적·보안 | ADR에 버전·출처 고정, 원본 수정 금지, 갱신 절차 기록 |
| 독 항목 14개로 태블릿에서 찾기 어려움 | 사용성 | 가로 스크롤 + fade 표시, M6에서 즐겨찾기/분류 검토 |
| 3주 일정 초과 | 출시 지연 | 3-8·3-9를 v0.2.1로 분리 가능 (독립 위젯이라 영향 없음) |
