from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog
import json
import re

from app.config import get_settings
from app.tools.llm import get_llm_client

router = APIRouter()
logger = structlog.get_logger()


class TranslateRequest(BaseModel):
    title: str = ""
    description: str = ""
    content: str = ""
    source_lang: str = Field(default="ko", alias="sourceLang")
    target_lang: str = Field(default="en", alias="targetLang")
    model: str | None = None

    class Config:
        populate_by_name = True


class TranslateResponse(BaseModel):
    title: str
    description: str
    content: str
    is_ai_generated: bool = Field(default=True, alias="isAiGenerated")
    model: str
    provider: str
    request_id: str = Field(alias="requestId")

    class Config:
        populate_by_name = True


TRANSLATE_SYSTEM_PROMPT = """You are a professional translator. Translate accurately while preserving meaning, tone, and formatting (including markdown). Do not add explanations or notes. Return ONLY a JSON object with translated fields: {"title": "...", "description": "...", "content": "..."}"""


def parse_json_response(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence_match:
        try:
            return json.loads(fence_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    return None


@router.post("/translate")
async def translate(request: TranslateRequest) -> TranslateResponse:
    settings = get_settings()
    request_id = f"orch-trans-{id(request)}"

    try:
        client = get_llm_client()
        model = request.model or settings.default_chat_model

        source_data = json.dumps(
            {
                "title": request.title,
                "description": request.description,
                "content": request.content,
            },
            ensure_ascii=False,
        )

        user_prompt = f"Translate the following from {request.source_lang} to {request.target_lang}.\n\n{source_data}"

        response = await client.acompletion(
            model=model,
            messages=[
                {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            timeout=300,
        )

        content = response.choices[0].message.content or ""
        parsed = parse_json_response(content)

        if not parsed:
            parsed = {
                "title": request.title,
                "description": request.description,
                "content": request.content,
            }

        return TranslateResponse(
            title=parsed.get("title", request.title),
            description=parsed.get("description", request.description),
            content=parsed.get("content", request.content),
            isAiGenerated=True,
            model=response.model or model,
            provider="openai",
            requestId=request_id,
        )
    except Exception as e:
        logger.error("translate_error", error=str(e), request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "TRANSLATE_ERROR"})
