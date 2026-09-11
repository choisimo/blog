# Reader experience tasks

## R01 — Memo workspace
- [x] 기존 데이터/버전 경로 유지
- [x] 작성 우선, 선택적 분할 미리보기
- [x] 제목 편집, 목차, 문서 검색, 집중 모드
- [x] 모바일 공간/동작, reduced-motion, 코드 도구 접기
- [x] 저장 실패 표시와 저장 후 닫기 보호
- [x] index.html과 component asset version 동시 갱신
- [x] 실제 web component의 로컬 Chromium 검증
- [ ] 실기기 IME/가상 키보드, 실제 localStorage 지속성 검증

## R02 — Agent preferences
- [x] 역할/말투/길이/언어/근거/표/이미지 설정
- [x] guest 로컬, member 계정 저장 + CAS
- [x] 고정 캐릭터/짧은 답변 강제 지침 제거
- [x] 대화 설정과 서버 권한 구분
- [ ] 실제 회원 로그인/계정 전환 E2E
- [ ] 로컬 전용 변경과 cloud 설정 간 명시적 병합

## R03 — Private image policy
- [x] guest 5/일, member 설정값, 전역 상한
- [x] KST 리셋, 원자 예약, idempotency, burst 제한
- [x] 확실한 실패 반환 / 불명확한 결과 유지
- [x] private bucket + owner 확인 + 7일 접근 만료
- [x] orphan object 회수 / 30일 tombstone
- [x] 내부 render endpoint 공용 경로 차단
- [x] SQLite 병렬 연결 및 한도/실패 계약 테스트
- [ ] 실제 D1/Hono/R2/provider E2E 및 비용 대조

## R04 — Chat/debate visuals
- [x] 글 스트리밍 즉시 표시, 끊겨도 받은 본문 유지
- [x] 이미지 자동/항상/수동/끄기
- [x] 토론 주제 카드, 확대/다운로드/상태 확인
- [x] 이전 계정 대화의 새 계정 이미지 요청 차단
- [ ] provider 실생성 smoke / production 프런트 번들 검증

## R05 — Deployment gate
- [ ] dependencies 설치 후 원래 build/typecheck/Vitest
- [ ] staging migration 0039
- [ ] READER_IMAGES_R2 private bucket 및 lifecycle
- [ ] backend와 gateway flags 순차 활성화
- [ ] 실제 생성 1장/중복키/다른 계정 읽기 거부/한도 검증
- [ ] 운영 배포 승인

## R06 — Member enrollment (계획)
- [ ] 관리자 인증과 별도 일반 회원 가입/로그인
- [ ] 이메일/identity 검증, server-assigned user role
- [ ] token 철회/비활성화/탈퇴
- [ ] 명시적 guest 데이터 이관, 같은 날짜 사용량 합산 ledger
- [ ] 계정별 생성물 목록/삭제/내보내기

## R07 — Abuse and recovery (계획)
- [ ] Turnstile, 공유 NAT UX, IPv6 및 분산 요청 대응
- [ ] 결과 불명확 job의 provider 조회/복구
- [ ] 운영자 정산/환불 근거, 감사 기록
- [ ] cleanup backlog와 비용 지표/알림
