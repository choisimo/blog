# AI 기능 전체 아키텍처 분석

> **작성일**: 2025-12-26  
> **목적**: 서비스별 AI 사용 현황 정리 및 통합 관리 방안 도출

---

## 1. AI 서비스 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                               │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ AI Chat  │ │ AI Memo  │ │ Sentio    │ │Translate │ │  Image Analysis │  │
│  │ Widget   │ │ Pad      │ │(Spark)    │ │          │ │                 │  │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘ └────────┬────────┘  │
│       │            │             │            │                 │           │
│       │      ┌─────┴─────┐       │            │                 │           │
│       │      │ ai-memo.js│       │            │                 │           │
│       │      │(Web Comp) │       │            │                 │           │
│       │      └─────┬─────┘       │            │                 │           │
│       └────────────┼─────────────┼────────────┼─────────────────┘           │
│                    │             │            │                              │
│  ┌─────────────────┴─────────────┴────────────┴─────────────────────────┐   │
│  │                    Frontend AI Services                               │   │
│  │  - services/ai.ts (sketch, prism, chain, summary)                    │   │
│  │  - services/chat/api.ts (chat session management)                    │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │         Backend API (Express)     │
                    │                                   │
                    │  ┌─────────────────────────────┐  │
                    │  │      API Routes             │  │
                    │  │  /api/v1/ai/*              │  │
                    │  │  /api/v1/chat/*            │  │
                    │  │  /api/v1/translate/*       │  │
                    │  │  /api/v1/images/*          │  │
                    │  └──────────────┬──────────────┘  │
                    │                 │                 │
                    │  ┌──────────────┴──────────────┐  │
                    │  │   Unified AI Service        │  │
                    │  │   (ai-service.js)           │  │
                    │  │   - Provider abstraction    │  │
                    │  │   - Task execution          │  │
                    │  │   - Fallback handling       │  │
                    │  └──────────────┬──────────────┘  │
                    │                 │                 │
                    │  ┌──────────────┴──────────────┐  │
                    │  │    LiteLLM Client           │  │
                    │  │    (litellm-client.js)      │  │
                    │  │    - Circuit breaker        │  │
                    │  │    - Health caching         │  │
                    │  └──────────────┬──────────────┘  │
                    └─────────────────┼─────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │      LiteLLM Proxy (Port 4000)    │
                    │  - Unified OpenAI-compatible API  │
                    │  - Automatic fallback routing     │
                    │  - Load balancing                 │
                    └─────────────────┬─────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  VAS (GitHub    │       │  Google Gemini  │       │   Anthropic     │
│  Copilot)       │       │  API            │       │   Claude API    │
│  - gpt-4.1      │       │  - gemini-1.5   │       │  - claude-3.5   │
│  - gpt-4o       │       │  - gemini-2.0   │       │  - claude-3     │
│  - claude-sonnet│       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. 서비스별 AI 사용 현황

### 2.1 AI Chat Widget

| 항목 | 내용 |
|------|------|
| **위치** | `frontend/src/components/features/chat/` |
| **백엔드** | `/api/v1/chat/session/:id/message` |
| **기능** | 실시간 대화, 세션 관리, 컨텍스트 유지 |
| **AI Provider** | VAS (GitHub Copilot) via LiteLLM |
| **스트리밍** | SSE (Server-Sent Events) |

**주요 흐름:**
```
User Input → ensureSession() → POST /chat/session/:id/message
→ VAS Client → SSE Response → UI Update
```

### 2.2 AI Memo Pad (Web Component)

| 항목 | 내용 |
|------|------|
| **위치** | `frontend/public/ai-memo/ai-memo.js` |
| **백엔드** | `/api/v1/ai/generate`, `/api/v1/ai/generate/stream` |
| **기능** | 메모 작성 보조, 요약, Catalyst 제안 |
| **AI Provider** | AIService (litellm → vas → gemini fallback) |
| **특징** | Shadow DOM 기반 독립 컴포넌트 |

**주요 기능:**
- **Draft 저장**: LocalStorage + IndexedDB 동기화
- **Catalyst**: 창의적 제안 생성 (`runCatalyst()`)
- **Cloud Sync**: GitHub 기반 메모 저장/불러오기
- **History**: 버전 관리 및 복원

### 2.3 Sentio (Spark Inline)

| 항목 | 내용 |
|------|------|
| **위치** | `frontend/src/components/features/sentio/SparkInline.tsx` |
| **백엔드** | `/api/v1/chat/session/:id/task` |
| **기능** | 블로그 포스트 텍스트 분석 (Sketch, Prism, Chain) |
| **AI Provider** | VAS via Chat Task API |

**Task 유형:**
| Task | 설명 | 출력 형식 |
|------|------|----------|
| `sketch` | 감정(mood) + 핵심 포인트(bullets) | `{ mood, bullets[] }` |
| `prism` | 다각도 분석 (facets) | `{ facets[{ title, points[] }] }` |
| `chain` | 후속 질문 생성 | `{ questions[{ q, why }] }` |
| `summary` | 요약 | `{ summary }` |
| `catalyst` | 창의적 제안 | `{ suggestions[{ idea, reason }] }` |

### 2.4 Translation Service

| 항목 | 내용 |
|------|------|
| **위치** | `backend/src/routes/translate.js` |
| **백엔드** | `/api/v1/translate` |
| **기능** | 다국어 번역 (한↔영 등) |
| **AI Provider** | AIService |

### 2.5 Image Analysis (Vision)

| 항목 | 내용 |
|------|------|
| **위치** | `backend/src/routes/ai.js` (`/vision/analyze`) |
| **백엔드** | `/api/v1/ai/vision/analyze` |
| **기능** | 이미지 설명 생성 |
| **AI Provider** | AIService with `gpt-4o` (vision-capable) |
| **입력** | `imageUrl` 또는 `imageBase64` |

---

## 3. Backend AI Infrastructure

### 3.1 파일 구조

```
backend/src/
├── lib/
│   ├── ai-service.js      # 통합 AI 서비스 (Provider 추상화)
│   ├── litellm-client.js  # LiteLLM 프록시 클라이언트
│   ├── ai-serve.js        # VAS (GitHub Copilot) 클라이언트
│   └── gemini.js          # Google Gemini 직접 클라이언트 (Legacy)
├── routes/
│   ├── ai.js              # AI 관련 엔드포인트
│   ├── chat.js            # 채팅 세션 및 Task 처리
│   ├── translate.js       # 번역 엔드포인트
│   └── images.js          # 이미지 관련 (Vision 포함)
└── config.js              # AI Provider 설정
```

### 3.2 AIService 클래스 (ai-service.js)

**역할**: Provider 추상화 및 통합 인터페이스

```javascript
class AIService {
  // Provider 자동 감지 (litellm > vas > gemini)
  provider = getActiveProvider();
  
  // 주요 메서드
  generate(prompt, options)     // 텍스트 생성
  chat(messages, options)       // 대화 완료
  vision(imageData, prompt)     // 이미지 분석
  stream(prompt, options)       // 스트리밍 생성
  embeddings(input, options)    // 임베딩 (LiteLLM only)
  task(mode, payload)           // 구조화된 Task 실행
  health()                      // 상태 확인
}
```

### 3.3 LiteLLM Client (litellm-client.js)

**역할**: LiteLLM 프록시와 통신

**특징:**
- **Circuit Breaker**: 5회 실패 시 30초 차단
- **Health Cache**: 10초 캐싱
- **Timeout**: 기본 2분, Vision/번역 5분

### 3.4 API Endpoints 요약

| Endpoint | Method | 기능 |
|----------|--------|------|
| `/api/v1/ai/models` | GET | 사용 가능한 모델 목록 |
| `/api/v1/ai/auto-chat` | POST | 채팅 완료 |
| `/api/v1/ai/health` | GET | AI 서비스 상태 |
| `/api/v1/ai/status` | GET | 상세 상태 정보 |
| `/api/v1/ai/summarize` | POST | 텍스트 요약 |
| `/api/v1/ai/sketch` | POST | Sketch 분석 |
| `/api/v1/ai/prism` | POST | Prism 분석 |
| `/api/v1/ai/chain` | POST | Chain 질문 생성 |
| `/api/v1/ai/generate` | POST | 일반 텍스트 생성 |
| `/api/v1/ai/generate/stream` | GET | 스트리밍 생성 (SSE) |
| `/api/v1/ai/vision/analyze` | POST | 이미지 분석 |
| `/api/v1/chat/session` | POST | 세션 생성 |
| `/api/v1/chat/session/:id/message` | POST | 메시지 전송 (SSE) |
| `/api/v1/chat/session/:id/task` | POST | Task 실행 |
| `/api/v1/translate` | POST | 번역 |

---

## 4. LiteLLM Configuration

### 4.1 설정 파일 위치

- **Production**: `backend/litellm_config.yaml`
- **Local Dev**: `litellm_config.local.yaml`

### 4.2 지원 모델

| Provider | 모델 | 설명 |
|----------|------|------|
| GitHub Copilot (VAS) | `gpt-4.1`, `gpt-4o`, `claude-sonnet-4` | 기본 Provider |
| OpenAI Direct | `openai/gpt-4o`, `openai/gpt-4-turbo` | 별도 API 키 필요 |
| Google Gemini | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash` | Fallback |
| Anthropic | `claude-3.5-sonnet`, `claude-3-opus`, `claude-3-haiku` | 선택적 |
| Local (Ollama) | `local/llama3`, `local/codellama` | 개발용 |

### 4.3 Fallback 전략

```yaml
fallbacks:
  - gpt-4.1: ["gemini-1.5-flash", "claude-3-haiku"]
  - gpt-4o: ["gemini-1.5-pro", "claude-3.5-sonnet"]
  - claude-sonnet-4: ["claude-3.5-sonnet", "gemini-1.5-pro"]

context_window_fallbacks:
  - gpt-4.1: ["gemini-1.5-pro"]  # 1M context
```

---

## 5. Frontend AI Services

### 5.1 파일 구조

```
frontend/src/
├── services/
│   ├── ai.ts              # Sentio Task 호출 (sketch, prism, chain)
│   └── chat/
│       ├── api.ts         # Chat API 클라이언트
│       ├── types.ts       # 타입 정의
│       └── index.ts       # 세션 관리 (ensureSession)
├── components/features/
│   ├── chat/              # AI Chat Widget
│   ├── sentio/            # Spark Inline (Sketch/Prism/Chain)
│   └── memo/              # AI Memo 관련 (FAB에서 연동)
└── public/ai-memo/
    └── ai-memo.js         # AI Memo Web Component
```

### 5.2 services/ai.ts

**역할**: Sentio 기능용 Task API 호출

```typescript
// 주요 함수
sketch(input)   // → POST /chat/session/:id/task { mode: 'sketch' }
prism(input)    // → POST /chat/session/:id/task { mode: 'prism' }
chain(input)    // → POST /chat/session/:id/task { mode: 'chain' }
summary(input)  // → POST /chat/session/:id/task { mode: 'summary' }
```

### 5.3 AI Memo Web Component

**역할**: 독립 실행 가능한 메모 패드

**주요 기능:**
- `runCatalyst()`: AI 기반 창의적 제안
- `syncToCloud()`: GitHub 저장소 연동
- `loadHistory()` / `saveHistory()`: 버전 관리
- Shadow DOM 기반 스타일 격리

---

## 6. 데이터 흐름 예시

### 6.1 Chat Message Flow

```
1. User types message in ChatWidget
2. ensureSession() → GET/POST /chat/session
3. POST /chat/session/:id/message { parts: [...] }
4. Backend: getVASClient().chat(messages)
5. SSE stream: { type: 'text', text: chunk }
6. Frontend: Update UI in real-time
7. SSE: { type: 'done' }
```

### 6.2 Sentio Task Flow

```
1. User selects text in BlogPost
2. SparkInline component activates
3. User clicks "Sketch" tab
4. sketch({ paragraph, postTitle })
5. → POST /chat/session/:id/task { mode: 'sketch', payload: {...} }
6. Backend: buildTaskPrompt() → generateContent()
7. Response: { ok: true, data: { mood, bullets } }
8. UI: Display mood badge + bullet points
```

### 6.3 AI Memo Catalyst Flow

```
1. User writes memo in ai-memo-pad
2. User clicks "Catalyst" button
3. runCatalyst() in ai-memo.js
4. → GET /api/v1/ai/generate/stream?prompt=...
5. SSE stream: event: token, data: { token: "..." }
6. UI: Append tokens to suggestions panel
7. SSE: event: done
```

---

## 7. 개선 필요 사항

### 7.1 현재 이슈

| 이슈 | 설명 | 우선순위 |
|------|------|----------|
| 모델 선택 UI 부재 | 사용자가 모델을 선택할 수 없음 | Medium |
| 비용 추적 없음 | 사용량/비용 모니터링 불가 | Medium |
| 세션 메모리 휘발성 | 서버 재시작 시 채팅 히스토리 손실 | High |
| AI Memo 위치 버그 | FAB이 페이지 레이아웃 밖으로 나옴 | High |
| 에러 핸들링 일관성 | Provider별 에러 메시지 불일치 | Low |

### 7.2 권장 개선사항

1. **모델 선택 UI**: Chat Widget에 모델 드롭다운 추가
2. **세션 지속성**: D1 또는 KV를 활용한 세션 저장
3. **사용량 대시보드**: Admin 패널에 AI 사용 통계 추가
4. **통합 에러 처리**: AIService 레벨에서 일관된 에러 포맷

---

## 8. 환경 변수 요약

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `AI_PROVIDER` | 사용할 Provider (`litellm`, `vas`, `gemini`) | 자동 감지 |
| `LITELLM_BASE_URL` | LiteLLM 프록시 URL | `http://litellm:4000` |
| `LITELLM_API_KEY` | LiteLLM Master Key | `sk-litellm-master-key` |
| `AI_DEFAULT_MODEL` | 기본 모델 | `gpt-4.1` |
| `AI_SERVE_BASE_URL` | VAS Core URL | - |
| `GOOGLE_API_KEY` | Gemini API Key | - |
| `OPENAI_API_KEY` | OpenAI Direct API Key | - |
| `ANTHROPIC_API_KEY` | Anthropic API Key | - |

---

## 9. 관련 문서

- [AI 모델 관리 계획서](./PRD-ai-model-management-1226.md)
- [LiteLLM 설정](../backend/litellm_config.yaml)
- [AI Service 구현](../backend/src/lib/ai-service.js)
