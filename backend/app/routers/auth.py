from fastapi import APIRouter, Depends, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import conflict, unauthorized
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    hash_password_async,
    verify_password_async,
)
from app.crud.user import user_crud
from app.database import get_db
from app.deps import get_current_user, no_store
from app.models.user import User
from app.schemas.user import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(no_store)])


def _token_for(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """Always creates a customer. Admins are only ever seeded."""
    email_taken = conflict("email_taken", "An account with this email already exists")
    if await user_crud.get_by_email(db, body.email):
        raise email_taken
    password_hash = await hash_password_async(body.password)
    try:
        user = await user_crud.create(
            db, email=body.email, full_name=body.full_name, password_hash=password_hash
        )
        await db.commit()
    except IntegrityError:  # two simultaneous sign-ups with the same email
        await db.rollback()
        raise email_taken from None
    return _token_for(user)


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = await user_crud.get_by_email(db, body.email)
    password_ok = await verify_password_async(body.password, user.password_hash if user else None)
    # One generic error for unknown email, wrong password and disabled account.
    if not (user and password_ok and user.is_active):
        raise unauthorized("Incorrect email or password", "invalid_credentials")
    return _token_for(user)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
