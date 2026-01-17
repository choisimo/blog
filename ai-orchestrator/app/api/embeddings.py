from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog

from app.config import get_settings
from app.tools.llm import get_llm_client

router = APIRouter()
logger = structlog.get_logger()


class EmbeddingsRequest(BaseModel):
    input: str | list[str]
    model: str | None = None


class EmbeddingsResponse(BaseModel):
    embeddings: list[list[float]]
    data: list[list[float]]
    model: str
    provider: str
    request_id: str = Field(alias="requestId")
    usage: dict | None = None

    class Config:
        populate_by_name = True


@router.post("/embeddings")
async def embeddings(request: EmbeddingsRequest) -> EmbeddingsResponse:
    settings = get_settings()
    request_id = f"orch-embed-{id(request)}"

    try:
        client = get_llm_client()
        model = request.model or settings.default_embed_model

        input_list = request.input if isinstance(request.input, list) else [request.input]

        response = await client.aembedding(
            model=model,
            input=input_list,
            timeout=60,
        )

        embeddings_data = [item["embedding"] for item in response.data]

        return EmbeddingsResponse(
            embeddings=embeddings_data,
            data=embeddings_data,
            model=response.model or model,
            provider="litellm",
            requestId=request_id,
            usage=response.usage.model_dump() if response.usage else None,
        )
    except Exception as e:
        logger.error("embeddings_error", error=str(e), request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "EMBEDDINGS_ERROR"})
