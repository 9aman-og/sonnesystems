"""API contracts (Pydantic). Kept separate from the DB models on purpose."""
import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class _EmailedModel(BaseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("not a valid email address")
        return v


class RegisterIn(_EmailedModel):
    # Long passphrases beat brittle composition rules; the upper bound also
    # prevents attackers from turning password hashing into a memory/CPU sink.
    password: str = Field(min_length=12, max_length=128)


class LoginIn(_EmailedModel):
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime


class TokenOut(BaseModel):
    token: str
    expires_at: datetime


class ContactIn(_EmailedModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("name", "subject", "message")
    @classmethod
    def _clean_human_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must contain visible text")
        if any(ord(char) < 32 and char not in "\n\r\t" for char in value):
            raise ValueError("contains unsupported control characters")
        return value


class NewsletterIn(_EmailedModel):
    pass


class CreatedOut(BaseModel):
    id: int


class _AeroModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, str_strip_whitespace=True)


class AeroActionIn(_AeroModel):
    type: Literal[
        "add_task",
        "complete_task",
        "add_note",
        "add_doc",
        "log_work",
        "add_goal",
        "add_education",
        "add_project",
    ]
    title: str | None = Field(default=None, max_length=200)
    name: str | None = Field(default=None, max_length=160)
    body: str | None = Field(default=None, max_length=5000)
    text: str | None = Field(default=None, max_length=1000)
    why: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, max_length=2000)
    provider: str | None = Field(default=None, max_length=200)
    kind: str | None = Field(default=None, max_length=60)
    area: str | None = Field(default=None, max_length=60)
    priority: str | None = Field(default=None, max_length=20)
    due: str | None = Field(default=None, max_length=10)
    date: str | None = Field(default=None, max_length=10)
    horizon: str | None = Field(default=None, max_length=10)
    hours: float | None = Field(default=None, ge=0, le=24)

    @model_validator(mode="after")
    def _required_action_value(self) -> "AeroActionIn":
        if self.type in {"add_task", "complete_task", "add_goal", "add_education"} and not self.title:
            raise ValueError(f"{self.type} requires title")
        if self.type in {"add_note", "add_doc"} and not (self.title or self.body):
            raise ValueError(f"{self.type} requires title or body")
        if self.type == "log_work" and not self.text:
            raise ValueError("log_work requires text")
        if self.type == "add_project" and not (self.name or self.title):
            raise ValueError("add_project requires name or title")
        return self


class AeroRunPrepareIn(_AeroModel):
    request_id: str = Field(alias="requestId", min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    intent: str = Field(min_length=1, max_length=1000)
    actions: list[AeroActionIn] = Field(min_length=1, max_length=12)


class AeroApproveIn(_AeroModel):
    contract_digest: str = Field(alias="contractDigest", min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")


class AeroWorkspaceSnapshot(_AeroModel):
    tasks: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)
    notes: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)
    docs: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)
    worklog: list[dict[str, Any]] = Field(default_factory=list, max_length=5000)
    goals: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)
    education: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)
    projects: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)


class AeroLeaseIn(_AeroModel):
    contract_digest: str = Field(alias="contractDigest", min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")
    approval_token: str = Field(alias="approvalToken", min_length=32, max_length=200)
    before_snapshot: AeroWorkspaceSnapshot = Field(alias="beforeSnapshot")


class AeroAttestIn(_AeroModel):
    contract_digest: str = Field(alias="contractDigest", min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")
    lease_token: str = Field(alias="leaseToken", min_length=32, max_length=200)
    after_snapshot: AeroWorkspaceSnapshot = Field(alias="afterSnapshot")


class AeroRecoverIn(_AeroModel):
    contract_digest: str = Field(alias="contractDigest", min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")


class AeroRecoverConfirmIn(_AeroModel):
    contract_digest: str = Field(alias="contractDigest", min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")
    recovery_token: str = Field(alias="recoveryToken", min_length=32, max_length=200)
    restored_snapshot: AeroWorkspaceSnapshot = Field(alias="restoredSnapshot")


class AeroForgetRunIn(_AeroModel):
    contract_digest: str = Field(alias="contractDigest", min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")
