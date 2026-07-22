"""Email + password auth with hashed bearer tokens."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import config, security
from ..db import get_db
from ..models import AuthToken, User, utcnow
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> tuple[User, AuthToken]:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    token = db.scalar(
        select(AuthToken).where(AuthToken.token_hash == security.hash_token(creds.credentials))
    )
    if token is None:
        raise unauthorized
    if token.expires_at < utcnow():
        db.delete(token)
        db.commit()
        raise unauthorized
    user = db.get(User, token.user_id)
    if user is None:
        raise unauthorized
    return user, token


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)) -> User:
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=body.email, password_hash=security.hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # closes the race between the pre-check and INSERT
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        ) from None
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == body.email))
    # Always perform one full password derivation. This keeps the generic error
    # generic in timing as well as wording, reducing account enumeration risk.
    stored_hash = user.password_hash if user else security.dummy_password_hash()
    password_ok = security.verify_password(body.password, stored_hash)
    if user is None or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if security.password_needs_rehash(user.password_hash):
        user.password_hash = security.hash_password(body.password)
    # Opportunistically clear this user's expired sessions before issuing one.
    db.execute(delete(AuthToken).where(AuthToken.user_id == user.id, AuthToken.expires_at < utcnow()))
    raw, token_hash = security.new_token()
    token = AuthToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=utcnow() + timedelta(days=config.TOKEN_TTL_DAYS),
    )
    db.add(token)
    db.commit()
    return TokenOut(token=raw, expires_at=token.expires_at)


@router.get("/me", response_model=UserOut)
def me(auth: tuple[User, AuthToken] = Depends(current_user)) -> User:
    return auth[0]


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    auth: tuple[User, AuthToken] = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    db.delete(auth[1])
    db.commit()
