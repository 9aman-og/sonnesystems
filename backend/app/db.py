"""SQLAlchemy engine and session management. SQLite now, Postgres later."""
import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import config


class Base(DeclarativeBase):
    pass


_engine = None
_factory = None


def get_engine():
    global _engine
    if _engine is None:
        path = config.db_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"check_same_thread": False},  # FastAPI threadpool
        )
    return _engine


def init_db() -> None:
    from . import models  # noqa: F401  (register tables)

    Base.metadata.create_all(get_engine())


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one session per request, always closed."""
    global _factory
    if _factory is None:
        _factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    db = _factory()
    try:
        yield db
    finally:
        db.close()
