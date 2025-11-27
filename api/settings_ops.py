"""Settings operations for Build Dashboard API"""
import json
import os
import subprocess
import asyncio
from typing import Optional, Dict, Any, List
from pathlib import Path

# Settings file path
SETTINGS_FILE = "/var/www/build/settings.json"

# Default settings for dintrafikskolax
DEFAULT_SETTINGS = {
    "development": {
        "path": "/var/www/dintrafikskolax_dev",
        "git": {
            "remote": "origin",
            "branch": "main",
            "autoDetected": True
        }
    },
    "production": {
        "path": "/var/www/dintrafikskolax_prod",
        "git": {
            "remote": "origin",
            "branch": "main",
            "autoDetected": True
        }
    },
    "database": {
        "useLocalhost": True,
        "host": "localhost",
        "port": 5432,
        "masterUser": "postgres",
        "masterPassword": "",
        "devDatabase": "dintrafikskolax_dev",
        "prodDatabase": "dintrafikskolax_prod",
        "sslMode": "prefer"
    },
    "build": {
        "autoDetect": True,
        "detectedScripts": [],
        "devBuildScript": "npm run build",
        "prodBuildScript": "npm run build",
        "buildDirectory": "",
        "outputDirectory": ".next"
    },
    "pm2": {
        "dev": {
            "name": "dintrafikskolax-dev",
            "mode": "fork",
            "instances": 1,
            "maxMemory": "512M",
            "autoRestart": True,
            "watchEnabled": False
        },
        "prod": {
            "name": "dintrafikskolax-prod",
            "mode": "cluster",
            "instances": 4,
            "maxMemory": "1G",
            "autoRestart": True,
            "watchEnabled": False
        }
    },
    "nginx": {
        "dev": {
            "siteName": "dintrafikskolax-dev",
            "configPath": "/etc/nginx/sites-available/dintrafikskolax-dev",
            "sitesEnabledPath": "/etc/nginx/sites-enabled/dintrafikskolax-dev",
            "serverName": "dev.dintrafikskolahlm.se",
            "port": 3000,
            "sslEnabled": True,
            "sslCertPath": "/etc/letsencrypt/live/dintrafikskolahlm.se/fullchain.pem",
            "sslKeyPath": "/etc/letsencrypt/live/dintrafikskolahlm.se/privkey.pem"
        },
        "prod": {
            "siteName": "dintrafikskolax-prod",
            "configPath": "/etc/nginx/sites-available/dintrafikskolax-prod",
            "sitesEnabledPath": "/etc/nginx/sites-enabled/dintrafikskolax-prod",
            "serverName": "dintrafikskolahlm.se",
            "port": 3001,
            "sslEnabled": True,
            "sslCertPath": "/etc/letsencrypt/live/dintrafikskolahlm.se/fullchain.pem",
            "sslKeyPath": "/etc/letsencrypt/live/dintrafikskolahlm.se/privkey.pem"
        }
    },
    "server": {
        "hostname": "dintrafikskolahlm.se",
        "os": "Ubuntu 22.04",
        "nodeVersion": "",
        "npmVersion": "",
        "pythonVersion": "",
        "lastPackageUpdate": "",
        "autoUpdates": False
    }
}


async def load_settings() -> Dict[str, Any]:
    """Load settings from JSON file, create with defaults if doesn't exist"""
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                settings = json.load(f)
                # Merge with defaults to ensure all keys exist
                return _deep_merge(DEFAULT_SETTINGS.copy(), settings)
        else:
            # Create settings file with defaults
            await save_settings(DEFAULT_SETTINGS)
            return DEFAULT_SETTINGS.copy()
    except Exception as e:
        print(f"Error loading settings: {e}")
        return DEFAULT_SETTINGS.copy()


