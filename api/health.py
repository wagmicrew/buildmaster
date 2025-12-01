"""Health check operations for server, database, and environment"""
import psutil
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
import subprocess
from pathlib import Path
from config import settings
from models import (
    ServerHealthResponse,
    DatabaseHealthResponse,
    RedisHealthResponse,
    EnvironmentHealthResponse
)
from pm2_ops import is_pm2_running

# Settings file path
SETTINGS_FILE = "/var/www/build/settings.json"


def get_database_url_from_env(project_path: str, env: str = "dev") -> Optional[str]:
    """Read DATABASE_URL from .env files in the project"""
    # Order of preference for env files
    if env == "prod":
        env_files = [".env.local", ".env.production.local", ".env.production", ".env"]
    else:
        env_files = [".env.local", ".env.development.local", ".env.development", ".env"]
    
    for env_file in env_files:
        env_path = os.path.join(project_path, env_file)
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        # Skip comments and empty lines
                        if not line or line.startswith('#'):
                            continue
                        if line.startswith('DATABASE_URL=') or line.startswith('DATABASE_URL ='):
                            # Handle various quote styles and potential inline comments
                            url = line.split('=', 1)[1].strip()
                            # Remove surrounding quotes
                            if (url.startswith('"') and url.endswith('"')) or \
                               (url.startswith("'") and url.endswith("'")):
                                url = url[1:-1]
                            # Remove inline comments
                            if ' #' in url:
                                url = url.split(' #')[0].strip()
                            return url
            except Exception as e:
                print(f"Error reading {env_path}: {e}")
                continue
    return None


def load_settings_sync() -> Dict[str, Any]:
    """Synchronously load settings from JSON file"""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}


async def check_database_health_for_env(env: str = "dev") -> Dict[str, Any]:
    """Check database health for a specific environment using settings/env"""
    try:
        import time
        import psycopg2
        
        start_time = time.time()
        
        # Try to get database URL from settings or .env
        app_settings = load_settings_sync()
        project_path = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        
        # First try to get from .env files in the project
        database_url = get_database_url_from_env(project_path, env)
        
        if not database_url:
            # Fallback to building URL from settings.json
            db_settings = app_settings.get("database", {})
            host = "localhost" if db_settings.get("useLocalhost", True) else db_settings.get("host", "localhost")
            port = db_settings.get("port", 5432)
            user = db_settings.get("masterUser", "postgres")
            password = db_settings.get("masterPassword", "")
            database = db_settings.get("devDatabase" if env == "dev" else "prodDatabase", "")
            ssl_mode = db_settings.get("sslMode", "prefer")
            
            if not database:
                return {
                    "status": "disconnected",
                    "response_time": "N/A",
                    "error": "No database configured"
                }
            
            if password:
                database_url = f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode={ssl_mode}"
            else:
                database_url = f"postgresql://{user}@{host}:{port}/{database}?sslmode={ssl_mode}"
        
        # Test connection
        conn = psycopg2.connect(database_url, connect_timeout=5)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        
        response_time = (time.time() - start_time) * 1000
        
        # Extract database name from URL for display
        db_name = "unknown"
        try:
            if "/" in database_url:
                db_name = database_url.split("/")[-1].split("?")[0]
        except:
            pass
        
        return {
            "status": "connected",
            "response_time": f"{response_time:.1f}ms",
            "database": db_name,
            "env": env
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "response_time": "N/A",
            "error": str(e),
            "env": env,
            "path_checked": project_path
        }


