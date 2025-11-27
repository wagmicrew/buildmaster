"""Database selector - manage selected databases for dev/prod environments"""
import json
import os
from pathlib import Path
from typing import Dict, Optional
from config import settings

SELECTOR_CONFIG_PATH = "/var/www/build/database_selector.json"


def get_selector_config() -> Dict:
    """Get database selector configuration from JSON file."""
    default_config = {
        "dev": {
            "database_url": None,
            "database_name": None,
            "username": None,
            "host": "127.0.0.1",
            "port": 5432
        },
        "prod": {
            "database_url": None,
            "database_name": None,
            "username": None,
            "host": "127.0.0.1",
            "port": 5432
        }
    }
    
    if os.path.exists(SELECTOR_CONFIG_PATH):
        try:
            with open(SELECTOR_CONFIG_PATH, 'r') as f:
                config = json.load(f)
                # Merge with defaults to ensure all keys exist
                for env in ["dev", "prod"]:
                    if env not in config:
                        config[env] = default_config[env]
                    else:
                        config[env] = {**default_config[env], **config[env]}
                return config
        except Exception as e:
            # If file is corrupted, return defaults
            return default_config
    else:
        # Create file with defaults
        os.makedirs(os.path.dirname(SELECTOR_CONFIG_PATH), exist_ok=True)
        with open(SELECTOR_CONFIG_PATH, 'w') as f:
            json.dump(default_config, f, indent=2)
        return default_config


def save_selector_config(config: Dict) -> bool:
    """Save database selector configuration to JSON file."""
    try:
        os.makedirs(os.path.dirname(SELECTOR_CONFIG_PATH), exist_ok=True)
        with open(SELECTOR_CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        return False


def set_selected_database(environment: str, database_url: str) -> Dict:
    """Set selected database for an environment."""
    from urllib.parse import urlparse, urlunparse
    
    result = {
        "success": False,
        "environment": environment,
        "error": None
    }
    
    if environment not in ["dev", "prod"]:
        result["error"] = "Invalid environment. Use 'dev' or 'prod'"
        return result
    
    try:
        config = get_selector_config()
        parsed = urlparse(database_url)
        
        # Convert localhost to 127.0.0.1 to avoid IPv6 issues
        hostname = parsed.hostname or "127.0.0.1"
        if hostname == "localhost":
            hostname = "127.0.0.1"
        
        # Reconstruct URL with 127.0.0.1
        port = parsed.port or 5432
        if parsed.password:
            new_netloc = f"{parsed.username}:{parsed.password}@127.0.0.1:{port}"
        elif parsed.username:
            new_netloc = f"{parsed.username}@127.0.0.1:{port}"
        else:
            new_netloc = f"127.0.0.1:{port}"
        
        normalized_url = urlunparse((
            parsed.scheme,
            new_netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
        
        config[environment] = {
            "database_url": normalized_url,
            "database_name": parsed.path.lstrip("/") if parsed.path else None,
            "username": parsed.username,
            "host": "127.0.0.1",
            "port": port
        }
        
        if save_selector_config(config):
            result["success"] = True
        else:
            result["error"] = "Failed to save configuration"
            
    except Exception as e:
        result["error"] = str(e)
    
    return result


def get_selected_database(environment: str) -> Optional[Dict]:
    """Get selected database for an environment."""
    if environment not in ["dev", "prod"]:
        return None
    
    config = get_selector_config()
    return config.get(environment)


async def list_available_databases(environment: str) -> Dict:
    """List all available databases from .env files for an environment."""
    from troubleshooting_ops import get_env_database_config
    from urllib.parse import urlparse
    
    result = {
        "environment": environment,
        "databases": [],
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        for file_info in config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                db_url = file_info["database_url"]
                parsed = urlparse(db_url)
                
                result["databases"].append({
                    "source_file": file_info.get("name"),
                    "database_url": db_url,
                    "database_name": parsed.path.lstrip("/") if parsed.path else None,
                    "username": parsed.username,
                    "host": parsed.hostname or "127.0.0.1",
                    "port": parsed.port or 5432
                })
    except Exception as e:
        result["error"] = str(e)
    
    return result

