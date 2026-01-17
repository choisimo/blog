from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

from app.config import get_settings

router = APIRouter()


class HealthResponse(BaseModel):
    ok: bool
    status: str
    service: str
    timestamp: str
    version: str
    endpoints: dict[str, str]
    models: list[dict[str, str]]


@router.get("/health")
@router.get("/webhook/ai/health")
async def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        ok=True,
        status="ok",
        service="ai-orchestrator",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
        endpoints={
            "chat": "/webhook/ai/chat",
            "generate": "/webhook/ai/generate",
            "vision": "/webhook/ai/vision",
            "translate": "/webhook/ai/translate",
            "task": "/webhook/ai/task",
            "embeddings": "/webhook/ai/embeddings",
            "health": "/webhook/ai/health",
            "agent_run": "/ai/agent/{agent_name}/run",
            "rag_query": "/ai/rag/query",
        },
        models=[
            {"id": "chat-default", "name": "Chat Default", "provider": "LiteLLM"},
            {"id": "chat-fast", "name": "Chat Fast", "provider": "LiteLLM"},
            {"id": "chat-premium", "name": "Chat Premium", "provider": "LiteLLM"},
            {"id": "vision-default", "name": "Vision Default", "provider": "LiteLLM"},
        ],
    )
