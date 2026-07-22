"""SQLAlchemy engine and session management. SQLite now, Postgres later."""
import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
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
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        _engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"check_same_thread": False},  # FastAPI threadpool
            pool_pre_ping=True,
        )
        # SQLite is a durable local default when its concurrency and integrity
        # switches are explicit. These run for every pooled connection.
        @event.listens_for(_engine, "connect")
        def _sqlite_pragmas(connection, _record) -> None:
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()
    return _engine


def init_db() -> None:
    from . import models  # noqa: F401  (register tables)

    Base.metadata.create_all(get_engine())
    path = config.db_path()
    if os.name != "nt" and os.path.exists(path):
        os.chmod(path, 0o600)


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
