"""Troubleshooting operations for system diagnostics and maintenance"""
import subprocess
import os
import json
import redis
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from urllib.parse import urlparse, urlunparse
from config import settings


def convert_db_url_to_localhost(db_url: str) -> str:
    """
    Convert DATABASE_URL to use 127.0.0.1 instead of hostname.
    This ensures all database connections use IPv4 localhost for local PostgreSQL instances.
    Using 127.0.0.1 instead of localhost avoids IPv6 (::1) connection issues.
    """
    if not db_url:
        return db_url
    
    parsed = urlparse(db_url)
    
    # If already 127.0.0.1, return as-is
    if parsed.hostname == "127.0.0.1":
        return db_url
    
    # Build new netloc with 127.0.0.1 (IPv4) to avoid IPv6 issues
    port = parsed.port or 5432
    if parsed.password:
        new_netloc = f"{parsed.username}:{parsed.password}@127.0.0.1:{port}"
    elif parsed.username:
        new_netloc = f"{parsed.username}@127.0.0.1:{port}"
    else:
        new_netloc = f"127.0.0.1:{port}"
    
    # Reconstruct URL with 127.0.0.1
    return urlunparse((
        parsed.scheme,
        new_netloc,
        parsed.path,
        parsed.params,
        parsed.query,
        parsed.fragment
    ))


async def get_cache_status(directory: str) -> Dict:
    """Get cache status for a directory"""
    dir_path = Path(directory)
    
    result = {
        "directory": directory,
        "caches": {},
        "total_size_mb": 0,
        "error": None
    }
    
    if not dir_path.exists():
        result["error"] = "Directory not found"
        return result
    
    try:
        # Check .next cache
        next_cache = dir_path / ".next" / "cache"
        if next_cache.exists():
            size = sum(f.stat().st_size for f in next_cache.rglob('*') if f.is_file())
            result["caches"]["next"] = {
                "path": str(next_cache),
                "size_mb": round(size / (1024 * 1024), 2),
                "file_count": len(list(next_cache.rglob('*')))
            }
            result["total_size_mb"] += result["caches"]["next"]["size_mb"]
        
        # Check node_modules cache
        node_modules = dir_path / "node_modules" / ".cache"
        if node_modules.exists():
            size = sum(f.stat().st_size for f in node_modules.rglob('*') if f.is_file())
            result["caches"]["node_modules"] = {
                "path": str(node_modules),
                "size_mb": round(size / (1024 * 1024), 2),
                "file_count": len(list(node_modules.rglob('*')))
            }
            result["total_size_mb"] += result["caches"]["node_modules"]["size_mb"]
        
        # Check pnpm cache
        pnpm_cache = dir_path / "node_modules" / ".pnpm"
        if pnpm_cache.exists():
            size = sum(f.stat().st_size for f in pnpm_cache.rglob('*') if f.is_file())
            result["caches"]["pnpm"] = {
                "path": str(pnpm_cache),
                "size_mb": round(size / (1024 * 1024), 2),
                "file_count": len(list(pnpm_cache.rglob('*')))
            }
            result["total_size_mb"] += result["caches"]["pnpm"]["size_mb"]
        
        result["total_size_mb"] = round(result["total_size_mb"], 2)
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def clear_cache(directory: str, cache_type: str) -> Dict:
    """Clear specific cache type"""
    dir_path = Path(directory)
    
    result = {
        "success": False,
        "message": "",
        "cache_type": cache_type,
        "directory": directory
    }
    
    try:
        if cache_type == "next":
            cache_path = dir_path / ".next" / "cache"
            if cache_path.exists():
                subprocess.run(["rm", "-rf", str(cache_path)], check=True)
                result["success"] = True
                result["message"] = "Next.js cache cleared"
            else:
                result["message"] = "Cache directory not found"
        
        elif cache_type == "node_modules":
            cache_path = dir_path / "node_modules" / ".cache"
            if cache_path.exists():
                subprocess.run(["rm", "-rf", str(cache_path)], check=True)
                result["success"] = True
                result["message"] = "Node modules cache cleared"
            else:
                result["message"] = "Cache directory not found"
        
        elif cache_type == "all":
            next_cache = dir_path / ".next" / "cache"
            node_cache = dir_path / "node_modules" / ".cache"
            
            if next_cache.exists():
                subprocess.run(["rm", "-rf", str(next_cache)], check=True)
            if node_cache.exists():
                subprocess.run(["rm", "-rf", str(node_cache)], check=True)
            
            result["success"] = True
            result["message"] = "All caches cleared"
        
        else:
            result["message"] = f"Unknown cache type: {cache_type}"
    
    except Exception as e:
        result["message"] = f"Error clearing cache: {str(e)}"
    
    return result


async def get_redis_status() -> Dict:
    """Get Redis status and statistics"""
    result = {
        "connected": False,
        "info": {},
        "keys_count": 0,
        "memory_used_mb": 0,
        "error": None
    }
    
    try:
        r = redis.Redis(host='localhost', port=6379, db=0, socket_connect_timeout=2)
        
        # Test connection
        r.ping()
        result["connected"] = True
        
        # Get Redis info
        info = r.info()
        result["info"] = {
            "version": info.get("redis_version"),
            "uptime_days": info.get("uptime_in_days"),
            "connected_clients": info.get("connected_clients"),
            "used_memory": info.get("used_memory_human"),
            "total_keys": info.get("db0", {}).get("keys", 0) if "db0" in info else 0
        }
        
        result["keys_count"] = result["info"]["total_keys"]
        result["memory_used_mb"] = round(info.get("used_memory", 0) / (1024 * 1024), 2)
        
        r.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def clear_redis_cache(pattern: str = "*") -> Dict:
    """Clear Redis cache by pattern"""
    result = {
        "success": False,
        "keys_deleted": 0,
        "message": ""
    }
    
    try:
        r = redis.Redis(host='localhost', port=6379, db=0)
        
        # Get keys matching pattern
        keys = r.keys(pattern)
        
        if keys:
            result["keys_deleted"] = r.delete(*keys)
            result["success"] = True
            result["message"] = f"Deleted {result['keys_deleted']} keys"
        else:
            result["success"] = True
            result["message"] = "No keys found matching pattern"
        
        r.close()
        
    except Exception as e:
        result["message"] = f"Error clearing Redis: {str(e)}"
    
    return result


