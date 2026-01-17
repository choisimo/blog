from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog

from app.config import get_settings
from app.tools.llm import get_llm_client

router = APIRouter()
logger = structlog.get_logger()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    model: str | None = None
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int | None = Field(default=None, alias="maxTokens")

    class Config:
        populate_by_name = True


class ChatResponse(BaseModel):
    content: str
    model: str
    provider: str
    request_id: str = Field(alias="requestId")
    usage: dict | None = None

    class Config:
        populate_by_name = True


@router.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    settings = get_settings()
    request_id = f"orch-chat-{id(request)}"

    try:
        client = get_llm_client()
        model = request.model or settings.default_chat_model

        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        response = await client.acompletion(
            model=model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens or settings.max_tokens_default,
            timeout=settings.request_timeout,
        )

        content = response.choices[0].message.content or ""

        return ChatResponse(
            content=content,
            model=response.model or model,
            provider="litellm",
            requestId=request_id,
            usage=response.usage.model_dump() if response.usage else None,
        )
    except Exception as e:
        logger.error("chat_error", error=str(e), request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "AI_ERROR"})
