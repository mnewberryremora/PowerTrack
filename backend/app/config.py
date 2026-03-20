from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://training:training_secret@postgres:5432/training_app"
    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-4-1-fast-reasoning"

    class Config:
        env_file = ".env"


settings = Settings()
