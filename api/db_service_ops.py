"""Database service management operations"""
import subprocess
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime


async def get_postgres_status() -> Dict[str, Any]:
    """Get PostgreSQL service status"""
    try:
        result = subprocess.run(
            ["systemctl", "status", "postgresql"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        is_running = result.returncode == 0
        
        # Parse status output
        status_lines = result.stdout.split('\n') if result.stdout else []
        active_line = next((l for l in status_lines if 'Active:' in l), '')
        
        # Get more details
        version_result = subprocess.run(
            ["psql", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        version = version_result.stdout.strip() if version_result.returncode == 0 else "Unknown"
        
        return {
            "service": "postgresql",
            "running": is_running,
            "status": "active" if is_running else "inactive",
            "active_line": active_line.strip(),
            "version": version,
            "timestamp": datetime.utcnow().isoformat()
        }
    except subprocess.TimeoutExpired:
        return {
            "service": "postgresql",
            "running": False,
            "status": "timeout",
            "error": "Status check timed out",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "service": "postgresql",
            "running": False,
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


async def get_redis_status() -> Dict[str, Any]:
    """Get Redis service status"""
    try:
        result = subprocess.run(
            ["systemctl", "status", "redis-server"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        is_running = result.returncode == 0
        
        # Parse status output
        status_lines = result.stdout.split('\n') if result.stdout else []
        active_line = next((l for l in status_lines if 'Active:' in l), '')
        
        # Try redis-cli ping
        ping_result = subprocess.run(
            ["redis-cli", "ping"],
            capture_output=True,
            text=True,
            timeout=5
        )
        ping_ok = ping_result.returncode == 0 and "PONG" in ping_result.stdout
        
        return {
            "service": "redis-server",
            "running": is_running and ping_ok,
            "status": "active" if (is_running and ping_ok) else "inactive",
            "active_line": active_line.strip(),
            "ping": "PONG" if ping_ok else "FAILED",
            "timestamp": datetime.utcnow().isoformat()
        }
    except subprocess.TimeoutExpired:
        return {
            "service": "redis-server",
            "running": False,
            "status": "timeout",
            "error": "Status check timed out",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "service": "redis-server",
            "running": False,
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


async def start_postgres() -> Dict[str, Any]:
    """Start PostgreSQL service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "start", "postgresql"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Wait a moment and check status
            await asyncio.sleep(2)
            status = await get_postgres_status()
            return {
                "success": True,
                "message": "PostgreSQL started successfully",
                "status": status
            }
        else:
            return {
                "success": False,
                "message": "Failed to start PostgreSQL",
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error starting PostgreSQL",
            "error": str(e)
        }


async def stop_postgres() -> Dict[str, Any]:
    """Stop PostgreSQL service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "stop", "postgresql"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "PostgreSQL stopped successfully"
            }
        else:
            return {
                "success": False,
                "message": "Failed to stop PostgreSQL",
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error stopping PostgreSQL",
            "error": str(e)
        }


async def restart_postgres() -> Dict[str, Any]:
    """Restart PostgreSQL service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "restart", "postgresql"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            # Wait a moment and check status
            await asyncio.sleep(3)
            status = await get_postgres_status()
            return {
                "success": True,
                "message": "PostgreSQL restarted successfully",
                "status": status
            }
        else:
            return {
                "success": False,
                "message": "Failed to restart PostgreSQL",
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error restarting PostgreSQL",
            "error": str(e)
        }


async def start_redis() -> Dict[str, Any]:
    """Start Redis service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "start", "redis-server"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            await asyncio.sleep(2)
            status = await get_redis_status()
            return {
                "success": True,
                "message": "Redis started successfully",
                "status": status
            }
        else:
            return {
                "success": False,
                "message": "Failed to start Redis",
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error starting Redis",
            "error": str(e)
        }


async def stop_redis() -> Dict[str, Any]:
    """Stop Redis service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "stop", "redis-server"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Redis stopped successfully"
            }
        else:
            return {
                "success": False,
                "message": "Failed to stop Redis",
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error stopping Redis",
            "error": str(e)
        }


async def restart_redis() -> Dict[str, Any]:
    """Restart Redis service"""
    try:
        result = subprocess.run(
            ["sudo", "systemctl", "restart", "redis-server"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            await asyncio.sleep(2)
            status = await get_redis_status()
            return {
                "success": True,
                "message": "Redis restarted successfully",
                "status": status
            }
        else:
            return {
                "success": False,
                "message": "Failed to restart Redis",
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "message": "Error restarting Redis",
            "error": str(e)
        }


async def run_postgres_maintenance() -> Dict[str, Any]:
    """Run PostgreSQL maintenance tasks (VACUUM, ANALYZE)"""
    try:
        # Run VACUUM ANALYZE on all databases
        result = subprocess.run(
            ["sudo", "-u", "postgres", "vacuumdb", "--all", "--analyze"],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "PostgreSQL maintenance completed (VACUUM ANALYZE)",
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "message": "Maintenance failed",
                "error": result.stderr or result.stdout
            }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "message": "Maintenance timed out after 5 minutes"
        }
    except Exception as e:
        return {
            "success": False,
            "message": "Error running maintenance",
            "error": str(e)
        }


async def get_postgres_connections() -> Dict[str, Any]:
    """Get current PostgreSQL connections"""
    try:
        result = subprocess.run(
            ["sudo", "-u", "postgres", "psql", "-c", 
             "SELECT datname, usename, client_addr, state, query_start FROM pg_stat_activity WHERE state IS NOT NULL ORDER BY query_start DESC;"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "connections": result.stdout
            }
        else:
            return {
                "success": False,
                "error": result.stderr or result.stdout
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def get_all_services_status() -> Dict[str, Any]:
    """Get status of all database-related services"""
    postgres = await get_postgres_status()
    redis = await get_redis_status()
    
    return {
        "postgresql": postgres,
        "redis": redis,
        "timestamp": datetime.utcnow().isoformat()
    }
