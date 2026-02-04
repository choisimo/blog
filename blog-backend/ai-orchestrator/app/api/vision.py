from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog
import base64

from app.config import get_settings
from app.tools.llm import get_llm_client

router = APIRouter()
logger = structlog.get_logger()


class VisionRequest(BaseModel):
    image_url: str | None = Field(default=None, alias="imageUrl")
    image: str | None = None
    type: str | None = None
    prompt: str = "Describe this image in detail."
    mime_type: str = Field(default="image/jpeg", alias="mimeType")
    model: str | None = None

    class Config:
        populate_by_name = True


class VisionResponse(BaseModel):
    description: str
    text: str
    content: str
    model: str
    provider: str
    request_id: str = Field(alias="requestId")

    class Config:
        populate_by_name = True


@router.post("/vision")
async def vision(request: VisionRequest) -> VisionResponse:
    settings = get_settings()
    request_id = f"orch-vision-{id(request)}"

    try:
        client = get_llm_client()
        model = request.model or settings.default_vision_model

        if request.image_url:
            image_content = {"type": "image_url", "image_url": {"url": request.image_url}}
        elif request.image:
            data_url = f"data:{request.mime_type};base64,{request.image}"
            image_content = {"type": "image_url", "image_url": {"url": data_url}}
        else:
            raise HTTPException(status_code=400, detail="Either imageUrl or image (base64) is required")

        messages = [
            {
                "role": "user",
                "content": [
                    image_content,
                    {"type": "text", "text": request.prompt},
                ],
            }
        ]

        response = await client.acompletion(
            model=model,
            messages=messages,
            timeout=300,
        )

        content = response.choices[0].message.content or ""

        return VisionResponse(
            description=content,
            text=content,
            content=content,
            model=response.model or model,
            provider="openai",
            requestId=request_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("vision_error", error=str(e), request_id=request_id)
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "VISION_ERROR"})
