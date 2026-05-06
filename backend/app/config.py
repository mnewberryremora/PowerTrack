from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://training:training_secret@postgres:5432/training_app"
    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-4-1-fast-reasoning"
    ai_monthly_token_limit: int = 100000  # default per-user monthly limit

    class Config:
        env_file = ".env"

    def model_post_init(self, __context) -> None:
        # Railway's ${{Postgres.DATABASE_URL}} resolves to postgresql://...
        # but SQLAlchemy needs postgresql+asyncpg:// for the async driver.
        if self.database_url.startswith("postgresql://"):
            self.database_url = "postgresql+asyncpg://" + self.database_url[len("postgresql://"):]


settings = Settings()
