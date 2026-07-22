"""App factory. Run locally with:  uvicorn app.main:app --reload"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from . import config
from .db import init_db
from .middleware import (
    BodyLimitMiddleware,
    JsonContentTypeMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from .routers import auth, contact, health


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(
        title="Sonne Systems API",
        version="1.0.0",
        description="Backend for sonnesystems.com: auth, contact, newsletter.",
        docs_url=None if config.production() else "/docs",
        redoc_url=None if config.production() else "/redoc",
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.trusted_hosts())
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.add_middleware(BodyLimitMiddleware, max_bytes=config.MAX_BODY_BYTES)
    app.add_middleware(JsonContentTypeMiddleware)
    app.add_middleware(RateLimitMiddleware)
    # Added last so these headers wrap success, validation errors and edge rejects.
    app.add_middleware(SecurityHeadersMiddleware)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(contact.router)
    return app


app = create_app()
