"""Build Dashboard installation and update operations"""
import subprocess
import shutil
from pathlib import Path
from typing import Dict
from config import settings


async def install_build_dashboard() -> Dict:
    """
    Copy build dashboard files and rebuild
    
    Steps:
    1. Copy files from dev repo to /var/www/build
    2. Install dependencies (if package.json changed)
    3. Build frontend
    4. Restart API server
    
    Returns status dict with progress updates
    """
    source_dir = Path(settings.DEV_DIR) / "Documentation_new" / "build-dashboard"
    target_dir = Path("/var/www/build")
    
    result = {
        "success": False,
        "message": "",
        "steps": [],
        "error": None
    }
    
    try:
        # Step 1: Verify source directory exists
        if not source_dir.exists():
            result["error"] = f"Source directory not found: {source_dir}"
            return result
        
        result["steps"].append({
            "step": "verify_source",
            "status": "success",
            "message": "Source directory verified"
        })
        
        # Step 2: Backup current build dashboard (optional)
        try:
            backup_dir = Path("/var/www/build_backup")
            if target_dir.exists():
                if backup_dir.exists():
                    shutil.rmtree(backup_dir)
                shutil.copytree(target_dir, backup_dir)
                result["steps"].append({
                    "step": "backup",
                    "status": "success",
                    "message": "Created backup"
                })
        except Exception as e:
            result["steps"].append({
                "step": "backup",
                "status": "warning",
                "message": f"Backup failed (non-critical): {str(e)}"
            })
        
        # Step 3: Copy API files
        try:
            api_source = source_dir / "api"
            api_target = target_dir / "api"
            
            # Copy Python files
            for py_file in api_source.glob("*.py"):
                shutil.copy2(py_file, api_target / py_file.name)
            
            result["steps"].append({
                "step": "copy_api",
                "status": "success",
                "message": "API files copied"
            })
        except Exception as e:
            result["error"] = f"Failed to copy API files: {str(e)}"
            return result
        
        # Step 4: Build web frontend
        try:
            web_source = source_dir / "web"
            
            # Check if package.json changed - install deps if needed
            install_deps = False
            if (web_source / "package.json").exists():
                # Compare package.json timestamps or always install to be safe
                install_deps = True
            
            if install_deps:
                # Install dependencies
                install_result = subprocess.run(
                    ["npm", "install"],
                    cwd=str(web_source),
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                if install_result.returncode != 0:
                    result["error"] = f"npm install failed: {install_result.stderr}"
                    return result
                
                result["steps"].append({
                    "step": "install_deps",
                    "status": "success",
                    "message": "Dependencies installed"
                })
            
            # Build frontend
            build_result = subprocess.run(
                ["npx", "vite", "build"],
                cwd=str(web_source),
                capture_output=True,
                text=True,
                timeout=300
            )
            if build_result.returncode != 0:
                result["error"] = f"vite build failed: {build_result.stderr}"
                return result
            
            result["steps"].append({
                "step": "build_frontend",
                "status": "success",
                "message": "Frontend built successfully"
            })
            
            # Copy build output
            build_output = web_source / "build"
            web_target = target_dir / "web" / "build"
            
            if web_target.exists():
                shutil.rmtree(web_target)
            shutil.copytree(build_output, web_target)
            
            result["steps"].append({
                "step": "copy_frontend",
                "status": "success",
                "message": "Frontend files copied"
            })
            
        except subprocess.TimeoutExpired:
            result["error"] = "Build process timed out"
            return result
        except Exception as e:
            result["error"] = f"Failed to build frontend: {str(e)}"
            return result
        
        # Step 5: Restart API server using systemd service
        try:
            # Restart the systemd service
            restart_result = subprocess.run(
                ["systemctl", "restart", "build-dashboard-api"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if restart_result.returncode != 0:
                result["error"] = f"Failed to restart service: {restart_result.stderr}"
                return result
            
            # Wait a moment for service to start
            import time
            time.sleep(2)
            
            # Verify service is running
            status_result = subprocess.run(
                ["systemctl", "is-active", "build-dashboard-api"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if status_result.stdout.strip() == "active":
                result["steps"].append({
                    "step": "restart_api",
                    "status": "success",
                    "message": "API service restarted successfully"
                })
            else:
                result["error"] = "Service restart completed but service is not active"
                return result
            
        except subprocess.TimeoutExpired:
            result["error"] = "Service restart timed out"
            return result
        except Exception as e:
            result["error"] = f"Failed to restart API service: {str(e)}"
            return result
        
        # Success!
        result["success"] = True
        result["message"] = "Build Dashboard updated successfully"
        
    except Exception as e:
        result["error"] = f"Unexpected error: {str(e)}"
    
    return result


async def get_build_dashboard_status() -> Dict:
    """Get current build dashboard version/status"""
    try:
        # Check if API is running
        api_running = subprocess.run(
            ["pgrep", "-f", "uvicorn main:app"],
            capture_output=True
        ).returncode == 0
        
        return {
            "api_running": api_running,
            "target_dir": "/var/www/build"
        }
    except Exception as e:
        return {
            "error": str(e)
        }
