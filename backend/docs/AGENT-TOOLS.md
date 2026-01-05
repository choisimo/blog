# Agent Tools Reference

Agent 도구는 **로컬에서 직접 실행**됩니다 (n8n 웹훅 없이).

## 도구 개요

| 도구 | 파일 | 외부 서비스 | 용도 |
|------|------|------------|------|
| `rag_search` | `tools/rag-search.js` | ChromaDB, TEI | 벡터 기반 문서 검색 |
| `web_search` | `tools/web-search.js` | DuckDuckGo, Brave, Serper | 웹 검색 |
| `blog_operations` | `tools/blog-ops.js` | Internal API | 블로그 CRUD |
| `code_execution` | `tools/code-execution.js` | Terminal Server | 코드 실행 |
| `mcp_tools` | `tools/mcp-client.js` | MCP Servers | 파일시스템 등 |

**레지스트리:** `src/lib/agent/tools/index.js`

---

## 1. RAG Search (`rag_search`)

ChromaDB 벡터 스토어에서 의미 기반 문서 검색.

**파일:** `src/lib/agent/tools/rag-search.js`

### 파라미터

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "검색 쿼리"
    },
    "collection": {
      "type": "string",
      "description": "ChromaDB 컬렉션명",
      "default": "blog-posts-all-MiniLM-L6-v2"
    },
    "topK": {
      "type": "number",
      "description": "반환할 결과 수",
      "default": 5
    },
    "minScore": {
      "type": "number",
      "description": "최소 유사도 점수",
      "default": 0.5
    }
  },
  "required": ["query"]
}
```

### 실행 흐름

```
query
  │
  ├─[1] Generate embedding ─────────────▶ TEI Server (http://embedding-server:80)
  │     POST /embed
  │     { "inputs": ["query text"] }
  │
  ├─[2] Vector search ──────────────────▶ ChromaDB (http://chromadb:8000)
  │     POST /api/v1/collections/{collection}/query
  │     { "query_embeddings": [...], "n_results": topK }
  │
  └─[3] Format results
        Filter by minScore
        Return ranked documents
```

### 응답

```json
{
  "results": [
    {
      "id": "2025/ai-trends",
      "content": "Document content...",
      "metadata": {
        "title": "AI Trends 2025",
        "slug": "ai-trends",
        "year": "2025"
      },
      "score": 0.87
    }
  ],
  "query": "AI trends",
  "totalFound": 5
}
```

### 환경 변수

```bash
CHROMA_URL=http://chromadb:8000
TEI_URL=http://embedding-server:80
RAG_DEFAULT_COLLECTION=blog-posts-all-MiniLM-L6-v2
```

---

## 2. Web Search (`web_search`)

외부 검색 엔진을 통한 웹 검색.

**파일:** `src/lib/agent/tools/web-search.js`

### 파라미터

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "검색 쿼리"
    },
    "engine": {
      "type": "string",
      "enum": ["duckduckgo", "brave", "serper"],
      "default": "duckduckgo"
    },
    "maxResults": {
      "type": "number",
      "default": 5
    }
  },
  "required": ["query"]
}
```

### 지원 엔진

| 엔진 | API | API 키 필요 |
|------|-----|------------|
| DuckDuckGo | `https://api.duckduckgo.com/` | No |
| Brave | `https://api.search.brave.com/` | Yes |
| Serper | `https://serpapi.com/` | Yes |

### 응답

```json
{
  "results": [
    {
      "title": "Search Result Title",
      "url": "https://example.com/article",
      "snippet": "Brief description of the content..."
    }
  ],
  "query": "search query",
  "engine": "duckduckgo",
  "totalFound": 5
}
```

### 환경 변수

```bash
BRAVE_API_KEY=your-brave-api-key
SERPER_API_KEY=your-serper-api-key
```

---

## 3. Blog Operations (`blog_operations`)

블로그 내부 API CRUD 작업.

**파일:** `src/lib/agent/tools/blog-ops.js`

### 파라미터

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["list", "get", "create", "update", "delete"],
      "description": "수행할 작업"
    },
    "year": {
      "type": "string",
      "description": "게시글 연도"
    },
    "slug": {
      "type": "string",
      "description": "게시글 슬러그"
    },
    "data": {
      "type": "object",
      "description": "create/update 시 게시글 데이터"
    }
  },
  "required": ["action"]
}
```

### 지원 작업

| 작업 | 내부 API | 설명 |
|------|----------|------|
| `list` | `GET /api/v1/posts` | 게시글 목록 |
| `get` | `GET /api/v1/posts/:year/:slug` | 게시글 조회 |
| `create` | `POST /api/v1/posts` | 게시글 생성 |
| `update` | `PUT /api/v1/posts/:year/:slug` | 게시글 수정 |
| `delete` | `DELETE /api/v1/posts/:year/:slug` | 게시글 삭제 |

### 응답 (list)

```json
{
  "action": "list",
  "posts": [
    {
      "title": "Post Title",
      "slug": "post-slug",
      "year": "2025",
      "date": "2025-01-06",
      "tags": ["tag1", "tag2"]
    }
  ],
  "total": 10
}
```

### 환경 변수

```bash
INTERNAL_API_URL=http://localhost:5080
ADMIN_BEARER_TOKEN=your-admin-token
```

---

## 4. Code Execution (`code_execution`)

격리된 샌드박스에서 코드 실행.

**파일:** `src/lib/agent/tools/code-execution.js`

### 파라미터

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "실행할 코드"
    },
    "language": {
      "type": "string",
      "enum": ["python", "javascript", "bash"],
      "default": "python"
    },
    "timeout": {
      "type": "number",
      "description": "실행 타임아웃 (초)",
      "default": 30
    }
  },
  "required": ["code"]
}
```

