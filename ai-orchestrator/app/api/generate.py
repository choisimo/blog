from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog

from app.config import get_settings
from app.tools.llm import get_llm_client

router = APIRouter()
logger = structlog.get_logger()


class GenerateRequest(BaseModel):
    prompt: str
    system_prompt: str | None = Field(default=None, alias="systemPrompt")
    model: str | None = None
    temperature: float = Field(default=0.2, ge=0, le=2)

    class Config:
        populate_by_name = True


class GenerateResponse(BaseModel):
    text: str
    content: str
    response: str
    model: str
    provider: str
    request_id: str = Field(alias="requestId")

    class Config:
        populate_by_name = True


@router.post("/generate")
async def generate(request: GenerateRequest) -> GenerateResponse:
    settings = get_settings()
    request_id = f"orch-gen-{id(request)}"

    try:
        client = get_llm_client()
        model = request.model or settings.default_chat_model

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        response = await client.acompletion(
            model=model,
            messages=messages,
            temperature=request.temperature,
            timeout=settings.request_timeout,
        )

        content = response.choices[0].message.content or ""

        return GenerateResponse(
            text=content,
            content=content,
            response=content,
            model=response.model or model,
            provider="litellm",
            requestId=request_id,
        )
    except Exception as e:
        logger.error("generate_error", error=str(e), request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "GENERATE_ERROR"})
