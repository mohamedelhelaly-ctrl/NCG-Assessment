"""One error shape for the whole API: {"error": {"code", "message", "fields", "params"}}."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        fields: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or {}
        self.params = params or {}
        self.headers = headers


def unauthorized(message: str = "Authentication required", code: str = "unauthorized") -> AppError:
    return AppError(401, code, message, headers={"WWW-Authenticate": "Bearer"})


def forbidden(message: str = "You do not have access to this resource") -> AppError:
    return AppError(403, "forbidden", message)


def not_found(message: str = "Not found") -> AppError:
    return AppError(404, "not_found", message)


def conflict(code: str, message: str, params: dict[str, Any] | None = None) -> AppError:
    return AppError(409, code, message, params=params)


def error_response(error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        headers=error.headers,
        content={
            "error": {
                "code": error.code,
                "message": error.message,
                "fields": error.fields,
                "params": error.params,
            }
        },
    )


_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    429: "rate_limited",
}


def _field_name(loc: tuple) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts) or "_"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        fields: dict[str, str] = {}
        for err in jsonable_encoder(exc.errors()):
            fields.setdefault(
                _field_name(tuple(err["loc"])), err["msg"].removeprefix("Value error, ")
            )
        return error_response(AppError(422, "validation_error", "Some fields are invalid", fields))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = _STATUS_CODES.get(exc.status_code, "http_error")
        return error_response(AppError(exc.status_code, code, str(exc.detail), headers=exc.headers))

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, __: RateLimitExceeded):
        return error_response(
            AppError(429, "rate_limited", "Too many requests, please try again later")
        )
