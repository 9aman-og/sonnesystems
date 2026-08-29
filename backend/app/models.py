"""Database schema. Naive-UTC datetimes throughout (SQLite friendly)."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class NewsletterSignup(Base):
    __tablename__ = "newsletter_signups"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AeroRun(Base):
    """Server-owned authority and recovery state for one bounded Aero run."""

    __tablename__ = "aero_runs"
    __table_args__ = (UniqueConstraint("user_id", "request_id", name="uq_aero_run_request"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    request_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(40), index=True)
    contract_digest: Mapped[str] = mapped_column(String(64))
    contract_ciphertext: Mapped[str] = mapped_column(Text)
    before_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    before_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approval_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    approval_consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lease_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recovery_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recovery_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    certificate_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_sequence: Mapped[int] = mapped_column(Integer, default=0)
    event_head_digest: Mapped[str] = mapped_column(String(64), default="")
    recovery_count: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __mapper_args__ = {"version_id_col": version}


class AeroRunEvent(Base):
    """Hash-chained, encrypted event entry for an Aero run."""

    __tablename__ = "aero_run_events"
    __table_args__ = (UniqueConstraint("run_id", "sequence", name="uq_aero_event_sequence"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("aero_runs.id", ondelete="CASCADE"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(80))
    payload_digest: Mapped[str] = mapped_column(String(64))
    previous_digest: Mapped[str] = mapped_column(String(64), default="")
    event_digest: Mapped[str] = mapped_column(String(64), unique=True)
    payload_ciphertext: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
