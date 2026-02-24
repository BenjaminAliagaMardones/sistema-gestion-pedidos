from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/shoper_db"

    # JWT
    JWT_SECRET: str = "super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # App
    APP_NAME: str = "Sistema Shoper"
    DEBUG: bool = False

    # Admin user (se crea automáticamente al iniciar)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "shoper2024"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
