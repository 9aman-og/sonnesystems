"""Contact messages and newsletter signups."""
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ContactMessage, NewsletterSignup
from ..schemas import ContactIn, CreatedOut, NewsletterIn

router = APIRouter(tags=["contact"])


@router.post("/contact", response_model=CreatedOut, status_code=status.HTTP_201_CREATED)
def contact(body: ContactIn, db: Session = Depends(get_db)) -> CreatedOut:
    msg = ContactMessage(
        name=body.name, email=body.email, subject=body.subject, message=body.message
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return CreatedOut(id=msg.id)


@router.post("/newsletter", response_model=CreatedOut, status_code=status.HTTP_201_CREATED)
def newsletter(body: NewsletterIn, response: Response, db: Session = Depends(get_db)) -> CreatedOut:
    existing = db.scalar(select(NewsletterSignup).where(NewsletterSignup.email == body.email))
    if existing:  # idempotent: signing up twice is fine, not an error
        response.status_code = status.HTTP_200_OK
        return CreatedOut(id=existing.id)
    row = NewsletterSignup(email=body.email)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:  # idempotent even if two workers insert together
        db.rollback()
        existing = db.scalar(select(NewsletterSignup).where(NewsletterSignup.email == body.email))
        response.status_code = status.HTTP_200_OK
        return CreatedOut(id=existing.id)
    db.refresh(row)
    return CreatedOut(id=row.id)
