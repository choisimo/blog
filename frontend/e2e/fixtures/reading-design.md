---
title: '읽기 디자인 회귀 검증'
description: '본문, 이미지, 표와 코드의 실제 렌더링을 확인하는 고정 테스트 문서입니다.'
date: '2026-09-08'
author: 'Reading regression fixture'
category: 'Engineering'
tags: ['reading', 'design']
published: true
---

## 읽기의 흐름

이 문서는 레이아웃 회귀 검증에만 사용합니다. 문장의 시작점과 제목의 시작점이 같은 읽기 축을 유지하며, 화면이 좁아져도 본문 전체가 가로로 밀려나지 않아야 합니다.

![가로 이미지](/media/reading-wide.svg)

## 세로 자료

<img src="/media/reading-tall.svg" alt="세로 이미지" width="600" height="1200" />

세로 이미지는 원본 비율로 표시합니다. 확대 보기를 닫으면 처음에 이미지를 열었던 버튼으로 초점이 돌아옵니다.

## 표 읽기

| 요청 상태 | 요청 식별자 | 처리 전 조건 | 처리 결과 | 확인 시각 | 남겨야 하는 기록 |
| --- | --- | --- | --- | --- | --- |
| 확인 중 | request-reading-20260908 | 기존 결과 보존 | 새 결과 검증 | 12:00:00 | 이전 결과 및 검증 근거 |
| 완료 | request-reading-20260909 | 확인 완료 | 반영 | 12:00:01 | 변경 이력 |

## 코드 읽기

```http
GET /reading/very-long-path/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz/abcdefghijklmnopqrstuvwxyz?original_layout=preserved&scrolling=local
```

## 오류와 복구

![다시 시도할 이미지](/media/reading-broken.svg)

## 읽기 완료

본문 진행률은 이 글이 끝나는 지점을 기준으로 계산합니다. 관련 글과 댓글이 뒤에 추가되더라도 읽기를 끝낸 상태는 달라지지 않습니다.
