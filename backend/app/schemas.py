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
    password: str = Field(min_length=8, max_length=200)


class LoginIn(_EmailedModel):
    password: str = Field(min_length=1, max_length=200)


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


class NewsletterIn(_EmailedModel):
    pass


class CreatedOut(BaseModel):
    id: int
