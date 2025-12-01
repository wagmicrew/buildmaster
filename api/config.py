"""Configuration management for Build Dashboard API"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )
    
    # API Configuration
    BUILD_API_PORT: int = 8889
    BUILD_API_HOST: str = "127.0.0.1"
    
    # Security
    OTP_SECRET_KEY: str = ""
    SESSION_SECRET: str = ""
    ALLOWED_EMAIL: str = "johaswe@gmail.com"
    OTP_EXPIRY_MINUTES: int = 10
    SESSION_EXPIRY_HOURS: int = 24
    
    # Directories
    DEV_DIR: str = "/var/www/dintrafikskolax_dev"
    PROD_DIR: str = "/var/www/dintrafikskolax_prod"
    APP_DIR: str = "/var/www/dintrafikskolax_app"
    
    # PM2 Configuration
    PM2_DEV_APP: str = "dintrafikskolax-dev"
    PM2_PROD_APP: str = "dintrafikskolax-prod"
    PM2_APP_APP: str = "dintrafikskolax-app"
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # SMTP Configuration (will be loaded from site_settings or .env)
    SMTP_HOST: str = "127.0.0.1"
    SMTP_PORT: int = 25
    SMTP_SECURE: bool = False
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM_EMAIL: str = "noreply@dintrafikskolahlm.se"
    SMTP_FROM_NAME: str = "Build Dashboard"
    
    # Build Configuration
    BUILD_LOG_DIR: str = "/var/www/build/logs/builds"
    BUILD_DATA_DIR: str = "/var/www/build/data"
    
    # Rate Limiting
    OTP_RATE_LIMIT_PER_15MIN: int = 3


# Global settings instance
settings = Settings()

# Ensure directories exist
Path(settings.BUILD_LOG_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.BUILD_DATA_DIR).mkdir(parents=True, exist_ok=True)


def get_environment_directory(environment: str) -> str:
    """Get the directory path for the given environment.
    
    Args:
        environment: Environment name ('dev', 'prod', or 'app')
        
    Returns:
        Directory path for the environment
        
    Raises:
        ValueError: If environment is not one of 'dev', 'prod', or 'app'
    """
    env_map = {
        "dev": settings.DEV_DIR,
        "prod": settings.PROD_DIR,
        "app": settings.APP_DIR,
    }
    
    if environment not in env_map:
        raise ValueError(f"Invalid environment '{environment}'. Must be one of: dev, prod, app")
    
    return env_map[environment]


def get_pm2_app_name(environment: str) -> str:
    """Get the PM2 app name for the given environment.
    
    Args:
        environment: Environment name ('dev', 'prod', or 'app')
        
    Returns:
        PM2 app name for the environment
        
    Raises:
        ValueError: If environment is not one of 'dev', 'prod', or 'app'
    """
    env_map = {
        "dev": settings.PM2_DEV_APP,
        "prod": settings.PM2_PROD_APP,
        "app": settings.PM2_APP_APP,
    }
    
    if environment not in env_map:
        raise ValueError(f"Invalid environment '{environment}'. Must be one of: dev, prod, app")
    
    return env_map[environment]

