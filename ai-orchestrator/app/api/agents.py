from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog

from app.config import get_settings
from app.agents.registry import get_agent, list_agents

router = APIRouter()
logger = structlog.get_logger()


class AgentRunRequest(BaseModel):
    input: str
    session_id: str | None = Field(default=None, alias="sessionId")
    context: dict | None = None

    class Config:
        populate_by_name = True


class AgentRunResponse(BaseModel):
    output: str
    agent_name: str = Field(alias="agentName")
    session_id: str | None = Field(alias="sessionId")
    actions: list[dict] | None = None
    metadata: dict | None = None

    class Config:
        populate_by_name = True


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, alias="topK")
    collection: str | None = None

    class Config:
        populate_by_name = True


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[dict]
    query: str


@router.post("/agent/{agent_name}/run")
async def run_agent(agent_name: str, request: AgentRunRequest) -> AgentRunResponse:
    request_id = f"orch-agent-{id(request)}"

    try:
        agent = get_agent(agent_name)
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")

        result = await agent.arun(
            input=request.input,
            session_id=request.session_id,
            context=request.context,
        )

        return AgentRunResponse(
            output=result.output,
            agentName=agent_name,
            sessionId=request.session_id,
            actions=result.actions,
            metadata=result.metadata,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("agent_run_error", error=str(e), agent=agent_name, request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "AGENT_ERROR"})


@router.get("/agents")
async def get_agents() -> dict:
    return {"agents": list_agents()}


@router.post("/rag/query")
async def rag_query(request: RAGQueryRequest) -> RAGQueryResponse:
    settings = get_settings()
    request_id = f"orch-rag-{id(request)}"

    try:
        from app.rag.retriever import query_rag

        result = await query_rag(
            query=request.query,
            top_k=request.top_k,
            collection=request.collection or settings.chroma_collection,
        )

        return RAGQueryResponse(
            answer=result.answer,
            sources=result.sources,
            query=request.query,
        )
    except Exception as e:
        logger.error("rag_query_error", error=str(e), request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "RAG_ERROR"})
