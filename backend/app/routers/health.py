from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "sonne-api"}


@router.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict:
    """Readiness verifies the dependency the API actually needs: its database."""
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "sonne-api"}
