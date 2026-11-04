# ADR-0001: 빌드 없는 Vanilla JavaScript(ES Modules) 채택

- 상태: **Accepted**
- 날짜: 2026-11-04

## 배경
1인 개발 포트폴리오 프로젝트이며, 장기 유지보수 부담과 기술 스택 복잡도를 최소화해야 한다. 사용자가 빌드 없는 구성을 명시적으로 선택했다.

## 선택지
1. Vanilla JS + ES Modules, 빌드 없음
2. Vite + Vanilla JS
3. React/Vue 등 프레임워크 + 번들러

## 결정
1번. 브라우저 네이티브 ES Modules를 그대로 GitHub Pages로 배포한다.

## 결과
- 장점: 소스 = 배포물, 의존성 업데이트 부담 없음, 코드 리뷰·학습 용이
- 단점: 모듈 요청 수 증가(HTTP/2로 완화), 압축·트리셰이킹 없음, TypeScript 미사용
- 보완: JSDoc 타입 주석, 모듈 수를 기능 단위로 적정하게 유지, 필요 시 `<link rel="modulepreload">`
- 로컬 개발 시 정적 서버 필요 (`file://`에서는 모듈 로드 불가)