async def get_package_versions(directory: str) -> Dict:
    """Get installed package versions"""
    dir_path = Path(directory)
    
    result = {
        "directory": directory,
        "packages": {},
        "error": None
    }
    
    try:
        package_json = dir_path / "package.json"
        
        if package_json.exists():
            with open(package_json, 'r') as f:
                data = json.load(f)
            
            # Get dependencies
            deps = data.get("dependencies", {})
            dev_deps = data.get("devDependencies", {})
            
            result["packages"] = {
                "dependencies": deps,
                "devDependencies": dev_deps,
                "total_count": len(deps) + len(dev_deps)
            }
        else:
            result["error"] = "package.json not found"
    
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def get_pm2_logs(app_name: str, lines: int = 100) -> Dict:
    """Get PM2 logs for an application"""
    result = {
        "app_name": app_name,
        "logs": [],
        "error": None
    }
    
    try:
        # Get PM2 logs
        proc = subprocess.run(
            ["pm2", "logs", app_name, "--lines", str(lines), "--nostream"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if proc.returncode == 0:
            result["logs"] = proc.stdout.split('\n')
        else:
            result["error"] = proc.stderr
    
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def get_system_logs(log_type: str, lines: int = 100) -> Dict:
    """Get system logs"""
    result = {
        "log_type": log_type,
        "logs": [],
        "error": None
    }
    
    try:
        log_files = {
            "nginx": "/var/log/nginx/error.log",
            "postgres": "/var/log/postgresql/postgresql-14-main.log",
            "mail": "/var/log/mail.log",
            "syslog": "/var/log/syslog"
        }
        
        log_file = log_files.get(log_type)
        
        if log_file and Path(log_file).exists():
            proc = subprocess.run(
                ["tail", "-n", str(lines), log_file],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if proc.returncode == 0:
                result["logs"] = proc.stdout.split('\n')
            else:
                result["error"] = proc.stderr
        else:
            result["error"] = f"Log file not found: {log_file}"
    
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def test_connectivity() -> Dict:
    """Test connectivity to various services"""
    result = {
        "tests": {},
        "all_passed": True
    }
    
    # Test database
    try:
        import psycopg2
        conn = psycopg2.connect(settings.DATABASE_URL)
        conn.close()
        result["tests"]["database"] = {"status": "pass", "message": "Connected successfully"}
    except Exception as e:
        result["tests"]["database"] = {"status": "fail", "message": str(e)}
        result["all_passed"] = False
    
    # Test Redis
    try:
        r = redis.Redis(host='localhost', port=6379, db=0, socket_connect_timeout=2)
        r.ping()
        r.close()
        result["tests"]["redis"] = {"status": "pass", "message": "Connected successfully"}
    except Exception as e:
        result["tests"]["redis"] = {"status": "fail", "message": str(e)}
        result["all_passed"] = False
    
    # Test internet connectivity
    try:
        proc = subprocess.run(
            ["ping", "-c", "1", "8.8.8.8"],
            capture_output=True,
            timeout=5
        )
        if proc.returncode == 0:
            result["tests"]["internet"] = {"status": "pass", "message": "Internet accessible"}
        else:
            result["tests"]["internet"] = {"status": "fail", "message": "No internet connection"}
            result["all_passed"] = False
    except Exception as e:
        result["tests"]["internet"] = {"status": "fail", "message": str(e)}
        result["all_passed"] = False
    
    # Test disk space
    try:
        proc = subprocess.run(
            ["df", "-h", "/"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if proc.returncode == 0:
            lines = proc.stdout.strip().split('\n')
            if len(lines) > 1:
                parts = lines[1].split()
                usage = parts[4] if len(parts) > 4 else "unknown"
                result["tests"]["disk_space"] = {"status": "pass", "message": f"Usage: {usage}"}
        else:
            result["tests"]["disk_space"] = {"status": "fail", "message": "Could not check disk space"}
    except Exception as e:
        result["tests"]["disk_space"] = {"status": "fail", "message": str(e)}
    
    return result


async def analyze_env_file(directory: str) -> Dict:
    """Analyze .env file for issues"""
    dir_path = Path(directory)
    
    result = {
        "directory": directory,
        "env_files": {},
        "issues": [],
        "warnings": []
    }
    
    env_files = [".env", ".env.local", ".env.production"]
    
    for env_file in env_files:
        file_path = dir_path / env_file
        
        if file_path.exists():
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                lines = content.split('\n')
                variables = {}
                
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        variables[key.strip()] = value.strip()
                
                result["env_files"][env_file] = {
                    "exists": True,
                    "variable_count": len(variables),
                    "variables": list(variables.keys())
                }
                
                # Check for common issues
                if "DATABASE_URL" in variables:
                    db_url = variables["DATABASE_URL"]
                    if "dintrafikskolahlm.se" in db_url or "144.91.98.109" in db_url:
                        result["issues"].append({
                            "file": env_file,
                            "issue": "DATABASE_URL uses remote host instead of localhost",
                            "severity": "critical"
                        })
                
                # Check for empty critical variables
                critical_vars = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]
                for var in critical_vars:
                    if var in variables and not variables[var]:
                        result["warnings"].append({
                            "file": env_file,
                            "warning": f"{var} is empty",
                            "severity": "high"
                        })
                
            except Exception as e:
                result["env_files"][env_file] = {
                    "exists": True,
                    "error": str(e)
                }
        else:
            result["env_files"][env_file] = {
                "exists": False
            }
    
    return result


async def get_env_database_config(directory: str) -> Dict:
    """Get DATABASE_URL information from .env files for a directory.

    This is read-only and is used by the Database Setup & Tools tab to show how
    dev/prod are currently configured.
    """
    dir_path = Path(directory)
    result: Dict = {
        "directory": directory,
        "env_files": [],
        "issues": []
    }

    # Find all .env* files in the directory
    import glob
    env_files = []
    
    # Always include standard .env files (even if they don't exist)
    standard_patterns = [".env", ".env.local", ".env.production", ".env.development", ".env.test"]
    for pattern in standard_patterns:
        if pattern not in env_files:
            env_files.append(pattern)
    
    # Also check for any other .env* files that actually exist
    if dir_path.exists():
        for env_file in glob.glob(str(dir_path / ".env*")):
            basename = os.path.basename(env_file)
            if basename not in env_files and os.path.isfile(env_file):
                env_files.append(basename)

    for env_file in env_files:
        file_path = dir_path / env_file
        file_info: Dict = {
            "name": env_file,
            "path": str(file_path),
            "exists": file_path.exists(),
            "has_database_url": False,
            "database_url_display": None,
            "parsed": None,
            "warnings": []
        }

        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    lines = f.read().splitlines()

                db_url: Optional[str] = None
                for line in lines:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#") and stripped.startswith("DATABASE_URL="):
                        _, value = stripped.split("=", 1)
                        db_url = value.strip().strip('"').strip("'")
                        break

                if db_url:
                    file_info["has_database_url"] = True
                    file_info["database_url"] = db_url  # Store actual URL for backend operations

                    parsed = urlparse(db_url)
                    username = parsed.username or ""
                    host = parsed.hostname or ""
                    port = parsed.port
                    database = parsed.path.lstrip("/") if parsed.path else ""
                    has_password = parsed.password is not None

                    # Build a URL with masked password for display in the UI
                    safe_netloc = username
                    if has_password:
                        safe_netloc += ":********"
                    if host:
                        if safe_netloc:
                            safe_netloc += "@"
                        safe_netloc += host
                    if port:
                        safe_netloc += f":{port}"

                    safe_url = parsed._replace(netloc=safe_netloc).geturl()

                    file_info["database_url_display"] = safe_url
                    file_info["parsed"] = {
                        "scheme": parsed.scheme,
                        "username": username,
                        "host": host,
                        "port": port,
                        "database": database,
                        "has_password": has_password
                    }

                    if host not in ("localhost", "127.0.0.1", ""):
                        warning = {
                            "code": "non_localhost_host",
                            "message": "DATABASE_URL uses a non-localhost host. For this server, PostgreSQL should listen on localhost.",
                            "severity": "critical"
                        }
                        file_info["warnings"].append(warning)
                        result["issues"].append({
                            "file": env_file,
                            "issue": warning["message"],
                            "severity": warning["severity"]
                        })

            except Exception as e:
                file_info["error"] = str(e)

        result["env_files"].append(file_info)

    return result


async def get_sql_migrations(directory: str) -> Dict:
    """Get all SQL migration files from the repository"""
    dir_path = Path(directory)
    
    result = {
        "directory": directory,
        "migrations": [],
        "total_count": 0,
        "error": None
    }
    
    try:
        # Common migration directories
        migration_dirs = [
            dir_path / "migrations",
            dir_path / "db" / "migrations",
            dir_path / "drizzle" / "migrations",
            dir_path / "prisma" / "migrations"
        ]
        
        for migration_dir in migration_dirs:
            if migration_dir.exists():
                sql_files = list(migration_dir.rglob("*.sql"))
                
                for sql_file in sql_files:
                    try:
                        with open(sql_file, 'r') as f:
                            content = f.read()
                        
                        # Get file stats
                        stats = sql_file.stat()
                        
                        result["migrations"].append({
                            "filename": sql_file.name,
                            "path": str(sql_file.relative_to(dir_path)),
                            "size_bytes": stats.st_size,
                            "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
                            "content": content,
                            "line_count": len(content.split('\n'))
                        })
                    except Exception as e:
                        result["migrations"].append({
                            "filename": sql_file.name,
                            "path": str(sql_file.relative_to(dir_path)),
                            "error": str(e)
                        })
        
        result["total_count"] = len(result["migrations"])
        
        # Sort by filename
        result["migrations"].sort(key=lambda x: x.get("filename", ""))
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def check_migration_applied(directory: str, filename: str) -> Dict:
    """Check if a specific migration has been applied to the database"""
    result = {
        "filename": filename,
        "applied": False,
        "applied_at": None,
        "error": None
    }
    
    try:
        # For now, check if migration file exists and assume not applied
        # In a real implementation, this would query the migrations table
        dir_path = Path(directory)
        
        # Look for the migration file
        migration_dirs = [
            dir_path / "migrations",
            dir_path / "db" / "migrations", 
            dir_path / "drizzle" / "migrations",
            dir_path / "prisma" / "migrations"
        ]
        
        migration_exists = False
        for migration_dir in migration_dirs:
            if migration_dir.exists():
                if (migration_dir / filename).exists():
                    migration_exists = True
                    break
        
        if not migration_exists:
            result["error"] = f"Migration file {filename} not found"
            return result
            
        # TODO: Query actual database migrations table
        # For now, return a mock response
        result["applied"] = False
        result["message"] = "Migration tracking not implemented yet - checking file existence only"
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def execute_sql(sql: str, dry_run: bool = True) -> Dict:
    """Execute SQL query (with dry-run option)"""
    result = {
        "success": False,
        "dry_run": dry_run,
        "message": "",
        "rows_affected": 0,
        "results": []
    }
    
    if dry_run:
        result["success"] = True
        result["message"] = "Dry run - SQL not executed"
        result["sql"] = sql
        return result
    
    try:
        import psycopg2
        
        conn = psycopg2.connect(settings.DATABASE_URL)
        cursor = conn.cursor()
        
        # Execute SQL
        cursor.execute(sql)
        
        # Check if it's a SELECT query
        if sql.strip().upper().startswith("SELECT"):
            results = cursor.fetchall()
            result["results"] = [list(row) for row in results]
            result["rows_affected"] = len(results)
        else:
            conn.commit()
            result["rows_affected"] = cursor.rowcount
        
        cursor.close()
        conn.close()
        
        result["success"] = True
        result["message"] = f"SQL executed successfully. Rows affected: {result['rows_affected']}"
        
    except Exception as e:
        result["message"] = f"Error executing SQL: {str(e)}"
    
    return result


async def update_database_url(directory: str, new_url: str, target_files: Optional[List[str]] = None, create_if_missing: bool = True) -> Dict:
    """Update DATABASE_URL and Drizzle ORM variables in selected env files for dev or prod directory.

    This allows updating DATABASE_URL and DB_* variables in both dev and prod directories.
    Also updates Drizzle ORM variables: DB_HOST, DB_USER, DB_NAME, DB_PASSWORD, DB_PORT
    """
    dir_path = Path(directory)
    result: Dict = {
        "directory": directory,
        "new_url": new_url,
        "files": [],
        "error": None,
        "environment": "dev" if str(dir_path) == settings.DEV_DIR else "prod"
    }

    try:
        # Safety check: only allow configured directories
        allowed_dirs = [settings.DEV_DIR, settings.PROD_DIR]
        if str(dir_path) not in allowed_dirs:
            result["error"] = f"Updating DATABASE_URL is only allowed for configured dev/prod directories."
            return result

        # Parse the database URL to extract components for Drizzle ORM
        from urllib.parse import urlparse
        parsed = urlparse(new_url)
        # Always use 127.0.0.1 instead of localhost to avoid IPv6 issues
        db_host = "127.0.0.1" if (parsed.hostname == "localhost" or parsed.hostname == "127.0.0.1" or not parsed.hostname) else parsed.hostname
        db_port = str(parsed.port or 5432)
        db_user = parsed.username or ""
        db_password = parsed.password or ""
        db_name = parsed.path.lstrip("/") if parsed.path else ""

        env_files = target_files or [".env.local"]

        for env_file in env_files:
            file_path = dir_path / env_file
            file_result: Dict = {
                "name": env_file,
                "path": str(file_path),
                "updated": False
            }

            # Create file if it doesn't exist and create_if_missing is True
            if not file_path.exists():
                if create_if_missing:
                    try:
                        file_path.parent.mkdir(parents=True, exist_ok=True)
                        file_path.touch()
                        file_result["created"] = True
                    except Exception as e:
                        file_result["reason"] = f"file_not_found_and_cannot_create: {str(e)}"
                        result["files"].append(file_result)
                        continue
                else:
                    file_result["reason"] = "file_not_found"
                    result["files"].append(file_result)
                    continue

            try:
                # Read existing file or start with empty content
                if file_path.exists() and file_path.stat().st_size > 0:
                    with open(file_path, "r") as f:
                        lines = f.read().splitlines()
                else:
                    lines = []

                new_lines: List[str] = []
                found_db_url = False
                found_db_host = False
                found_db_port = False
                found_db_user = False
                found_db_name = False
                found_db_password = False
                previous_db_url: Optional[str] = None

                for line in lines:
                    original = line
                    stripped = line.lstrip()
                    
                    # Update DATABASE_URL
                    if stripped.startswith("DATABASE_URL="):
                        parts = stripped.split("=", 1)
                        if len(parts) == 2:
                            previous_db_url = parts[1].strip()
                        prefix_len = len(original) - len(stripped)
                        indent = original[:prefix_len]
                        new_lines.append(f"{indent}DATABASE_URL={new_url}")
                        found_db_url = True
                    # Update Drizzle ORM variables
                    elif stripped.startswith("DB_HOST="):
                        prefix_len = len(original) - len(stripped)
                        indent = original[:prefix_len]
                        new_lines.append(f"{indent}DB_HOST={db_host}")
                        found_db_host = True
                    elif stripped.startswith("DB_PORT="):
                        prefix_len = len(original) - len(stripped)
                        indent = original[:prefix_len]
                        new_lines.append(f"{indent}DB_PORT={db_port}")
                        found_db_port = True
                    elif stripped.startswith("DB_USER="):
                        prefix_len = len(original) - len(stripped)
                        indent = original[:prefix_len]
                        new_lines.append(f"{indent}DB_USER={db_user}")
                        found_db_user = True
                    elif stripped.startswith("DB_NAME="):
                        prefix_len = len(original) - len(stripped)
                        indent = original[:prefix_len]
                        new_lines.append(f"{indent}DB_NAME={db_name}")
                        found_db_name = True
                    elif stripped.startswith("DB_PASSWORD="):
                        prefix_len = len(original) - len(stripped)
                        indent = original[:prefix_len]
                        new_lines.append(f"{indent}DB_PASSWORD={db_password}")
                        found_db_password = True
                    else:
                        new_lines.append(original)

                # Add missing variables at the end
                if not found_db_url:
                    new_lines.append(f"DATABASE_URL={new_url}")
                if not found_db_host and db_host:
                    new_lines.append(f"DB_HOST={db_host}")
                if not found_db_port and db_port:
                    new_lines.append(f"DB_PORT={db_port}")
                if not found_db_user and db_user:
                    new_lines.append(f"DB_USER={db_user}")
                if not found_db_name and db_name:
                    new_lines.append(f"DB_NAME={db_name}")
                if not found_db_password and db_password:
                    new_lines.append(f"DB_PASSWORD={db_password}")

                # Write back to file
                with open(file_path, "w") as f:
                    f.write("\n".join(new_lines) + "\n")

                file_result["updated"] = True
                file_result["previous"] = previous_db_url
                file_result["variables_added"] = {
                    "DATABASE_URL": not found_db_url,
                    "DB_HOST": not found_db_host and bool(db_host),
                    "DB_PORT": not found_db_port and bool(db_port),
                    "DB_USER": not found_db_user and bool(db_user),
                    "DB_NAME": not found_db_name and bool(db_name),
                    "DB_PASSWORD": not found_db_password and bool(db_password)
                }

            except Exception as e:
                file_result["error"] = str(e)

            result["files"].append(file_result)

    except Exception as e:
        result["error"] = str(e)

    return result


# ============= DATABASE SYNC TOOLS =============

async def generate_sync_commands(source_env: str, target_env: str, options: Dict = None, execute: bool = False) -> Dict:
    """Generate and optionally execute database sync operations.
    
    Executes if execute=True, otherwise just generates commands.
    """
    result = {
        "source_env": source_env,
        "target_env": target_env,
        "commands": [],
        "warnings": [],
        "options": options or {},
        "executed": False,
        "console_output": []
    }
    
    try:
        # Get source and target database configs
        source_dir = settings.DEV_DIR if source_env == "dev" else settings.PROD_DIR
        target_dir = settings.DEV_DIR if target_env == "dev" else settings.PROD_DIR
        
        source_config = await get_env_database_config(source_dir)
        target_config = await get_env_database_config(target_dir)
        
        # Parse database URLs for command generation
        source_db_url = None
        target_db_url = None
        
        for file_info in source_config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                source_db_url = file_info["database_url"]
                break
                
        for file_info in target_config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                target_db_url = file_info["database_url"]
                break
        
        if not source_db_url or not target_db_url:
            result["warnings"].append("Could not find DATABASE_URL in environment files")
            result["console_output"].append("❌ Error: Could not find DATABASE_URL in .env files")
            return result
        
        # Parse URLs to get connection details
        from urllib.parse import urlparse
        source_parsed = urlparse(source_db_url)
        target_parsed = urlparse(target_db_url)
        
        result["console_output"].append(f"$ Preparing database sync")
        result["console_output"].append(f"→ Source: {source_env} ({source_parsed.path[1:]})")
        result["console_output"].append(f"→ Target: {target_env} ({target_parsed.path[1:]})")
        result["console_output"].append("")
        
        # Generate commands based on sync type
        sync_type = options.get("sync_type", "schema_only")  # schema_only, full_data, tables_only
        tables = options.get("tables", [])
        
        if sync_type == "schema_only":
            # Schema only - safe for dev->prod
            cmd = f"pg_dump -h 127.0.0.1 -p {source_parsed.port} -U {source_parsed.username} --schema-only --no-owner --no-privileges {source_parsed.path[1:]} | psql -h 127.0.0.1 -p {target_parsed.port} -U {target_parsed.username} {target_parsed.path[1:]}"
            result["commands"].append({
                "type": "schema_sync",
                "description": f"Sync schema from {source_env} to {target_env} (no data)",
                "command": cmd,
                "safe": True
            })
            
        elif sync_type == "full_data":
            # Full data - warn for prod->dev, block dev->prod
            if source_env == "prod" and target_env == "dev":
                cmd = f"pg_dump -h 127.0.0.1 -p {source_parsed.port} -U {source_parsed.username} --clean --if-exists {source_parsed.path[1:]} | psql -h 127.0.0.1 -p {target_parsed.port} -U {target_parsed.username} {target_parsed.path[1:]}"
                result["commands"].append({
                    "type": "full_sync",
                    "description": f"Clone full database from {source_env} to {target_env}",
                    "command": cmd,
                    "safe": True
                })
            else:
                result["warnings"].append("Full data sync from dev to prod is not allowed for safety")
                
        elif sync_type == "tables_only" and tables:
            # Specific tables
            table_list = " ".join(tables)
            cmd = f"pg_dump -h 127.0.0.1 -p {source_parsed.port} -U {source_parsed.username} --data-only --table={table_list} {source_parsed.path[1:]} | psql -h 127.0.0.1 -p {target_parsed.port} -U {target_parsed.username} {target_parsed.path[1:]}"
            result["commands"].append({
                "type": "table_sync",
                "description": f"Sync tables {', '.join(tables)} from {source_env} to {target_env}",
                "command": cmd,
                "safe": source_env == "prod" and target_env == "dev"
            })
        
        # Execute if requested
        if execute and result["commands"]:
            result["console_output"].append(f"🚀 Executing sync: {sync_type}")
            result["console_output"].append("")
            
            try:
                # Set PGPASSWORD for both source and target
                env = os.environ.copy()
                
                # Use target password for psql
                if target_parsed.password:
                    env["PGPASSWORD"] = target_parsed.password
                
                # Build the full command based on sync type
                if sync_type == "schema_only":
                    # pg_dump | psql pipeline
                    pg_dump_cmd = [
                        "pg_dump",
                        "-h", "127.0.0.1",
                        "-p", str(source_parsed.port),
                        "-U", str(source_parsed.username),
                        "--schema-only", "--no-owner", "--no-privileges",
                        source_parsed.path[1:]
                    ]
                    
                    # Use 127.0.0.1 for target when executing locally
                    psql_cmd = [
                        "psql",
                        "-h", "127.0.0.1",
                        "-p", str(target_parsed.port),
                        "-U", str(target_parsed.username),
                        target_parsed.path[1:]
                    ]
                    
                    # Set source password for pg_dump
                    if source_parsed.password:
                        env["PGPASSWORD"] = source_parsed.password
                    
                    # Run pg_dump
                    dump_process = subprocess.run(
                        pg_dump_cmd,
                        env=env,
                        capture_output=True,
                        text=True,
                        timeout=300
                    )
                    
                    if dump_process.returncode != 0:
                        result["console_output"].append(f"❌ pg_dump failed: {dump_process.stderr}")
                        result["warnings"].append("Sync failed during dump")
                        return result
                    
                    # Set target password for psql
                    if target_parsed.password:
                        env["PGPASSWORD"] = target_parsed.password
                    
                    # Run psql with dumped data
                    restore_process = subprocess.run(
                        psql_cmd,
                        input=dump_process.stdout,
                        env=env,
                        capture_output=True,
                        text=True,
                        timeout=300
                    )
                    
                    if restore_process.returncode == 0:
                        result["executed"] = True
                        result["success"] = True
                        result["console_output"].append("✅ Schema sync completed successfully!")
                        result["console_output"].append(f"→ Source: {source_env}")
                        result["console_output"].append(f"→ Target: {target_env}")
                    else:
                        result["console_output"].append(f"❌ psql failed: {restore_process.stderr}")
                        
                elif sync_type == "full_data":
                    if source_env == "prod" and target_env == "dev":
                        # Full database clone
                        pg_dump_cmd = [
                            "pg_dump",
                            "-h", "127.0.0.1",
                            "-p", str(source_parsed.port),
                            "-U", str(source_parsed.username),
                            "--clean", "--if-exists",
                            source_parsed.path[1:]
                        ]
                        
                        # Use 127.0.0.1 for target when executing locally
                        psql_cmd = [
                            "psql",
                            "-h", "127.0.0.1",
                            "-p", str(target_parsed.port),
                            "-U", str(target_parsed.username),
                            target_parsed.path[1:]
                        ]
                        
                        # Set source password
                        if source_parsed.password:
                            env["PGPASSWORD"] = source_parsed.password
                        
                        dump_process = subprocess.run(
                            pg_dump_cmd,
                            env=env,
                            capture_output=True,
                            text=True,
                            timeout=600  # Longer timeout for full data
                        )
                        
                        if dump_process.returncode != 0:
                            result["console_output"].append(f"❌ pg_dump failed: {dump_process.stderr}")
                            return result
                        
                        # Set target password
                        if target_parsed.password:
                            env["PGPASSWORD"] = target_parsed.password
                        
                        restore_process = subprocess.run(
                            psql_cmd,
                            input=dump_process.stdout,
                            env=env,
                            capture_output=True,
                            text=True,
                            timeout=600
                        )
                        
                        if restore_process.returncode == 0:
                            result["executed"] = True
                            result["success"] = True
                            result["console_output"].append("✅ Full database sync completed!")
                            result["console_output"].append(f"→ Cloned from {source_env} to {target_env}")
                        else:
                            result["console_output"].append(f"❌ Restore failed: {restore_process.stderr}")
                    else:
                        result["console_output"].append("❌ Full data sync from dev to prod is not allowed")
                        result["warnings"].append("Safety check: cannot sync dev to prod")
                        
            except subprocess.TimeoutExpired:
                result["console_output"].append("❌ Sync timed out")
                result["warnings"].append("Operation timed out")
            except Exception as e:
                result["console_output"].append(f"❌ Execution error: {str(e)}")
                result["warnings"].append(f"Execution failed: {str(e)}")
        else:
            if execute:
                result["console_output"].append("ℹ️  No commands to execute")
            else:
                result["console_output"].append("ℹ️  Commands generated (not executed)")
                result["console_output"].append("→ Use execute=true to run sync")
        
        # Add safety warnings
        if target_env == "prod":
            result["warnings"].append("Targeting production environment - review commands carefully")
            
    except Exception as e:
        result["warnings"].append(f"Error: {str(e)}")
        result["console_output"].append(f"❌ Error: {str(e)}")
    
    return result


# ============= DATABASE BACKUP TOOLS =============

async def generate_backup_commands(environment: str, backup_type: str = "full", execute: bool = False) -> Dict:
    """Generate and optionally execute backup commands for database.
    
    For dev: can execute directly
    For prod: only generates commands for manual execution unless execute=True
    """
    result = {
        "environment": environment,
        "backup_type": backup_type,
        "commands": [],
        "warnings": [],
        "can_execute": environment == "dev",
        "executed": False,
        "console_output": []
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL - prioritize .env.local, then .env, then others
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        used_file = None
        
        # First try priority order
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    used_file = file_info.get("name")
                    break
            if db_url:
                break
        
        # If not found in priority, try any file
        if not db_url:
            for file_info in config.get("env_files", []):
                if file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    used_file = file_info.get("name")
                    break
        
        if not db_url:
            result["warnings"].append("Could not find DATABASE_URL")
            result["console_output"].append("❌ Error: Could not find DATABASE_URL in .env files")
            return result
        
        from urllib.parse import urlparse
        # Convert URL to use 127.0.0.1 before parsing
        db_url = convert_db_url_to_localhost(db_url)
        parsed = urlparse(db_url)
        
        # Ensure we have all required components
        db_host = "127.0.0.1"  # Always use 127.0.0.1
        db_port = parsed.port or 5432
        db_user = parsed.username or ""
        db_password = parsed.password or ""
        db_name = parsed.path.lstrip("/") if parsed.path else ""
        
        if not db_name:
            result["warnings"].append("Could not extract database name from DATABASE_URL")
            result["console_output"].append("❌ Error: Could not extract database name from DATABASE_URL")
            return result
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"backup_{environment}_{timestamp}.sql"
        backup_path = f"/var/www/build/backups/{backup_file}"
        
        # Ensure backup directory exists
        os.makedirs("/var/www/build/backups", exist_ok=True)
        
        result["console_output"].append(f"$ Preparing {backup_type} backup for {environment}")
        result["console_output"].append(f"→ Reading from: {directory}")
        result["console_output"].append(f"→ Found {len(config.get('env_files', []))} .env* files")
        result["console_output"].append(f"→ Using DATABASE_URL from: {used_file or 'unknown'}")
        result["console_output"].append(f"→ Database: {db_name}")
        result["console_output"].append(f"→ Host: {db_host}:{db_port} (using IPv4 localhost for connection)")
        result["console_output"].append(f"→ User: {db_user}")
        if db_password:
            result["console_output"].append(f"→ Password: {'*' * len(db_password)} (configured)")
        result["console_output"].append("")
        
        if backup_type == "full":
            cmd_list = [
                "pg_dump",
                "-h", db_host,
                "-p", str(db_port),
                "-U", db_user,
                "--clean", "--if-exists",
                db_name,
                "-f", backup_path
            ]
            description = f"Full database backup for {environment}"
        elif backup_type == "schema_only":
            backup_file = f"schema_{environment}_{timestamp}.sql"
            backup_path = f"/var/www/build/backups/{backup_file}"
            cmd_list = [
                "pg_dump",
                "-h", db_host,
                "-p", str(db_port),
                "-U", db_user,
                "--schema-only", "--no-owner", "--no-privileges",
                db_name,
                "-f", backup_path
            ]
            description = f"Schema-only backup for {environment}"
        
        # Generate command string for display
        cmd_string = " ".join(cmd_list)
        
        result["commands"].append({
            "type": backup_type,
            "description": description,
            "command": cmd_string,
            "backup_file": backup_file,
            "safe": True
        })
        
        # Execute if requested and allowed
        if execute and (environment == "dev" or execute):
            result["console_output"].append(f"🚀 Executing backup command...")
            result["console_output"].append("")
            result["console_output"].append(f"→ Command: {' '.join(cmd_list)}")
            result["console_output"].append("")
            
            try:
                # Set PGPASSWORD environment variable for authentication
                env = os.environ.copy()
                if db_password:
                    env["PGPASSWORD"] = db_password
                    result["console_output"].append(f"→ Password configured via PGPASSWORD environment variable")
                else:
                    result["console_output"].append(f"⚠️  Warning: No password found in DATABASE_URL")
                    result["warnings"].append("No password in DATABASE_URL - authentication may fail")
                
                result["console_output"].append("")
                
                # Execute the command
                process = subprocess.run(
                    cmd_list,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                result["executed"] = True
                
                if process.returncode == 0:
                    # Check if file was created
                    if os.path.exists(backup_path):
                        file_size = os.path.getsize(backup_path)
                        size_mb = file_size / (1024 * 1024)
                        result["console_output"].append(f"✅ Backup completed successfully!")
                        result["console_output"].append(f"→ File: {backup_file}")
                        result["console_output"].append(f"→ Size: {size_mb:.2f} MB")
                        result["console_output"].append(f"→ Location: {backup_path}")
                        result["console_output"].append(f"→ Download URL: /api/database/backup/download/{backup_file}")
                        result["backup_file"] = backup_file
                        result["backup_path"] = backup_path
                        result["backup_size_mb"] = size_mb
                        result["download_url"] = f"/api/database/backup/download/{backup_file}"
                    else:
                        result["console_output"].append(f"⚠️  Command succeeded but file not found at {backup_path}")
                        result["console_output"].append(f"→ Checking if directory exists...")
                        backup_dir = os.path.dirname(backup_path)
                        if os.path.exists(backup_dir):
                            result["console_output"].append(f"→ Directory exists: {backup_dir}")
                            try:
                                files = os.listdir(backup_dir)
                                result["console_output"].append(f"→ Files in directory: {', '.join(files[:10])}")
                            except:
                                pass
                        else:
                            result["console_output"].append(f"→ Directory does not exist: {backup_dir}")
                        result["warnings"].append("Backup file was not created despite successful command")
                else:
                    result["console_output"].append(f"❌ Backup failed with exit code {process.returncode}")
                    
                if process.stdout:
                    result["console_output"].append("")
                    result["console_output"].append("📋 Output:")
                    for line in process.stdout.strip().split("\n"):
                        result["console_output"].append(f"  {line}")
                        
                if process.stderr:
                    result["console_output"].append("")
                    result["console_output"].append("⚠️  Errors:")
                    for line in process.stderr.strip().split("\n"):
                        result["console_output"].append(f"  {line}")
                        
            except subprocess.TimeoutExpired:
                result["console_output"].append("❌ Backup timed out after 5 minutes")
                result["warnings"].append("Backup operation timed out")
            except Exception as e:
                result["console_output"].append(f"❌ Execution error: {str(e)}")
                result["warnings"].append(f"Execution failed: {str(e)}")
        else:
            result["console_output"].append("ℹ️  Command generated (not executed)")
            result["console_output"].append("→ Copy and run manually, or use execute=true")
        
        if environment == "prod" and not execute:
            result["warnings"].append("Production backups require manual execution or explicit execute=true")
            
    except Exception as e:
        result["warnings"].append(f"Error generating backup commands: {str(e)}")
        result["console_output"].append(f"❌ Error: {str(e)}")
    
    return result


# ============= DATABASE CRUD EXPLORER =============

async def get_database_schema(environment: str) -> Dict:
    """Get database schema information for CRUD explorer."""
    result = {
        "environment": environment,
        "tables": [],
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL - prioritize .env.local, then .env, then others
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        # First try priority order
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        # If not found in priority, try any file
        if not db_url:
            for file_info in config.get("env_files", []):
                if file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        # Connect to database and get schema (use localhost)
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        cursor = conn.cursor()
        
        # Get tables
        cursor.execute("""
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        
        for table_name, table_type in tables:
            # Get column info for each table
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = %s AND table_schema = 'public'
                ORDER BY ordinal_position
            """, (table_name,))
            
            columns = cursor.fetchall()
            
            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
            row_count = cursor.fetchone()[0]
            
            result["tables"].append({
                "name": table_name,
                "type": table_type,
                "row_count": row_count,
                "columns": [
                    {
                        "name": col[0],
                        "type": col[1], 
                        "nullable": col[2] == "YES",
                        "default": col[3]
                    }
                    for col in columns
                ]
            })
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = f"Error getting schema: {str(e)}"
    
    return result


async def query_table_data(environment: str, table_name: str, limit: int = 100, offset: int = 0) -> Dict:
    """Query table data for CRUD explorer (read-only)."""
    result = {
        "environment": environment,
        "table_name": table_name,
        "data": [],
        "columns": [],
        "total_rows": 0,
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL - prioritize .env.local, then .env, then others
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        # First try priority order
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        # If not found in priority, try any file
        if not db_url:
            for file_info in config.get("env_files", []):
                if file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        # Debug: log the connection URL (without password)
        debug_url = localhost_db_url.split("@")[0] + "@" + localhost_db_url.split("@")[1].split("/")[0] if "@" in localhost_db_url else localhost_db_url
        conn = psycopg2.connect(localhost_db_url)
        cursor = conn.cursor()
        
        # Get total row count
        cursor.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
        result["total_rows"] = cursor.fetchone()[0]
        
        # Get column names
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s AND table_schema = 'public'
            ORDER BY ordinal_position
        """, (table_name,))
        
        result["columns"] = [col[0] for col in cursor.fetchall()]
        
        # Get data with pagination
        cursor.execute(f"SELECT * FROM \"{table_name}\" LIMIT {limit} OFFSET {offset}")
        rows = cursor.fetchall()
        result["data"] = rows
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = f"Error querying table: {str(e)}"
    
    return result


# ============= INDIVIDUAL DATABASE/USER CREATION =============

async def create_database_only(db_name: str, environment: str = "dev") -> Dict:
    """Create a database without creating a user."""
    result = {
        "db_name": db_name,
        "environment": environment,
        "success": False,
        "console_output": [],
        "warnings": [],
        "error": None
    }
    
    try:
        # Get postgres connection URL
        target_dir = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(target_dir)
        
        # Find any DATABASE_URL to get connection info
        db_url = None
        for file_info in config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                db_url = file_info["database_url"]
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL to connect to PostgreSQL"
            return result
        
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        postgres_url = f"postgresql://{parsed.username}:{parsed.password}@127.0.0.1:{parsed.port or 5432}/postgres"
        
        result["console_output"].append(f"$ Creating database: {db_name}")
        result["console_output"].append(f"→ Environment: {environment}")
        result["console_output"].append("")
        
        import psycopg2
        localhost_postgres_url = convert_db_url_to_localhost(postgres_url)
        conn = psycopg2.connect(localhost_postgres_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        if cursor.fetchone():
            result["warnings"].append(f"Database '{db_name}' already exists")
            result["console_output"].append(f"⚠️  Database '{db_name}' already exists")
        else:
            cursor.execute(f'CREATE DATABASE "{db_name}"')
            result["console_output"].append(f"✅ Database '{db_name}' created successfully")
        
        cursor.close()
        conn.close()
        result["success"] = True
        
    except Exception as e:
        result["error"] = str(e)
        result["console_output"].append(f"❌ Error: {str(e)}")
    
    return result


async def create_database_user(username: str, password: str, environment: str = "dev") -> Dict:
    """Create a PostgreSQL user without creating a database."""
    result = {
        "username": username,
        "environment": environment,
        "success": False,
        "console_output": [],
        "warnings": [],
        "error": None
    }
    
    try:
        # Get postgres connection URL
        target_dir = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(target_dir)
        
        # Find any DATABASE_URL to get connection info
        db_url = None
        for file_info in config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                db_url = file_info["database_url"]
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL to connect to PostgreSQL"
            return result
        
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        postgres_url = f"postgresql://{parsed.username}:{parsed.password}@127.0.0.1:{parsed.port or 5432}/postgres"
        
        result["console_output"].append(f"$ Creating user: {username}")
        result["console_output"].append(f"→ Environment: {environment}")
        result["console_output"].append("")
        
        import psycopg2
        localhost_postgres_url = convert_db_url_to_localhost(postgres_url)
        conn = psycopg2.connect(localhost_postgres_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT 1 FROM pg_user WHERE usename = %s", (username,))
        if cursor.fetchone():
            result["warnings"].append(f"User '{username}' already exists")
            result["console_output"].append(f"⚠️  User '{username}' already exists")
            # Update password
            cursor.execute(f"ALTER USER \"{username}\" WITH PASSWORD %s", (password,))
            result["console_output"].append(f"✅ Password updated for user '{username}'")
        else:
            cursor.execute(f'CREATE USER "{username}" WITH PASSWORD %s', (password,))
            result["console_output"].append(f"✅ User '{username}' created successfully")
        
        cursor.close()
        conn.close()
        result["success"] = True
        
    except Exception as e:
        result["error"] = str(e)
        result["console_output"].append(f"❌ Error: {str(e)}")
    
    return result


# ============= SETUP TEST DATABASE =============

async def setup_test_database(db_name: str, username: str, password: str, environment: str = "dev", clone_from_prod: bool = True) -> Dict:
    """Setup a new test database with user and optionally clone from production.
    
    Args:
        db_name: Name of the test database to create
        username: PostgreSQL username to create
        password: Password for the user
        environment: 'dev' or 'prod' - determines which directory to update .env files in
        clone_from_prod: Whether to clone data from production database
    """
    result = {
        "db_name": db_name,
        "username": username,
        "clone_from_prod": clone_from_prod,
        "sql_commands": [],
        "env_updates": {},
        "warnings": [],
        "success": False,
        "console_output": []
    }
    
    try:
        # Determine target directory based on environment
        target_dir = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        
        # Get production database URL for cloning
        prod_config = await get_env_database_config(settings.PROD_DIR)
        prod_db_url = None
        for file_info in prod_config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                prod_db_url = file_info["database_url"]
                break
        
        if not prod_db_url and clone_from_prod:
            result["warnings"].append("Could not find production DATABASE_URL for cloning")
            result["console_output"].append("⚠️  Warning: Could not find production DATABASE_URL for cloning")
        
        from urllib.parse import urlparse
        if clone_from_prod and prod_db_url:
            prod_parsed = urlparse(prod_db_url)
            postgres_url = f"postgresql://{prod_parsed.username}:{prod_parsed.password}@127.0.0.1:{prod_parsed.port}/postgres"
        else:
            # Use localhost postgres for creating new DB
            postgres_url = f"postgresql://postgres@127.0.0.1:5432/postgres"
        
        result["console_output"].append(f"$ Setting up test database for {environment} environment")
        result["console_output"].append(f"→ Target directory: {target_dir}")
        result["console_output"].append(f"→ Database: {db_name}")
        result["console_output"].append(f"→ User: {username}")
        result["console_output"].append("")
        
        # Generate SQL commands
        sql_commands = []
        
        # 1. Create database
        sql_commands.append(f"CREATE DATABASE \"{db_name}\";")
        
        # 2. Create user (escape single quotes in password)
        escaped_password = password.replace("'", "''")
        sql_commands.append(f"CREATE USER \"{username}\" WITH PASSWORD '{escaped_password}';")
        
        # 3. Grant privileges
        sql_commands.append(f"GRANT ALL PRIVILEGES ON DATABASE \"{db_name}\" TO \"{username}\";")
        sql_commands.append(f"GRANT ALL ON SCHEMA public TO \"{username}\";")
        sql_commands.append(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"{username}\";")
        
        result["console_output"].append("📝 Generated SQL commands:")
        for cmd in sql_commands:
            result["console_output"].append(f"  → {cmd}")
        result["console_output"].append("")
        
        # 4. Clone from production if requested
        if clone_from_prod and prod_db_url:
            prod_parsed = urlparse(prod_db_url)
            new_db_url = f"postgresql://{username}:{password}@127.0.0.1:5432/{db_name}"
            clone_cmd = f"pg_dump -h 127.0.0.1 -p {prod_parsed.port} -U {prod_parsed.username} --clean --if-exists {prod_parsed.path[1:]} | psql -h 127.0.0.1 -p 5432 -U {username} {db_name}"
            result["clone_command"] = clone_cmd
            result["console_output"].append("📋 Clone command generated (run manually):")
            result["console_output"].append(f"  → {clone_cmd}")
            result["console_output"].append("")
        
        result["sql_commands"] = sql_commands
        result["new_database_url"] = f"postgresql://{username}:{password}@127.0.0.1:5432/{db_name}"
        
        # Get all .env* files from target directory
        import glob
        env_files = []
        env_patterns = [".env", ".env.local", ".env.production", ".env.development", ".env.test"]
        for pattern in env_patterns:
            env_path = os.path.join(target_dir, pattern)
            if os.path.exists(env_path):
                env_files.append(pattern)
        
        # Also check for any .env* files
        for env_file in glob.glob(os.path.join(target_dir, ".env*")):
            basename = os.path.basename(env_file)
            if basename not in env_files:
                env_files.append(basename)
        
        result["console_output"].append(f"📝 Found {len(env_files)} .env* files in {target_dir}:")
        for env_file in env_files:
            result["console_output"].append(f"  → {env_file}")
        result["console_output"].append("")
        
        # Generate env file updates for all .env* files
        env_updates = {}
        for env_file in env_files:
            env_path = os.path.join(target_dir, env_file)
            # Update or add DATABASE_URL in the file
            env_updates[env_file] = f"DATABASE_URL=\"{result['new_database_url']}\""
        
        result["env_updates"] = env_updates
        result["console_output"].append("✅ Test database setup configuration generated")
        result["console_output"].append(f"→ New DATABASE_URL: {result['new_database_url']}")
        result["console_output"].append(f"→ Will update {len(env_updates)} .env* files")
        
        result["success"] = True
        
    except Exception as e:
        result["warnings"].append(f"Error setting up test database: {str(e)}")
        result["console_output"].append(f"❌ Error: {str(e)}")
    
    return result


async def execute_test_database_setup(commands: List[str], db_url: str) -> Dict:
    """Execute the SQL commands to create test database."""
    result = {
        "commands_executed": [],
        "errors": [],
        "success": False
    }
    
    try:
        import psycopg2
        # Connect to postgres database to create new database (use localhost)
        postgres_url = db_url.replace(f"/{db_url.split('/')[-1]}", "/postgres")
        localhost_postgres_url = convert_db_url_to_localhost(postgres_url)
        conn = psycopg2.connect(localhost_postgres_url)
        conn.autocommit = True  # Required for CREATE DATABASE
        cursor = conn.cursor()
        
        for command in commands:
            try:
                cursor.execute(command)
                result["commands_executed"].append(command)
                result["console_output"] = result.get("console_output", [])
                result["console_output"].append(f"✅ Executed: {command[:80]}...")
            except Exception as e:
                error_msg = f"Error executing '{command[:80]}...': {str(e)}"
                result["errors"].append(error_msg)
                result["console_output"] = result.get("console_output", [])
                result["console_output"].append(f"❌ {error_msg}")
        
        # Verify user was created and can connect (if CREATE USER was in commands)
        if any("CREATE USER" in cmd.upper() for cmd in commands):
            try:
                # Extract username and password from CREATE USER command
                import re
                for cmd in commands:
                    # Match both single and double quoted passwords
                    user_match = re.search(r'CREATE USER "([^"]+)" WITH PASSWORD [\'"]([^\'"]+)[\'"]', cmd, re.IGNORECASE)
                    if not user_match:
                        # Try with escaped quotes
                        user_match = re.search(r'CREATE USER "([^"]+)" WITH PASSWORD \'([^\']+)\'', cmd, re.IGNORECASE)
                    
                    if user_match:
                        test_username = user_match.group(1)
                        test_password = user_match.group(2)
                        # Unescape SQL string escapes
                        test_password = test_password.replace("''", "'").replace("\\\\", "\\")
                        
                        result["console_output"].append(f"🔍 Verifying user '{test_username}' can connect...")
                        
                        # Try to connect with the new user to verify password
                        test_db_url = f"postgresql://{test_username}:{test_password}@127.0.0.1:5432/postgres"
                        try:
                            test_conn = psycopg2.connect(test_db_url)
                            test_conn.close()
                            result["console_output"].append(f"✅ Verified: User '{test_username}' can connect with password")
                        except Exception as verify_error:
                            error_msg = str(verify_error)
                            result["warnings"].append(f"User created but password verification failed: {error_msg}")
                            result["console_output"].append(f"⚠️  Warning: User created but password verification failed")
                            result["console_output"].append(f"   Error: {error_msg}")
                            result["console_output"].append(f"   → This may indicate the password was not set correctly")
                            result["console_output"].append(f"   → Try recreating the user or check PostgreSQL logs")
                        break
            except Exception as verify_ex:
                result["warnings"].append(f"Could not verify user creation: {str(verify_ex)}")
                result["console_output"].append(f"⚠️  Could not verify user creation: {str(verify_ex)}")
        
        cursor.close()
        conn.close()
        
        result["success"] = len(result["errors"]) == 0
        
    except Exception as e:
        result["errors"].append(f"Database connection error: {str(e)}")
    
    return result


# ============= TABLE MANAGEMENT =============

async def create_database_table(environment: str, table_name: str, columns: list) -> Dict:
    """Create a new database table with specified columns."""
    result = {
        "success": False,
        "environment": environment,
        "table_name": table_name,
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        for file_info in config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                db_url = file_info["database_url"]
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        # Parse URL
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        
        # Build column definitions
        column_defs = []
        for col in columns:
            col_name = col.get("name", "").strip()
            col_type = col.get("type", "TEXT").strip()
            
            if not col_name:
                continue
                
            col_def = f'"{col_name}" {col_type}'
            column_defs.append(col_def)
        
        if not column_defs:
            result["error"] = "No valid columns specified"
            return result
        
        # Build CREATE TABLE SQL
        columns_sql = ",\n    ".join(column_defs)
        create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" (\n    {columns_sql}\n);'
        
        # Connect and execute
        import psycopg2
        conn = psycopg2.connect(
            host="localhost",
            port=parsed.port,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        cursor.execute(create_sql)
        
        cursor.close()
        conn.close()
        
        result["success"] = True
        result["message"] = f"Table '{table_name}' created successfully"
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def drop_database_table(environment: str, table_name: str) -> Dict:
    """Delete a database table."""
    result = {
        "success": False,
        "environment": environment,
        "table_name": table_name,
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        for file_info in config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                db_url = file_info["database_url"]
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        # Parse URL
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        
        # Build DROP TABLE SQL
        drop_sql = f'DROP TABLE IF EXISTS "{table_name}" CASCADE;'
        
        # Connect and execute
        import psycopg2
        conn = psycopg2.connect(
            host="localhost",
            port=parsed.port,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        cursor.execute(drop_sql)
        
        cursor.close()
        conn.close()
        
        result["success"] = True
        result["message"] = f"Table '{table_name}' deleted successfully"
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


# ============= DATABASE TOOLKIT =============

async def list_database_users(environment: str) -> Dict:
    """List all database users with their roles and permissions."""
    result = {
        "environment": environment,
        "users": [],
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        cursor = conn.cursor()
        
        # Get all users (roles) with their attributes
        cursor.execute("""
            SELECT 
                r.rolname as username,
                r.rolsuper as is_superuser,
                r.rolcreaterole as can_create_role,
                r.rolcreatedb as can_create_db,
                r.rolcanlogin as can_login,
                r.rolreplication as can_replicate,
                ARRAY(SELECT b.rolname FROM pg_catalog.pg_auth_members m
                      JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid)
                      WHERE m.member = r.oid) as member_of
            FROM pg_catalog.pg_roles r
            WHERE r.rolname !~ '^pg_'
            ORDER BY r.rolname;
        """)
        
        users = []
        for row in cursor.fetchall():
            users.append({
                "username": row[0],
                "is_superuser": row[1],
                "can_create_role": row[2],
                "can_create_db": row[3],
                "can_login": row[4],
                "can_replicate": row[5],
                "member_of": row[6] if row[6] else []
            })
        
        result["users"] = users
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def create_database_user(environment: str, username: str, password: str, privileges: dict) -> Dict:
    """Create a new database user with specified privileges."""
    result = {
        "success": False,
        "environment": environment,
        "username": username,
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Escape password
        escaped_password = password.replace("'", "''")
        
        # Build CREATE USER command
        create_sql = f'CREATE USER "{username}" WITH PASSWORD \'{escaped_password}\''
        
        # Add privileges
        if privileges.get("can_login", True):
            create_sql += " LOGIN"
        if privileges.get("can_create_db", False):
            create_sql += " CREATEDB"
        if privileges.get("can_create_role", False):
            create_sql += " CREATEROLE"
        if privileges.get("is_superuser", False):
            create_sql += " SUPERUSER"
        
        create_sql += ";"
        
        cursor.execute(create_sql)
        
        result["success"] = True
        result["message"] = f"User '{username}' created successfully"
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def delete_database_user(environment: str, username: str) -> Dict:
    """Delete a database user."""
    result = {
        "success": False,
        "environment": environment,
        "username": username,
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Revoke all privileges and drop user
        cursor.execute(f'DROP USER IF EXISTS "{username}" CASCADE;')
        
        result["success"] = True
        result["message"] = f"User '{username}' deleted successfully"
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def grant_table_privileges(environment: str, username: str, table_name: str, privileges: list) -> Dict:
    """Grant privileges on a table to a user."""
    result = {
        "success": False,
        "environment": environment,
        "username": username,
        "table_name": table_name,
        "privileges": privileges,
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Build GRANT command
        privileges_str = ", ".join(privileges).upper()
        grant_sql = f'GRANT {privileges_str} ON TABLE "{table_name}" TO "{username}";'
        
        cursor.execute(grant_sql)
        
        result["success"] = True
        result["message"] = f"Granted {privileges_str} on '{table_name}' to '{username}'"
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def revoke_table_privileges(environment: str, username: str, table_name: str, privileges: list) -> Dict:
    """Revoke privileges on a table from a user."""
    result = {
        "success": False,
        "environment": environment,
        "username": username,
        "table_name": table_name,
        "privileges": privileges,
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Build REVOKE command
        privileges_str = ", ".join(privileges).upper()
        revoke_sql = f'REVOKE {privileges_str} ON TABLE "{table_name}" FROM "{username}";'
        
        cursor.execute(revoke_sql)
        
        result["success"] = True
        result["message"] = f"Revoked {privileges_str} on '{table_name}' from '{username}'"
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def optimize_database_tables(environment: str, table_names: list = None) -> Dict:
    """Optimize database tables using VACUUM ANALYZE."""
    result = {
        "success": False,
        "environment": environment,
        "optimized_tables": [],
        "message": "",
        "error": None
    }
    
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        priority_order = [".env.local", ".env", ".env.development", ".env.production", ".env.test"]
        
        for priority_file in priority_order:
            for file_info in config.get("env_files", []):
                if file_info.get("name") == priority_file and file_info.get("has_database_url") and file_info.get("database_url"):
                    db_url = file_info["database_url"]
                    break
            if db_url:
                break
        
        if not db_url:
            result["error"] = "Could not find DATABASE_URL"
            return result
        
        import psycopg2
        localhost_db_url = convert_db_url_to_localhost(db_url)
        conn = psycopg2.connect(localhost_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        if table_names:
            # Optimize specific tables
            for table_name in table_names:
                cursor.execute(f'VACUUM ANALYZE "{table_name}";')
                result["optimized_tables"].append(table_name)
        else:
            # Optimize all tables
            cursor.execute("VACUUM ANALYZE;")
            result["optimized_tables"].append("ALL TABLES")
        
        result["success"] = True
        result["message"] = f"Optimized {len(result['optimized_tables'])} table(s)"
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


# ============= ENV FILE EDITOR =============

async def get_env_files_list(directory: str) -> Dict:
    """Get list of all .env* files in the directory."""
    result = {
        "directory": directory,
        "files": [],
        "error": None
    }
    
    try:
        import glob
        dir_path = Path(directory)
        
        if not dir_path.exists():
            result["error"] = f"Directory not found: {directory}"
            return result
        
        # Always include standard .env files (even if they don't exist)
        standard_patterns = [".env", ".env.local", ".env.production", ".env.development", ".env.test"]
        env_files = list(standard_patterns)
        
        # Also check for any other .env* files that actually exist
        for env_file in glob.glob(str(dir_path / ".env*")):
            basename = os.path.basename(env_file)
            # Only include files (not directories) and not already in list
            if os.path.isfile(env_file) and basename not in env_files:
                env_files.append(basename)
        
        # Sort with priority: .env.local, .env, then others alphabetically
        priority_order = [".env.local", ".env", ".env.production", ".env.development", ".env.test"]
        sorted_files = []
        
        for priority_file in priority_order:
            if priority_file in env_files:
                sorted_files.append(priority_file)
                env_files.remove(priority_file)
        
        # Add remaining files alphabetically
        sorted_files.extend(sorted(env_files))
        
        result["files"] = sorted_files
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def read_env_file(directory: str, filename: str) -> Dict:
    """Read content of a specific .env file."""
    result = {
        "directory": directory,
        "filename": filename,
        "content": "",
        "exists": False,
        "error": None
    }
    
    try:
        file_path = Path(directory) / filename
        
        if not file_path.exists():
            result["error"] = f"File not found: {filename}"
            return result
        
        if not file_path.is_file():
            result["error"] = f"Not a file: {filename}"
            return result
        
        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        result["content"] = content
        result["exists"] = True
        result["size_bytes"] = os.path.getsize(file_path)
        result["lines"] = len(content.splitlines())
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def write_env_file(directory: str, filename: str, content: str) -> Dict:
    """Write content to a specific .env file."""
    result = {
        "directory": directory,
        "filename": filename,
        "success": False,
        "backup_created": False,
        "backup_path": None,
        "error": None
    }
    
    try:
        file_path = Path(directory) / filename
        
        # Create backup if file exists
        if file_path.exists():
            import shutil
            from datetime import datetime
            
            backup_dir = Path(directory) / ".env-backups"
            backup_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{filename}.backup_{timestamp}"
            backup_path = backup_dir / backup_filename
            
            shutil.copy2(file_path, backup_path)
            result["backup_created"] = True
            result["backup_path"] = str(backup_path)
        
        # Write new content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        result["success"] = True
        result["size_bytes"] = os.path.getsize(file_path)
        result["lines"] = len(content.splitlines())
        
    except Exception as e:
        result["error"] = str(e)
    
    return result
