from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    # Database - SQLite for Lambda, PostgreSQL for local development
    database_url: str = "sqlite:///./call-assistant.db"
    
    # Twilio - optional for now
    twilio_account_sid: str = "placeholder"
    twilio_auth_token: str = "placeholder"
    
    # OpenAI - optional for now
    openai_api_key: str = "placeholder"
    
    # JWT - with default for Lambda
    jwt_secret_key: str = "default-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Environment
    environment: str = "development"
    
    # CORS - Allow all origins for now
    cors_origins: List[str] = ["*"]
    
    webhook_base_url: str
    
    # Email configuration
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    frontend_url: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"


settings = Settings() 