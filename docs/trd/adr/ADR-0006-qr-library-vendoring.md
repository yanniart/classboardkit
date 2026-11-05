# ADR-0006: QR 코드 생성은 Nayuki 라이브러리를 벤더링한다

- 상태: Accepted
- 날짜: 2026-11-05

## 배경
- F-109 QR 코드 위젯은 오프라인에서 URL·글을 QR로 보여 줘야 한다.
- QR 인코딩(Reed–Solomon 오류 정정, 버전·마스크 선택)은 틀려도 화면에는 그럴듯한 그림이 나와 **스캔 실패가 조용히 생기는** 영역이다.
- 제약: 런타임 외부 라이브러리 0, 도입하려면 ADR + 벤더링(ADR-0001 빌드 없음, CDN 금지 — NFR-007 외부 요청 없음).
- M4 계획 D1에서 "MIT 라이브러리 벤더링"으로 사용자 확정 (2026-11-05).

## 선택지
1. **Project Nayuki "QR Code generator library" 벤더링** (MIT) — 여러 언어판, 정확성 검증으로 널리 쓰임
   - 1-a. 최신 v1.8.0 — JS판이 TypeScript(`qrcodegen.ts`, `namespace` 사용)로만 제공 → 컴파일 필요 (빌드 단계 또는 일회성 `tsc` 실행 + 결과물 커밋)
   - 1-b. **v1.4.0 `javascript/qrcodegen.js`** — 컴파일 없이 쓰는 마지막 공식 순수 JS판 (2018-11, 1,046줄, 전역 `qrcodegen`)
2. 직접 구현 — 약 600~800줄, 표준(ISO/IEC 18004) 표 데이터와 검증 부담
3. 다른 npm 라이브러리 — 번들러 전제, 의존성 트리 확인 부담

## 결정
**1-b. Nayuki v1.4.0 순수 JS판을 원본 그대로 `src/vendor/qrcodegen.js`에 둔다.**
- 출처: https://raw.githubusercontent.com/nayuki/QR-Code-generator/v1.4.0/javascript/qrcodegen.js
- SHA-256: `ab26696516e396e0de674612e5a0869b92b2d0b8baddf000594705e49c721bfa` (`tests/qr.test.js`가 검사 → 수정 금지)
- 라이선스: MIT (파일 머리 주석에 저작권·허가 문구 포함) → README "서드파티" 절에 고지
- 로드: ES 모듈이 아닌 일반 스크립트라 `src/widgets/qr/qr-loader.js`가 QR 위젯을 처음 그릴 때만 `<script>`로 불러온다 (CSP `script-src 'self'` 범위). 첫 로드 크기 영향 없음, 서비스 워커 precache에는 포함 → 오프라인 동작
- 사용 API: `QrCode.encodeText(text, Ecc.MEDIUM)`, `size`, `getModule(x, y)`. SVG는 앱이 직접 만든다(`qr-logic.js` `qrPath`, 여백 4모듈, 흰 바탕 고정)
- 1-a를 고르지 않은 이유: 빌드 단계 금지(ADR-0001), 일회성 컴파일도 결과물 검증·갱신 절차가 늘어남. QR 표준은 바뀌지 않았고 위젯이 쓰는 기능(텍스트 → 행렬)은 v1.4.0에 모두 있음

## 결과
- 장점: 검증된 인코더, 원본 불변(해시 테스트), 오프라인, 지연 로드
- 단점: 2018년 판 (이후 판의 개선 — TypeScript화, 일부 API 정리 — 은 받지 않음). 전역 변수 1개(`window.qrcodegen`)
- 테스트: 알려진 값(“Hello, world!” → 버전 1·21×21, 15바이트 → 버전 2, 숫자 34자리 → 버전 1), 파인더 패턴, path가 어두운 모듈과 정확히 일치, 500자 처리, 입력 한도 초과
- 실기기 스캔: E2E에서 `BarcodeDetector`는 Windows Edge 미지원이라 자동 판독 검증은 못 함 → QA 체크리스트 9절 수동 스캔 [검토]
- **갱신 절차**: 새 판을 쓰려면 이 ADR을 고쳐(버전·출처·해시) 원본 파일을 교체하고 `tests/qr.test.js`의 해시를 갱신, `tools/sw-stamp.mjs` 실행 → 단위·E2E 통과 확인
