"""API contracts (Pydantic). Kept separate from the DB models on purpose."""
import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
