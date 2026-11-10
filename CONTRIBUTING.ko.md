# ClassBoardKit에 기여하기

[English](CONTRIBUTING.md) · **한국어**

선생님들을 도와주셔서 고맙습니다! ClassBoardKit은 1인이 유지하는 작은 프로젝트라, 어떤 변경이 잘 맞는지와 빨리 병합되는 방법을 정리해 둡니다.

## 도울 수 있는 일

- **버그 신고** — "Bug / 버그" 이슈 양식. 브라우저·기기, 기대한 동작을 적어 주세요.
- **번역 개선** — "Translation / 번역" 이슈 양식(어떤 언어로 써도 됨) 또는 PR → [번역 가이드](docs/guides/translation.ko.md)
- **위젯 추가** — 먼저 "Feature / 기능" 이슈로 아이디어를 맞춘 뒤 [새 위젯 가이드](docs/guides/new-widget.ko.md)
- **보안 문제** — 공개 이슈 대신 → [SECURITY.md](SECURITY.md)

## 원칙 (어기는 변경은 병합하지 않습니다)

| 원칙 | 이유 |
|---|---|
| **빌드 없음** — HTML·CSS·JavaScript ES Modules 그대로 | 누구나 읽고 실행할 수 있고, GitHub Pages가 저장소를 그대로 배포 |
| **런타임 의존성 0** — 외부 라이브러리는 ADR + 원본 그대로 벤더링 | 오프라인 동작, 감사·갱신할 것이 없음 |
| **서버·계정·추적 없음** — 데이터는 브라우저에만 | 학생 데이터가 교실 기기를 떠나지 않음 |
| **학생 기기 참여 없음** — 보드는 교사 화면에 | 서버 없이, 개인정보 안전하게 |
| **누구나 무료, 제한 없음** | 상품 등급이 아닌 공공재 |
| **접근성** — 키보드·화면 낭독기·대비 | 교실에는 모두가 있음 |

v1 범위 밖: 오른쪽→왼쪽 언어, 번역 플랫폼, URL로 위젯 불러오기.

## 개발 환경

브라우저, **Python 3**(정적 서버), **Node.js 20+**(테스트·도구)가 필요합니다. npm으로 설치할 것은 없습니다.

```bash
git clone https://github.com/yanniart/classboardkit.git
cd classboardkit
python -m http.server 8765 --bind 127.0.0.1   # http://127.0.0.1:8765/ 열기
```

서비스 워커가 앱을 캐시합니다. 앱 파일(`index.html`·`manifest.webmanifest`·`src/`·`assets/`)을 바꾼 뒤에는:

```bash
node tools/sw-stamp.mjs
```

## 테스트

| 명령 | 검사 |
|---|---|
| `node --test` | 단위 테스트(순수 로직·위젯 계약·번역·오프라인 캐시 목록) — **통과 필수** |
| `node tools/i18n-check.mjs` | 모든 언어에 모든 키, `{자리표시자}`·복수형 일치 — **통과 필수** (CI에서도 실행) |
| `node tools/e2e/m1.mjs` … `m7.mjs` | 실제 브라우저에서 마우스·터치·키보드 (8765 서버, Edge/Chrome 필요). 변경과 관련된 것을 실행 |
| `node tools/e2e/a11y-audit.mjs` | 40개 화면 상태 접근성 표 (개발 전용 axe-core를 `.tools/axe/`에, [ADR-0010](docs/trd/adr/ADR-0010-dev-accessibility-testing.md)) |

E2E는 `console.warn`도 오류로 셉니다 — 예상된 실패는 `console.info`로.

## 변경 만들기

1. 포크 → 브랜치 (`fix/timer-sound`, `widget/exit-ticket`, `i18n/es-wording`)
2. 변경은 한 가지에 집중. 기존 스타일(들여쓰기 2칸, 작은따옴표, JSDoc 타입)을 따릅니다. 코드 주석은 영어·한국어 모두 괜찮습니다.
3. 화면에 보이는 새 문구는 `src/locales/`의 **모든** 파일에 — [번역 가이드](docs/guides/translation.ko.md). 번역할 수 없으면 영어를 복사해 두세요. `i18n-check`가 번역할 곳으로 표시합니다.
4. 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/ko/): `feat:`·`fix:`·`docs:`·`chore:`·`test:`
5. PR을 열고 체크리스트를 채웁니다.

### 호환을 지키는 것

v1은 네 가지를 호환합니다: 백업 파일 형식, 공유 링크, 저장 키, 위젯 계약 ([ADR-0011](docs/trd/adr/ADR-0011-v1-public-contract.md)). 이 중 하나를 깨는 PR은 아주 좋은 이유가 필요하고 v2를 기다립니다. 선택 필드·새 위젯 추가는 괜찮습니다.

## PR 체크리스트

- [ ] `node --test`, `node tools/i18n-check.mjs` 통과
- [ ] 마우스 **와** 터치(또는 터치 에뮬레이션), 키보드로 확인
- [ ] 새 버튼에 이름(보이는 글자 또는 `aria-label`), 결과 알림은 `liveRegion()` (바뀌는 글자에 `aria-live` 금지)
- [ ] 색은 기존 토큰(`--color-*`, `--team-*` / `--team-*-text`)
- [ ] 모든 언어에 문구 추가
- [ ] 앱 파일을 바꿨으면 `node tools/sw-stamp.mjs`
- [ ] 데이터 변경: `docs/trd/data-schema.md` + 마이그레이션 + 테스트
- [ ] 사용자에게 보이는 변경: `CHANGELOG.md` 한 줄

## 행동 강령

[Contributor Covenant 2.1](https://www.contributor-covenant.org/ko/version/2/1/code_of_conduct/)을 따릅니다. 친절하게, 선의를 전제로. 공개적으로 말하기 어려운 문제는 비공개 [보안 권고](https://github.com/yanniart/classboardkit/security/advisories/new)로 관리자에게 알려 주세요.

## 라이선스

기여한 내용은 [MIT 라이선스](LICENSE)로 배포되는 데 동의한 것으로 봅니다.