async def get_server_health(env: str = "dev") -> ServerHealthResponse:
    """Get server health metrics including database status"""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        uptime = datetime.utcnow().timestamp() - psutil.boot_time()
        
        return ServerHealthResponse(
            cpu_percent=cpu_percent,
            memory_total=memory.total,
            memory_available=memory.available,
            memory_percent=memory.percent,
            disk_total=disk.total,
            disk_free=disk.free,
            disk_percent=disk.percent,
            uptime=uptime,
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        # Return error response
        return ServerHealthResponse(
            cpu_percent=0.0,
            memory_total=0,
            memory_available=0,
            memory_percent=0.0,
            disk_total=0,
            disk_free=0,
            disk_percent=0.0,
            uptime=0.0,
            timestamp=datetime.utcnow()
        )


async def get_database_health() -> DatabaseHealthResponse:
    """Get database connection health"""
    if not settings.DATABASE_URL:
        return DatabaseHealthResponse(
            connected=False,
            error="DATABASE_URL not configured",
            timestamp=datetime.utcnow()
        )
    
    start_time = datetime.utcnow()
    
    try:
        import time
        import psycopg2
        
        # Try to connect to database
        conn = psycopg2.connect(settings.DATABASE_URL)
        cursor = conn.cursor()
        
        # Basic connection test
        cursor.execute("SELECT 1")
        
        # Get database version
        cursor.execute("SELECT version()")
        db_version = cursor.fetchone()[0]
        
        # Get database size
        cursor.execute("""
            SELECT pg_database_size(current_database())
        """)
        db_size = cursor.fetchone()[0]
        
        # Get number of connections
        cursor.execute("""
            SELECT count(*) FROM pg_stat_activity
        """)
        connection_count = cursor.fetchone()[0]
        
        # Get number of tables
        cursor.execute("""
            SELECT count(*) FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        table_count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        end_time = datetime.utcnow()
        response_time = (end_time - start_time).total_seconds() * 1000
        
        return DatabaseHealthResponse(
            connected=True,
            response_time_ms=response_time,
            error=None,
            timestamp=datetime.utcnow(),
            version=db_version.split(',')[0] if db_version else None,
            size_bytes=db_size,
            connection_count=connection_count,
            table_count=table_count
        )
    except Exception as e:
        end_time = datetime.utcnow()
        response_time = (end_time - start_time).total_seconds() * 1000
        
        return DatabaseHealthResponse(
            connected=False,
            response_time_ms=response_time,
            error=str(e),
            timestamp=datetime.utcnow()
        )


async def get_redis_health() -> RedisHealthResponse:
    """Get Redis connection health"""
    try:
        import time
        import redis
        
        start_time = time.time()
        
        # Try to connect to Redis (default localhost:6379)
        r = redis.Redis(host='localhost', port=6379, db=0, socket_connect_timeout=2)
        r.ping()
        r.close()
        
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return RedisHealthResponse(
            connected=True,
            response_time_ms=response_time,
            timestamp=datetime.utcnow()
        )
    except Exception as e:
        return RedisHealthResponse(
            connected=False,
            error=str(e),
            timestamp=datetime.utcnow()
        )


async def get_environment_health() -> EnvironmentHealthResponse:
    """Get environment health status"""
    from config import get_environment_directory, get_pm2_app_name
    
    dev_dir = Path(settings.DEV_DIR)
    prod_dir = Path(settings.PROD_DIR)
    app_dir = Path(settings.APP_DIR)
    
    # Check if directories exist
    dev_env_exists = dev_dir.exists() and (dev_dir / ".env.local").exists()
    prod_env_exists = prod_dir.exists() and (prod_dir / ".env.production").exists()
    app_env_exists = app_dir.exists() and (app_dir / ".env.local").exists()
    
    # Check PM2 processes
    pm2_dev_running = is_pm2_running(settings.PM2_DEV_APP)
    pm2_prod_running = is_pm2_running(settings.PM2_PROD_APP)
    pm2_app_running = is_pm2_running(settings.PM2_APP_APP)
    
    # Check git repo status
    git_repo_status = "unknown"
    if dev_dir.exists():
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(dev_dir),
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                if result.stdout.strip():
                    git_repo_status = "dirty"
                else:
                    git_repo_status = "clean"
        except:
            git_repo_status = "error"
    
    return EnvironmentHealthResponse(
        dev_env_exists=dev_env_exists,
        prod_env_exists=prod_env_exists,
        app_env_exists=app_env_exists,
        pm2_dev_running=pm2_dev_running,
        pm2_prod_running=pm2_prod_running,
        pm2_app_running=pm2_app_running,
        git_repo_status=git_repo_status,
        timestamp=datetime.utcnow()
    )