### 실행 흐름

```
code
  │
  └─▶ Terminal Server (http://terminal-server:8080)
      POST /execute
      {
        "code": "print('hello')",
        "language": "python",
        "timeout": 30
      }
```

### 응답

```json
{
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 0.123
}
```

### 환경 변수

```bash
TERMINAL_SERVER_URL=http://terminal-server:8080
ORIGIN_SECRET_KEY=terminal-secret
CODE_EXECUTION_TIMEOUT=30
```

---

## 5. MCP Tools (`mcp_tools`)

MCP (Model Context Protocol) 서버 연동.

**파일:** `src/lib/agent/tools/mcp-client.js`

### 파라미터

```json
{
  "type": "object",
  "properties": {
    "server": {
      "type": "string",
      "description": "MCP 서버 이름"
    },
    "tool": {
      "type": "string",
      "description": "호출할 도구"
    },
    "arguments": {
      "type": "object",
      "description": "도구 인자"
    }
  },
  "required": ["server", "tool"]
}
```

### 지원 MCP 서버

| 서버 | 연결 방식 | 기능 |
|------|----------|------|
| `filesystem` | stdio | 파일 읽기/쓰기 |

### 응답

```json
{
  "server": "filesystem",
  "tool": "read_file",
  "result": {
    "content": "file content..."
  }
}
```

---

## Tool Registry

### 초기화

```javascript
// src/lib/agent/tools/index.js
const builtInTools = [
  createRAGSearchTool(),
  createBlogOpsTool(),
  createWebSearchTool(),
  createCodeExecutionTool(),
];

// MCP는 비동기 초기화
const mcpTool = await createMCPClientTool();
```

### 사용법

```javascript
import { getToolRegistry } from './lib/agent/tools/index.js';

const registry = getToolRegistry();

// 도구 목록
const tools = registry.getToolDefinitions();

// 도구 실행
const result = await registry.execute('rag_search', {
  query: 'AI trends',
  topK: 5
});
```

### OpenAI Function Calling 형식

```json
{
  "type": "function",
  "function": {
    "name": "rag_search",
    "description": "Search blog posts using vector similarity",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Search query" },
        "topK": { "type": "number", "description": "Number of results" }
      },
      "required": ["query"]
    }
  }
}
```

---

## Agent Coordinator 연동

### Tool Call 파싱

Agent는 LLM 응답에서 `tool_call` 블록을 파싱하여 실행:

```markdown
```tool_call
{
  "tool": "rag_search",
  "arguments": { "query": "AI articles" }
}
```
```

### 실행 흐름

```
1. LLM에 도구 정의 전달
2. LLM이 tool_call 블록 포함 응답
3. Coordinator가 블록 파싱
4. ToolRegistry에서 도구 실행 (로컬)
5. 결과를 컨텍스트에 주입
6. LLM에 계속 요청
```

**코드 위치:** `src/lib/agent/coordinator.js`

---

## 에러 처리

### 도구 실행 실패 시

```json
{
  "error": true,
  "message": "Tool execution failed: ...",
  "tool": "rag_search"
}
```

### 타임아웃

각 도구별 타임아웃:

| 도구 | 기본 타임아웃 |
|------|-------------|
| rag_search | 30s |
| web_search | 30s |
| blog_operations | 30s |
| code_execution | 30s (configurable) |
| mcp_tools | 60s |
