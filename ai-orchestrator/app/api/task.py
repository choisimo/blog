from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import structlog
import json
import re

from app.config import get_settings
from app.tools.llm import get_llm_client

router = APIRouter()
logger = structlog.get_logger()


class TaskPayload(BaseModel):
    paragraph: str = ""
    content: str = ""
    prompt: str = ""
    post_title: str = Field(default="", alias="postTitle")

    class Config:
        populate_by_name = True


class TaskRequest(BaseModel):
    mode: str = "custom"
    payload: TaskPayload
    model: str | None = None
    temperature: float | None = None


class TaskResponse(BaseModel):
    ok: bool
    data: dict
    mode: str
    source: str


TASK_PROMPTS = {
    "sketch": """You are a helpful writing companion. Return STRICT JSON only matching the schema: {{"mood":"string","bullets":["string"]}}. Post: {post_title}. Paragraph: {paragraph}. Task: Capture the emotional sketch. Select a concise mood and 3-6 short bullets.""",
    "prism": """Return STRICT JSON only for idea facets: {{"facets":[{{"title":"string","points":["string"]}}]}}. Post: {post_title}. Paragraph: {paragraph}. Task: Provide 2-3 facets with 2-4 points each.""",
    "chain": """Return STRICT JSON only for tail questions: {{"questions":[{{"q":"string","why":"string"}}]}}. Post: {post_title}. Paragraph: {paragraph}. Task: Generate 3-5 follow-up questions with brief why.""",
    "summary": """Summarize the following content concisely and return as JSON: {{"summary": "your summary here"}}. Content: {paragraph}""",
}

FALLBACK_DATA = {
    "sketch": {"mood": "curious", "bullets": ["Key point extracted from content"]},
    "prism": {"facets": [{"title": "Core Points", "points": ["Main idea"]}]},
    "chain": {"questions": [{"q": "What is the main argument?", "why": "Clarify core thesis"}]},
    "summary": {"summary": "Content summary unavailable"},
}


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


@router.post("/task")
async def task(request: TaskRequest) -> TaskResponse:
    settings = get_settings()
    request_id = f"orch-task-{id(request)}"

    try:
        client = get_llm_client()
        model = request.model or settings.default_chat_model
        mode = request.mode

        paragraph = request.payload.paragraph or request.payload.content or request.payload.prompt
        post_title = request.payload.post_title

        prompt_template = TASK_PROMPTS.get(mode)
        if not prompt_template:
            prompt_template = f"Process the following content and return as JSON: {paragraph}"
        else:
            prompt_template = prompt_template.format(paragraph=paragraph, post_title=post_title)

        response = await client.acompletion(
            model=model,
            messages=[{"role": "user", "content": prompt_template}],
            temperature=request.temperature or 0.5,
            timeout=180,
        )

        content = response.choices[0].message.content or ""
        parsed = parse_json_response(content)

        if not parsed:
            parsed = FALLBACK_DATA.get(mode, {"text": content})

        return TaskResponse(ok=True, data=parsed, mode=mode, source="litellm")

    except Exception as e:
        logger.error("task_error", error=str(e), mode=request.mode, request_id=request_id)
        fallback = FALLBACK_DATA.get(request.mode, {"text": "Task processing failed"})
        return TaskResponse(ok=True, data=fallback, mode=request.mode, source="fallback")
