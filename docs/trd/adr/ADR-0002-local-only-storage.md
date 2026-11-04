# ADR-0002: 로컬 전용 저장 (서버·계정 없음)

- 상태: **Accepted**
- 날짜: 2026-11-04

## 배경
학생 기기 참여 기능이 없고, 사용자가 로컬 저장을 선택했다. 학생 이름 등 개인정보를 외부로 보내지 않는 것이 신뢰 측면의 차별점이다.

## 선택지
1. localStorage / IndexedDB + JSON 파일 내보내기/가져오기
2. Firebase/Supabase 등 BaaS + 계정
3. GitHub Gist API 동기화

## 결정
1번. 보드·설정은 localStorage, 대용량 바이너리(이미지)는 Phase 2에서 IndexedDB.

## 결과
- 장점: 서버 비용·운영 0, 개인정보 외부 전송 0, 오프라인 완전 동작
- 단점: 기기 간 자동 동기화 불가, 브라우저 데이터 삭제 시 유실 위험, localStorage 용량 제한(약 5MB 수준 [추정, 브라우저별 상이])
- 보완: 내보내기/가져오기를 1급 기능으로 제공, 마지막 백업 이후 경과 일수 표시, `navigator.storage.persist()` 요청, PWA 설치 안내
