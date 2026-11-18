from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql://shop:shop@localhost:5433/shop"
    jwt_secret: str = "dev-only-secret"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"
    cors_origin_regex: str = ""

    first_admin_email: str = ""
    first_admin_password: str = ""
    seed_demo: bool = False
    demo_password: str = ""

    storage_backend: str = "local"
    uploads_dir: str = "uploads"
    public_api_url: str = "http://localhost:8000"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_url: str = ""

    @property
    def r2_configured(self) -> bool:
        return all(
            [
                self.r2_account_id,
                self.r2_access_key_id,
                self.r2_secret_access_key,
                self.r2_bucket,
                self.r2_public_url,
            ]
        )

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_settings(settings: Settings) -> None:
    """Refuse to start with an unsafe or incomplete configuration."""
    if settings.is_production and (
        settings.jwt_secret.startswith(("dev-only", "change-me")) or len(settings.jwt_secret) < 32
    ):
        raise RuntimeError("JWT_SECRET must be set to a random value of at least 32 characters")
    if settings.storage_backend not in ("local", "r2"):
        raise RuntimeError("STORAGE_BACKEND must be 'local' or 'r2'")
    if settings.is_production and settings.storage_backend != "r2":
        raise RuntimeError(
            "Production requires STORAGE_BACKEND=r2 (local disks are wiped on deploy)"
        )
    if settings.storage_backend == "r2" and not settings.r2_configured:
        raise RuntimeError(
            "STORAGE_BACKEND=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "
            "R2_BUCKET and R2_PUBLIC_URL"
        )
