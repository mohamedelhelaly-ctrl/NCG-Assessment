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
    public_api_url: str = "http://localhost:8000"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_url: str = ""

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
