"""PM2 process management operations"""
import subprocess
import json
from typing import Dict, Any, Optional
from config import settings
from models import PM2ReloadResponse


def get_pm2_status(app_name: str) -> Optional[Dict[str, Any]]:
    """Get PM2 process status"""
    try:
        result = subprocess.run(
            ["pm2", "jlist"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            return None
        
        processes = json.loads(result.stdout)
        for proc in processes:
            if proc.get("name") == app_name:
                return {
                    "name": proc.get("name"),
                    "status": proc.get("pm2_env", {}).get("status"),
                    "pid": proc.get("pid"),
                    "uptime": proc.get("pm2_env", {}).get("pm_uptime"),
                    "memory": proc.get("monit", {}).get("memory"),
                    "cpu": proc.get("monit", {}).get("cpu"),
                    "restarts": proc.get("pm2_env", {}).get("restart_time", 0)
                }
        
        return None
    except Exception as e:
        print(f"Error getting PM2 status: {e}")
        return None


def is_pm2_running(app_name: str) -> bool:
    """Check if PM2 process is running"""
    status = get_pm2_status(app_name)
    return status is not None and status.get("status") == "online"


async def reload_pm2_app(app_name: str) -> PM2ReloadResponse:
    """
    Reload PM2 application (zero-downtime restart)
    
    Args:
        app_name: PM2 application name
        
    Returns:
        PM2ReloadResponse with reload result
    """
    try:
        # Check if app exists and is running
        status = get_pm2_status(app_name)
        
        if not status:
            return PM2ReloadResponse(
                success=False,
                message=f"PM2 app '{app_name}' not found"
            )
        
        if status.get("status") != "online":
            return PM2ReloadResponse(
                success=False,
                message=f"PM2 app '{app_name}' is not online (status: {status.get('status')})"
            )
        
        # Reload the app
        result = subprocess.run(
            ["pm2", "reload", app_name],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return PM2ReloadResponse(
                success=False,
                message=f"Failed to reload: {result.stderr or result.stdout}"
            )
        
        # Wait a moment and check status
        import asyncio
        await asyncio.sleep(2)
        
        new_status = get_pm2_status(app_name)
        
        return PM2ReloadResponse(
            success=True,
            message=f"Successfully reloaded '{app_name}'",
            status=new_status
        )
        
    except subprocess.TimeoutExpired:
        return PM2ReloadResponse(
            success=False,
            message="Reload operation timed out"
        )
    except Exception as e:
        return PM2ReloadResponse(
            success=False,
            message=f"Reload error: {str(e)}"
        )


async def restart_pm2_app(app_name: str) -> PM2ReloadResponse:
    """
    Restart PM2 application (full restart)
    
    Args:
        app_name: PM2 application name
        
    Returns:
        PM2ReloadResponse with restart result
    """
    try:
        # Restart the app
        result = subprocess.run(
            ["pm2", "restart", app_name],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return PM2ReloadResponse(
                success=False,
                message=f"Failed to restart: {result.stderr or result.stdout}"
            )
        
        # Wait a moment and check status
        import asyncio
        await asyncio.sleep(3)
        
        new_status = get_pm2_status(app_name)
        
        return PM2ReloadResponse(
            success=True,
            message=f"Successfully restarted '{app_name}'",
            status=new_status
        )
        
    except subprocess.TimeoutExpired:
        return PM2ReloadResponse(
            success=False,
            message="Restart operation timed out"
        )
    except Exception as e:
        return PM2ReloadResponse(
            success=False,
            message=f"Restart error: {str(e)}"
        )

