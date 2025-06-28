from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    # Database - using your system user with PostgreSQL
    database_url: str = "postgresql://postgres:postgres@localhost:5432/call-assistant"
    
    # Twilio - required from environment variables
    twilio_account_sid: str
    twilio_auth_token: str
    
    # OpenAI - required from environment variable
    openai_api_key: str
    
    # JWT - required from environment variable
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Environment
    environment: str = "development"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]
    
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