async def save_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Save settings to JSON file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
        
        return {"success": True, "message": "Settings saved successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _deep_merge(base: Dict, override: Dict) -> Dict:
    """Deep merge two dictionaries"""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


async def get_server_info() -> Dict[str, Any]:
    """Get server information including versions"""
    info = {
        "hostname": "",
        "os": "",
        "nodeVersion": "",
        "npmVersion": "",
        "pythonVersion": "",
        "lastPackageUpdate": ""
    }
    
    try:
        # Get hostname
        result = subprocess.run(["hostname"], capture_output=True, text=True)
        info["hostname"] = result.stdout.strip()
        
        # Get OS info
        result = subprocess.run(["lsb_release", "-d"], capture_output=True, text=True)
        if result.returncode == 0:
            info["os"] = result.stdout.replace("Description:", "").strip()
        else:
            result = subprocess.run(["cat", "/etc/os-release"], capture_output=True, text=True)
            for line in result.stdout.split("\n"):
                if line.startswith("PRETTY_NAME="):
                    info["os"] = line.split("=")[1].strip('"')
                    break
        
        # Get Node.js version
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        info["nodeVersion"] = result.stdout.strip()
        
        # Get npm version
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
        info["npmVersion"] = result.stdout.strip()
        
        # Get Python version
        result = subprocess.run(["python3", "--version"], capture_output=True, text=True)
        info["pythonVersion"] = result.stdout.replace("Python ", "").strip()
        
        # Get last package update time
        if os.path.exists("/var/log/apt/history.log"):
            result = subprocess.run(
                ["stat", "-c", "%y", "/var/log/apt/history.log"],
                capture_output=True, text=True
            )
            info["lastPackageUpdate"] = result.stdout.strip().split(".")[0]
        
    except Exception as e:
        print(f"Error getting server info: {e}")
    
    return info


async def detect_build_scripts(project_path: str) -> Dict[str, Any]:
    """Detect available build scripts from package.json"""
    scripts = []
    try:
        package_json_path = os.path.join(project_path, "package.json")
        
        if os.path.exists(package_json_path):
            with open(package_json_path, 'r') as f:
                package = json.load(f)
                
            if "scripts" in package:
                # Get all scripts that might be build-related
                build_keywords = ["build", "compile", "bundle", "prod", "production", "dist", "export"]
                for script_name in package["scripts"].keys():
                    if any(keyword in script_name.lower() for keyword in build_keywords):
                        scripts.append(script_name)
                    # Also include common ones
                    elif script_name in ["start", "dev", "test", "lint"]:
                        scripts.append(script_name)
        
        return {
            "success": True,
            "scripts": sorted(set(scripts)),
            "path": project_path
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "scripts": []
        }


async def get_pm2_processes() -> Dict[str, Any]:
    """Get list of PM2 processes"""
    try:
        result = subprocess.run(
            ["pm2", "jlist"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            processes = json.loads(result.stdout)
            return {
                "success": True,
                "processes": [
                    {
                        "name": p.get("name"),
                        "pm_id": p.get("pm_id"),
                        "status": p.get("pm2_env", {}).get("status"),
                        "pm2_env": {
                            "exec_mode": p.get("pm2_env", {}).get("exec_mode"),
                            "instances": p.get("pm2_env", {}).get("instances"),
                            "max_memory_restart": p.get("pm2_env", {}).get("max_memory_restart"),
                            "autorestart": p.get("pm2_env", {}).get("autorestart"),
                            "watch": p.get("pm2_env", {}).get("watch"),
                            "cwd": p.get("pm2_env", {}).get("pm_cwd")
                        }
                    }
                    for p in processes
                ]
            }
        else:
            return {
                "success": False,
                "processes": [],
                "error": result.stderr or "No PM2 processes found"
            }
    except Exception as e:
        return {
            "success": False,
            "processes": [],
            "error": str(e)
        }


async def get_nginx_sites() -> Dict[str, Any]:
    """Get list of Nginx sites from sites-available"""
    sites = []
    sites_available_path = "/etc/nginx/sites-available"
    sites_enabled_path = "/etc/nginx/sites-enabled"
    
    try:
        if os.path.exists(sites_available_path):
            for site in os.listdir(sites_available_path):
                if site != "default" and not site.startswith("."):
                    site_info = {
                        "name": site,
                        "enabled": os.path.exists(os.path.join(sites_enabled_path, site)),
                        "configPath": os.path.join(sites_available_path, site)
                    }
                    
                    # Try to parse server_name from config
                    try:
                        with open(site_info["configPath"], 'r') as f:
                            content = f.read()
                            for line in content.split('\n'):
                                line = line.strip()
                                if line.startswith("server_name"):
                                    site_info["serverName"] = line.split()[1].rstrip(';')
                                    break
                    except:
                        pass
                    
                    sites.append(site_info)
        
        return {
            "success": True,
            "sites": [s["name"] for s in sites],
            "siteDetails": sites
        }
    except Exception as e:
        return {
            "success": False,
            "sites": [],
            "error": str(e)
        }


async def apply_pm2_settings(env: str, settings: Dict[str, Any]) -> Dict[str, Any]:
    """Apply PM2 settings for an environment"""
    try:
        process_name = settings.get("name")
        if not process_name:
            return {"success": False, "error": "Process name is required"}
        
        mode = settings.get("mode", "fork")
        instances = settings.get("instances", 1)
        max_memory = settings.get("maxMemory", "512M")
        
        # Build PM2 restart command with new settings
        cmd = ["pm2", "restart", process_name]
        
        if mode == "cluster":
            cmd.extend(["-i", str(instances)])
        
        cmd.extend(["--max-memory-restart", max_memory])
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            # Save the PM2 configuration
            subprocess.run(["pm2", "save"], capture_output=True)
            return {
                "success": True,
                "message": f"PM2 settings applied for {process_name}"
            }
        else:
            return {
                "success": False,
                "error": result.stderr or "Failed to apply PM2 settings"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def restart_pm2_with_settings(env: str) -> Dict[str, Any]:
    """Restart PM2 process using saved settings"""
    try:
        settings = await load_settings()
        pm2_config = settings.get("pm2", {}).get(env, {})
        
        if not pm2_config.get("name"):
            return {"success": False, "error": f"No PM2 process configured for {env}"}
        
        process_name = pm2_config["name"]
        mode = pm2_config.get("mode", "fork")
        instances = pm2_config.get("instances", 1)
        max_memory = pm2_config.get("maxMemory", "512M")
        
        # Stop current process
        subprocess.run(["pm2", "stop", process_name], capture_output=True)
        
        # Delete and restart with new settings
        subprocess.run(["pm2", "delete", process_name], capture_output=True)
        
        # Get the working directory from settings
        app_settings = settings.get("development" if env == "dev" else "production", {})
        cwd = app_settings.get("path", f"/var/www/dintrafikskolax_{env}")
        
        # Start with appropriate mode
        if mode == "cluster":
            cmd = ["pm2", "start", "npm", "--name", process_name, "-i", str(instances),
                   "--max-memory-restart", max_memory, "--", "start"]
        else:
            cmd = ["pm2", "start", "npm", "--name", process_name,
                   "--max-memory-restart", max_memory, "--", "start"]
        
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
        
        if result.returncode == 0:
            subprocess.run(["pm2", "save"], capture_output=True)
            return {
                "success": True,
                "message": f"PM2 process {process_name} restarted with {mode} mode"
            }
        else:
            return {
                "success": False,
                "error": result.stderr or "Failed to restart PM2 process"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def reload_nginx() -> Dict[str, Any]:
    """Reload Nginx configuration"""
    try:
        # Test config first
        test_result = subprocess.run(
            ["nginx", "-t"],
            capture_output=True,
            text=True
        )
        
        if test_result.returncode != 0:
            return {
                "success": False,
                "error": f"Nginx config test failed: {test_result.stderr}"
            }
        
        # Reload nginx
        result = subprocess.run(
            ["systemctl", "reload", "nginx"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return {"success": True, "message": "Nginx reloaded successfully"}
        else:
            return {"success": False, "error": result.stderr}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def test_database_connection(db_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Test database connection with given settings"""
    try:
        import psycopg2
        
        host = "localhost" if db_settings.get("useLocalhost") else db_settings.get("host", "localhost")
        port = db_settings.get("port", 5432)
        user = db_settings.get("masterUser", "postgres")
        password = db_settings.get("masterPassword", "")
        database = db_settings.get("devDatabase", "postgres")
        
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            connect_timeout=5
        )
        conn.close()
        
        return {
            "success": True,
            "message": f"Successfully connected to {database} on {host}:{port}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def get_build_status_for_settings() -> Dict[str, Any]:
    """Get current build status for dashboard"""
    try:
        # Check if there's an active build
        status_file = "/var/www/build/status/current_build.json"
        if os.path.exists(status_file):
            with open(status_file, 'r') as f:
                return json.load(f)
        return {"status": "idle"}
    except:
        return {"status": "unknown"}


async def read_database_from_env(project_path: str) -> Dict[str, Any]:
    """Read database configuration from .env files in the project"""
    result = {
        "database": "",
        "host": "localhost",
        "port": 5432,
        "user": "",
        "password": "",
        "sslMode": "prefer",
        "source": None,
        "raw_url": ""
    }
    
    # List of env files to check in order of priority
    env_files = [".env.local", ".env.production.local", ".env.development.local", ".env"]
    
    for env_file in env_files:
        env_path = os.path.join(project_path, env_file)
        if os.path.exists(env_path):
            try:
                with open(env_path, 'r') as f:
                    content = f.read()
                
                # Look for DATABASE_URL
                for line in content.split('\n'):
                    line = line.strip()
                    if line.startswith('DATABASE_URL=') or line.startswith('DATABASE_URL ='):
                        url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        result["raw_url"] = url
                        result["source"] = env_file
                        
                        # Parse PostgreSQL URL: postgres://user:pass@host:port/database?sslmode=xxx
                        if url.startswith('postgres://') or url.startswith('postgresql://'):
                            url = url.replace('postgres://', '').replace('postgresql://', '')
                            
                            # Extract sslmode from query string
                            if '?' in url:
                                url_part, query = url.split('?', 1)
                                for param in query.split('&'):
                                    if param.startswith('sslmode='):
                                        result["sslMode"] = param.split('=')[1]
                            else:
                                url_part = url
                            
                            # Parse user:pass@host:port/database
                            if '@' in url_part:
                                auth, hostdb = url_part.split('@', 1)
                                if ':' in auth:
                                    result["user"], result["password"] = auth.split(':', 1)
                                else:
                                    result["user"] = auth
                                
                                if '/' in hostdb:
                                    hostport, result["database"] = hostdb.split('/', 1)
                                    if ':' in hostport:
                                        result["host"], port_str = hostport.split(':', 1)
                                        result["port"] = int(port_str)
                                    else:
                                        result["host"] = hostport
                        
                        return result
                        
            except Exception as e:
                print(f"Error reading {env_path}: {e}")
                continue
    
    return result


async def list_available_databases(host: str = "localhost", port: int = 5432, 
                                    user: str = "postgres", password: str = "") -> Dict[str, Any]:
    """List all available PostgreSQL databases"""
    try:
        import psycopg2
        
        # Connect to default 'postgres' database to list others
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database="postgres",
            connect_timeout=5
        )
        
        cursor = conn.cursor()
        cursor.execute("""
            SELECT datname FROM pg_database 
            WHERE datistemplate = false 
            AND datname != 'postgres'
            ORDER BY datname
        """)
        
        databases = [row[0] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "databases": databases
        }
    except Exception as e:
        return {
            "success": False,
            "databases": [],
            "error": str(e)
        }


async def read_env_database_settings(dev_path: str, prod_path: str) -> Dict[str, Any]:
    """Read database settings from both dev and prod .env files"""
    dev_config = await read_database_from_env(dev_path)
    prod_config = await read_database_from_env(prod_path)
    
    return {
        "dev": {
            "database": dev_config.get("database", ""),
            "host": dev_config.get("host", "localhost"),
            "port": dev_config.get("port", 5432),
            "user": dev_config.get("user", ""),
            "sslMode": dev_config.get("sslMode", "prefer"),
            "source": dev_config.get("source"),
            "hasConfig": bool(dev_config.get("database"))
        },
        "prod": {
            "database": prod_config.get("database", ""),
            "host": prod_config.get("host", "localhost"),
            "port": prod_config.get("port", 5432),
            "user": prod_config.get("user", ""),
            "sslMode": prod_config.get("sslMode", "prefer"),
            "source": prod_config.get("source"),
            "hasConfig": bool(prod_config.get("database"))
        }
    }


async def scan_all_env_databases(project_path: str) -> Dict[str, Any]:
    """Scan ALL .env* files in a project directory for DATABASE_URL strings"""
    import glob
    
    databases = []
    seen_urls = set()  # Track unique URLs
    
    # Find all .env* files
    env_pattern = os.path.join(project_path, ".env*")
    env_files = glob.glob(env_pattern)
    
    # Also check subdirectories one level deep
    subdir_pattern = os.path.join(project_path, "*/.env*")
    env_files.extend(glob.glob(subdir_pattern))
    
    for env_path in sorted(env_files):
        # Skip backup directories
        if '-backups' in env_path or '.backup' in env_path:
            continue
            
        try:
            with open(env_path, 'r') as f:
                content = f.read()
            
            # Get relative path for display
            rel_path = os.path.basename(env_path)
            
            # Look for DATABASE_URL
            for line in content.split('\n'):
                line = line.strip()
                if line.startswith('#'):
                    continue
                if line.startswith('DATABASE_URL=') or line.startswith('DATABASE_URL ='):
                    url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    
                    # Skip empty URLs
                    if not url:
                        continue
                    
                    # Parse the URL to get display info
                    db_info = parse_database_url(url)
                    
                    # Create unique key to avoid duplicates
                    unique_key = f"{db_info['database']}@{db_info['host']}:{db_info['port']}"
                    
                    if unique_key not in seen_urls:
                        seen_urls.add(unique_key)
                        databases.append({
                            "url": url,
                            "database": db_info["database"],
                            "user": db_info["user"],
                            "host": db_info["host"],
                            "port": db_info["port"],
                            "sslMode": db_info["sslMode"],
                            "source": rel_path,
                            "display": f"{db_info['database']} ({db_info['user']}@{db_info['host']}:{db_info['port']}) - from {rel_path}"
                        })
                    else:
                        # Add source to existing entry
                        for db in databases:
                            if f"{db['database']}@{db['host']}:{db['port']}" == unique_key:
                                if rel_path not in db['source']:
                                    db['source'] += f", {rel_path}"
                                    db['display'] = f"{db['database']} ({db['user']}@{db['host']}:{db['port']}) - from {db['source']}"
                                break
                        
        except Exception as e:
            print(f"Error reading {env_path}: {e}")
            continue
    
    return {
        "success": True,
        "databases": databases,
        "count": len(databases),
        "scanned_path": project_path
    }


def parse_database_url(url: str) -> Dict[str, Any]:
    """Parse a PostgreSQL connection URL into components"""
    result = {
        "database": "",
        "host": "localhost",
        "port": 5432,
        "user": "",
        "password": "",
        "sslMode": "prefer"
    }
    
    if not url:
        return result
    
    if url.startswith('postgres://') or url.startswith('postgresql://'):
        url = url.replace('postgres://', '').replace('postgresql://', '')
        
        # Extract sslmode from query string
        if '?' in url:
            url_part, query = url.split('?', 1)
            for param in query.split('&'):
                if param.startswith('sslmode='):
                    result["sslMode"] = param.split('=')[1]
        else:
            url_part = url
        
        # Parse user:pass@host:port/database
        if '@' in url_part:
            auth, hostdb = url_part.split('@', 1)
            if ':' in auth:
                result["user"], result["password"] = auth.split(':', 1)
            else:
                result["user"] = auth
            
            if '/' in hostdb:
                hostport, result["database"] = hostdb.split('/', 1)
                # Remove any query params from database name
                if '?' in result["database"]:
                    result["database"] = result["database"].split('?')[0]
                if ':' in hostport:
                    result["host"], port_str = hostport.split(':', 1)
                    try:
                        result["port"] = int(port_str)
                    except:
                        result["port"] = 5432
                else:
                    result["host"] = hostport
    
    return result
