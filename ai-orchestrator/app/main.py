from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.api import health, chat, generate, translate, task, vision, embeddings, agents
from app.observability.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AI Orchestrator",
        description="OpenAI-compatible + LangChain based AI Orchestration Service",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url="/redoc" if settings.app_env != "production" else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["Health"])
    app.include_router(chat.router, prefix="/webhook/ai", tags=["AI"])
    app.include_router(generate.router, prefix="/webhook/ai", tags=["AI"])
    app.include_router(translate.router, prefix="/webhook/ai", tags=["AI"])
    app.include_router(task.router, prefix="/webhook/ai", tags=["AI"])
    app.include_router(vision.router, prefix="/webhook/ai", tags=["AI"])
    app.include_router(embeddings.router, prefix="/webhook/ai", tags=["AI"])
    app.include_router(agents.router, prefix="/ai", tags=["Agents"])

    return app


app = create_app()
