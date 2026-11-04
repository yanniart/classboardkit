# 벤치마킹: Classroomscreen

| status | version | updated | owner |
|---|---|---|---|
| approved | 1.0 | 2026-11-04 | @owner |

> 조사 범위: classroomscreen.com 메인, `/pricing`, `/widgets` 페이지 (2026-11-04 확인)
> 목적: 기능·UX 패턴 참고 및 차별화 근거 확보. **복제가 아닌 독립 서비스 기획**이 목표.

## 1. 서비스 개요

| 항목 | 내용 | 근거 |
|---|---|---|
| 핵심 메시지 | "Keep students focused on the one screen they should be focused on" | [확인] |
| 진입 | "no login required" | [확인] |
| 대상 | Pre-K·초등, 중, 고, 특수교육, 사서, 학교·교육청 | [확인] |
| 규모(자체 주장) | 교사 200만+, 일일 사용자 45만, 180+개국, 3,200+ 기관 | [확인] (미검증 수치) |
| 지원 언어 | 메인 페이지 미기재 | [검토] |

## 2. 위젯 26종 [확인]

| 분류 | 위젯 |
|---|---|
| 시간 | Timer, Visual timer, Stopwatch, Clock, Event countdown, Calendar, Timetable |
| 운영·행동 | Sound level, Traffic light, Work symbols, Group maker, Randomizer, Scoreboard, Dice |
| 콘텐츠 | Text, Image, Video, PDF, Embed, Hyperlink, QR Code, Webcam, Draw, Stickers, Backgrounds |
| 참여 | Poll (원격 투표) |

- 템플릿 카테고리, 게임(Tic Tac Toe, Hangman) 제공 [확인]

## 3. 요금 구조 [확인]

| 플랜 | 가격 | 내용 |
|---|---|---|
| Basic | 무료 | 위젯 26종 전체, 주석 바, 원격 투표, 이름 목록 3개, 위젯 바 레이아웃 저장, 템플릿 |
| Pro | $3/월 (연 $36) | 화면 저장·공유, 폴더, 커스텀 배경, 이름 목록 무제한, 위젯 테마, 30일 삭제 복구, 배경 캐러셀 |
| Organization | 라이선스 단위 | 재할당 가능 라이선스 (가격 표기 불명확 [검토]) |

**시사점**: 위젯 기능은 무료, **저장·공유·꾸미기(영속성)** 가 유료. → ClassBoardKit은 로컬 저장 + 파일 내보내기로 이 가치를 무료 제공.

## 4. UX 패턴 [추정 — 실제 화면 재확인 필요]
- 전체 화면 배경 위 위젯 카드 자유 배치(드래그)
- 하단 위젯 바에서 원클릭 추가
- 원거리 가독성 중심의 큰 숫자·고대비

## 5. ClassBoardKit 차별화 방향

| 영역 | Classroomscreen | ClassBoardKit |
|---|---|---|
| 저장·공유 | Pro 유료, 계정 기반 | 무료, 로컬 + JSON 파일 + (Phase 2) URL |
| 오프라인 | [검토] | PWA, 완전 오프라인 |
| 개인정보 | 계정 기반 서버 저장 [추정] | 외부 전송 0 |
| 소스 | 비공개 | 공개 (포트폴리오) |
| 학생 기기 참여 | 원격 투표 지원 | **비목표** |
| 위젯 수 | 26 | MVP 8 → 점진 확장 |

## 6. 복제 방지 원칙
- 서비스명·로고·아이콘·배경·스티커·Work symbols 픽토그램을 **사용하지 않음**
- 아이콘은 오픈 라이선스 세트 또는 자체 제작 (라이선스는 TRD 의존성 목록에 기록)
- 위젯 개념(타이머 등)은 일반 기능이므로 구현하되, UI 레이아웃·색상 체계는 자체 디자인 시스템으로
