# 게시글 파일명 및 slug 운영 규칙

> 이 문서는 `frontend/public/posts/<year>/*.md` 구조를 기준으로 작성했습니다.

## 목적

현재 게시글 파일명은 다음 문제가 섞여 있습니다.

- 대문자와 소문자가 혼재함
- 공백, 언더스코어, 한글 파일명이 섞여 있음
- 연도가 디렉터리와 파일명에 중복으로 들어감
- 같은 계열 글도 번호 규칙과 접미사 규칙이 제각각임
- 파일명과 공개 URL slug를 같은 개념으로 다뤄 유지보수가 어려움

이 문서의 목표는 파일 시스템상의 이름과 공개 URL slug를 분리해서, URL을 깨지 않고 파일명만 단계적으로 정리할 수 있게 만드는 것입니다.

## 핵심 원칙

1. 파일명은 ASCII 소문자 kebab-case만 사용합니다.
2. 연도는 디렉터리(`2024`, `2025`, `2026`)에서만 표현하고 파일명에는 반복하지 않습니다.
3. 공개 URL은 frontmatter의 `slug`를 우선 사용합니다.
4. 새 글은 가능하면 파일명과 `slug`를 동일하게 맞춥니다.
5. 기존 글 정리 시에는 먼저 `slug`를 명시해 URL을 고정한 뒤 파일명을 바꿉니다.

현재 manifest 생성 로직은 `frontmatter.slug || filename` 규칙을 사용하므로, 이 원칙을 바로 적용할 수 있습니다.

## 권장 패턴

### 일반 단일 주제 글

`topic-name.md`

예시:

- `git-history-rewrite-reset-rebase-reflog.md`
- `personalized-readability-ux.md`
- `database-containerization-guide.md`

### 시리즈형 튜토리얼

`series-01-topic-name.md`

예시:

- `ansible-01-installation-setup.md`
- `terraform-02-aws-ec2-example.md`
- `kubernetes-03-services-networking.md`

### 알고리즘 커리큘럼

`algo-001-two-sum.md`

예시:

- `algo-001-two-sum.md`
- `algo-031-merge-sort.md`
- `algo-100-lru-ttl-cache-system.md`

알고리즘 글처럼 순서가 중요한 시리즈는 3자리 번호를 유지하는 편이 정렬과 탐색에 유리합니다.

### 에세이/저널/회고

`essay-topic-name.md` 또는 `topic-name-journal.md`

예시:

- `network-evolution-intro-journal.md`
- `mole-observation-diary.md`
- `path-new-friend-essay.md`

## 피해야 할 패턴

- 공백 포함: `Container Network Interface.md`
- 언더스코어 사용: `Immutable_infra.md`
- 대문자 Camel/Pascal 혼합: `BankRuptIn1929.md`
- 숫자만 있는 파일명: `1.md`, `2.md`, `9.md`
- 연도 반복: `ai-agent-arena-2026-gpt-5-2-high-reasoning.md`
- 파일명에 한국어와 영어를 중복 병기: `algo-001-두-수의-합-two-sum.md`

## 기존 글에 대한 권장 정리 방식

### 1. URL부터 고정

기존 공개 링크를 유지해야 하는 글은 frontmatter에 현재 slug를 명시합니다.

```yaml
---
title: "예시 글"
slug: "ai-agent-arena-2026-gpt-5-2-high-reasoning"
---
```

이렇게 하면 파일명을 바꿔도 공개 URL은 유지됩니다.

### 2. 물리 파일명만 정리

예시:

| 현재 파일명 | 권장 파일명 | 비고 |
| --- | --- | --- |
| `frontend/public/posts/2026/Container Network Interface.md` | `container-network-interface.md` | 공백 제거 |
| `frontend/public/posts/2026/Immutable_infra.md` | `immutable-infrastructure.md` | 언더스코어 제거 |
| `frontend/public/posts/2025/BankRuptIn1929.md` | `bank-run-1929.md` | CamelCase 제거 |
| `frontend/public/posts/2025/감동을_잃어버린_그대들에게.md` | `essay-sense-of-wonder.md` | 수동 slug 필요 |
| `frontend/public/posts/2025/algo-001-두-수의-합-two-sum.md` | `algo-001-two-sum.md` | 시리즈 규칙 통일 |
| `frontend/public/posts/2026/ai-agent-arena-2026-gpt-5-2-high-reasoning.md` | `ai-agent-arena-gpt-5-2-high-reasoning.md` | 연도 중복 제거 |

### 3. 매니페스트 재생성

```bash
cd frontend
npm run generate-manifests
```

### 4. 필요하면 공개 slug를 나중에 별도 마이그레이션

파일명 정리와 공개 URL 변경은 한 번에 하지 않는 편이 안전합니다.

- 1차: 파일명만 정리, 기존 `slug` 유지
- 2차: redirect/alias 전략이 준비된 뒤 공개 slug 변경

현재 코드베이스에는 slug alias/redirect가 기본 제공되지 않으므로, 공개 slug 변경은 별도 작업으로 다루는 것이 맞습니다.

## 운영 규칙

- 새 글 작성 시 파일명은 반드시 kebab-case ASCII로 시작합니다.
- 제목은 한국어/영어 자유롭게 쓰되 파일명에는 넣지 않습니다.
- 카테고리/태그/시리즈 정보는 frontmatter에서 관리합니다.
- 동일 시리즈는 번호 자릿수를 통일합니다.
- `latest.md`, `_index.md` 같은 특수 파일은 예외로 유지합니다.

## 감사 명령

현재 상태를 점검하려면 아래 명령을 사용합니다.

```bash
cd frontend
npm run audit:post-filenames
```

엄격 모드로 CI에 연결하려면:

```bash
cd frontend
node scripts/audit-post-filenames.mjs --strict
```
