---
title: "LLM Providers 추상화방안"
date: "2026-01-17"
category: "LLM"
tags: ["LLM", "Architecture", "LiteLLM", "LangChain", "MCP", "RAG"]
excerpt: "LiteLLM 프록시로 LLM 호출"
readTime: "7분"
---

### 1. Infrastructure Layer: LiteLLM Proxy (Docker)

가장 먼저 LLM 호출을 표준화하는 게이트웨이를 구축합니다. Proxmox 환경 내 Docker 컨테이너로 띄우고, 앱은 **OpenAI 호환 `/v1` API**만 바라보게 만듭니다.

#### `config.yaml` (LiteLLM 설정)

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: claude-3-5
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20240620
      api_key: os.environ/ANTHROPIC_API_KEY

  # 홈랩용 로컬 모델 (Ollama 연결 예시)
  - model_name: local-llama3
    litellm_params:
      model: ollama/llama3
      api_base: "http://host.docker.internal:11434"

router_settings:
  fallbacks:
    gpt-4o: ["gpt-4o-mini", "claude-3-5"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

#### `docker-compose.yml`

```yaml
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    ports:
      - "4000:4000"
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./litellm-data:/data
    env_file:
      - .env
    command: ["--config", "/app/config.yaml", "--port", "4000"]
    restart: unless-stopped
```

#### `.env` 예시 (키는 절대 커밋 금지)

```bash
LITELLM_MASTER_KEY=sk-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
```

- **원칙:** 애플리케이션 코드는 `gpt-4o`가 실제로 OpenAI인지 다른 provider인지 알 필요가 없습니다. 모델 별칭과 폴백은 게이트웨이에서 해결합니다.

---

### 2. Application Layer: LangChain + Vector DB + MCP

이제 Python 애플리케이션에서 LiteLLM을 경유하여 Vector DB와 MCP를 엮습니다.

#### 사전 준비

`pip install langchain langchain-openai langchain-chroma litellm mcp`

#### `app.py`

```python
import os
import asyncio
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from langchain.agents import AgentExecutor, create_openai_tools_agent
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ---------------------------------------------------------
# 1. LiteLLM 연결 (Gateway)
# ---------------------------------------------------------
# LangChain은 LiteLLM을 'OpenAI' 호환 엔드포인트로 인식합니다.
LITELLM_BASE_URL = os.getenv("LITELLM_BASE_URL", "http://localhost:4000/v1")
LITELLM_API_KEY = os.getenv("LITELLM_MASTER_KEY", "sk-anything")

llm = ChatOpenAI(
    model="gpt-4o",                        # LiteLLM config에 정의된 이름
    openai_api_base=LITELLM_BASE_URL,       # LiteLLM /v1
    openai_api_key=LITELLM_API_KEY,         # master_key 사용 시 여기에 전달
    temperature=0
)

# ---------------------------------------------------------
# 2. Vector DB 연결 (RAG)
# ---------------------------------------------------------
# 임베딩도 동일한 게이트웨이로 통일 (provider 교체 비용 최소화)
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_base=LITELLM_BASE_URL,
    openai_api_key=LITELLM_API_KEY,
)

# 간단한 인메모리 DB 생성 및 데이터 주입
vector_db = Chroma.from_texts(
    ["Proxmox는 오픈소스 가상화 관리 플랫폼이다.",
     "Docker는 컨테이너화를 위한 플랫폼이다.",
     "사용자의 블로그는 n8n으로 자동화되어 있다."],
    embeddings
)
retriever = vector_db.as_retriever(search_kwargs={"k": 3})

# RAG를 위한 Tool 정의
@tool
def search_knowledge_base(query: str) -> str:
    """시스템 인프라 및 사용자 프로젝트에 대한 정보를 검색할 때 사용합니다."""
    docs = retriever.invoke(query)
    return "\n".join([doc.page_content for doc in docs])

# ---------------------------------------------------------
# 3. MCP (Model Context Protocol) 연결
# ---------------------------------------------------------
# MCP는 보통 별도의 서버 프로세스로 돕니다. (예: 로컬 파일시스템 접근 서버)
# 여기서는 MCP 클라이언트를 LangChain Tool로 래핑하는 패턴을 보여줍니다.

async def run_mcp_tool(tool_name: str, arguments: dict):
    # 실제 환경에서는 MCP 서버 파라미터를 설정해야 합니다.
    server_params = StdioServerParameters(
        command="npx",  # 예: Node.js 기반 MCP 서버 실행
        args=["-y", "@modelcontextprotocol/server-filesystem", "./workspace"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return await session.call_tool(tool_name, arguments=arguments)

@tool
def list_directory(path: str = ".") -> str:
    """로컬 파일 시스템 디렉토리를 조회합니다 (MCP 경유)."""
    # 스크립트 기준: 이벤트 루프가 없는 환경에서 실행
    result = asyncio.run(run_mcp_tool("list_directory", {"path": path}))
    return str(result)

# ---------------------------------------------------------
# 4. Agent 구성 (Logic Orchestration)
# ---------------------------------------------------------
tools = [search_knowledge_base, list_directory]

prompt = ChatPromptTemplate.from_messages([
    ("system", "당신은 시스템 엔지니어 봇입니다. 기술적 질문에 답변하고 시스템 도구를 사용하세요."),
    ("user", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# ---------------------------------------------------------
# 5. 실행
# ---------------------------------------------------------
if __name__ == "__main__":
    query = "내 블로그 아키텍처를 요약하고, 현재 디렉토리 파일도 확인해줘."

    response = agent_executor.invoke({"input": query})
    print("\n--- Final Response ---\n")
    print(response["output"])

```

### 작동 원리 상세 (요청 흐름)

1. **사용자 입력 → 에이전트 컨텍스트 구성**
   - LangChain이 시스템 프롬프트 + 사용자 입력을 묶어 에이전트 실행 컨텍스트를 구성합니다.

2. **도구 호출 판단**
   - 에이전트는 RAG 검색 또는 MCP 도구 호출이 필요한지 판단합니다.
   - 필요하면 `search_knowledge_base` 또는 `list_directory`를 먼저 실행합니다.

3. **LiteLLM 게이트웨이 호출**
   - LLM 호출은 `http://localhost:4000/v1`로 전송됩니다.
   - 앱은 provider를 몰라도 되고, 오직 모델 별칭(`gpt-4o`)만 사용합니다.

4. **LiteLLM 라우팅/폴백 처리**
   - LiteLLM은 `config.yaml`의 `model_list`에서 실제 provider를 매핑합니다.
   - 실패하거나 제한에 걸리면 `fallbacks` 규칙으로 다른 모델로 자동 전환합니다.

5. **Vector DB 응답 합성**
   - RAG tool이 반환한 문맥을 LLM에게 다시 주입해 최종 답변을 생성합니다.

6. **MCP 응답 합성**
   - MCP 도구가 로컬/외부 시스템 결과를 반환하면, 해당 결과를 기반으로 최종 답변을 생성합니다.

### 왜 이 추상화가 중요한가

- **Provider 교체 비용 감소:** OpenAI ↔ Anthropic ↔ 로컬 모델 전환 시 앱 코드는 변경하지 않습니다.
- **운영 안정성:** LiteLLM에서 폴백, 로깅, 키 관리를 통합해 장애 대응이 빨라집니다.
- **도구 재사용:** MCP는 표준 프로토콜이므로 다른 에이전트/앱에서도 동일한 도구를 재사용할 수 있습니다.
