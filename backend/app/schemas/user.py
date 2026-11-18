from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints, field_validator

from app.core.security import MAX_PASSWORD_BYTES

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


def _check_password(value: str) -> str:
    if len(value) < 10:
        raise ValueError("Password must be at least 10 characters")
    if len(value.encode()) > MAX_PASSWORD_BYTES:
        raise ValueError("Password is too long (72 bytes at most)")
    return value


class RegisterIn(BaseModel):
    full_name: Name
    email: EmailStr
    password: str

    _password = field_validator("password")(_check_password)


class LoginIn(BaseModel):
    # Deliberately lenient: a malformed email simply fails to match an account.
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=254)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=200)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
