"""App factory. Run locally with:  uvicorn app.main:app --reload"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .db import init_db
from .routers import auth, contact, health


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(
        title="Sonne Systems API",
        version="0.1.0",
        description="Backend for sonnesystems.com: auth, contact, newsletter.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(contact.router)
    return app


app = create_app()
