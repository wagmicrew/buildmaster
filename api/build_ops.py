"""Build operations and status tracking"""
import subprocess
import uuid
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path
import asyncio
from config import settings
from models import BuildConfig, BuildStatus, BuildStatusResponse
from email_service import send_build_started_email, send_build_completed_email, send_build_stalled_email
from system_metrics import clear_workers


# In-memory build storage (in production, use SQLite)
_build_storage: Dict[str, Dict] = {}
_running_processes: Dict[str, asyncio.subprocess.Process] = {}


def get_build_log_path(build_id: str) -> Path:
    """Get path to build log file"""
    return Path(settings.BUILD_LOG_DIR) / f"{build_id}.log"


def save_build_status(build_id: str, status_data: Dict):
    """Save build status to storage"""
    _build_storage[build_id] = status_data
    
    # Also save to JSON file for persistence
    status_file = Path(settings.BUILD_DATA_DIR) / f"{build_id}.json"
    status_file.parent.mkdir(parents=True, exist_ok=True)
    with open(status_file, "w") as f:
        json.dump(status_data, f, indent=2, default=str)


def load_build_status(build_id: str) -> Optional[Dict]:
    """Load build status from storage"""
    if build_id in _build_storage:
        return _build_storage[build_id]
    
    # Try loading from file
    status_file = Path(settings.BUILD_DATA_DIR) / f"{build_id}.json"
    if status_file.exists():
        with open(status_file, "r") as f:
            return json.load(f)
    
    return None


def calculate_optimal_workers() -> int:
    """Calculate optimal number of workers based on CPU cores"""
    try:
        import os
        cores = os.cpu_count() or 4
        # Use half the cores, minimum 2, maximum 16
        return max(2, min(16, cores // 2))
    except:
        return 4


def build_node_args(config: BuildConfig) -> list:
    """Build Node.js arguments from config"""
    args = []
    
    if config.max_old_space_size:
        args.extend(["--max-old-space-size", str(config.max_old_space_size)])
    
    if config.max_semi_space_size:
        args.extend(["--max-semi-space-size", str(config.max_semi_space_size)])
    
    return args


async def check_active_build() -> Optional[Dict]:
    """Check if there's an active build running"""
    for build_id, status in _build_storage.items():
        if status.get("status") in ["running", "pending"]:
            return status
    
    # Check recent builds from files
    build_dir = Path(settings.BUILD_DATA_DIR)
    if build_dir.exists():
        for status_file in sorted(build_dir.glob("*.json"), reverse=True, key=lambda p: p.stat().st_mtime)[:5]:
            try:
                with open(status_file, "r") as f:
                    status = json.load(f)
                    if status.get("status") in ["running", "pending"]:
                        return status
            except:
                pass
    return None


async def start_build(config: BuildConfig) -> BuildStatusResponse:
    """
    Start a build process
    
    Args:
        config: Build configuration
        
    Returns:
        BuildStatusResponse with build ID and initial status
    """
    build_id = str(uuid.uuid4())
    started_at = datetime.utcnow()
    
    # Clear any existing worker threads from previous builds
    clear_workers()
    
    # Calculate workers if not specified
    workers = config.workers or calculate_optimal_workers()
    
    # Initialize build status
    status_data = {
        "build_id": build_id,
        "status": BuildStatus.PENDING.value,
        "started_at": started_at.isoformat(),
        "completed_at": None,
        "progress": 0.0,
        "current_step": "INIT",
        "message": "Build queued",
        "error": None,
        "error_type": None,
        "config": config.dict(),
        "log_file": str(get_build_log_path(build_id)),
        "duration_seconds": None,
        "build_size_mb": None,
        "worker_count": workers
    }
    
    save_build_status(build_id, status_data)
    
    # Send notification email
    try:
        await send_build_started_email(build_id, config.dict())
    except Exception as e:
        print(f"Failed to send build started email: {e}")
    
    # Start build in background
    asyncio.create_task(run_build(build_id, config, workers))
    
    return BuildStatusResponse(
        build_id=build_id,
        status=BuildStatus.PENDING,
        started_at=started_at,
        config=config
    )


async def run_build(build_id: str, config: BuildConfig, workers: int):
    """Run the actual build process"""
    log_path = get_build_log_path(build_id)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Update status to running
    status_data = load_build_status(build_id)
    if status_data:
        status_data["status"] = BuildStatus.RUNNING.value
        status_data["message"] = "Build in progress..."
        status_data["current_step"] = "INIT"
        status_data["progress"] = 0
        save_build_status(build_id, status_data)
    
    try:
        # Build command - use our minimal build script
        working_dir = settings.DEV_DIR
        build_script = "/var/www/build/scripts/build-dev-minimal.sh"
        
        # Set environment variables for the build script
        env = os.environ.copy()
        env["BUILD_ID"] = build_id
        env["BUILD_MODE"] = config.build_mode
        env["WORKERS"] = str(workers)
        env["MAX_OLD_SPACE"] = str(config.max_old_space_size or 8192)
        env["MAX_SEMI_SPACE"] = str(config.max_semi_space_size or 0)
        env["SKIP_DEPS"] = "true" if config.skip_deps else "false"
        env["FORCE_CLEAN"] = "true" if config.force_clean else "false"
        env["TEST_DATABASE"] = "true" if config.test_database else "false"
        env["TEST_REDIS"] = "true" if config.test_redis else "false"
        env["DEV_DIR"] = working_dir
        env["LOG_FILE"] = str(log_path)
        
        # Advanced options
        env["USE_REDIS_CACHE"] = "true" if config.use_redis_cache else "false"
        env["INCREMENTAL_BUILD"] = "true" if config.incremental_build else "false"
        env["SKIP_TYPE_CHECK"] = "true" if config.skip_type_check else "false"
        env["PARALLEL_PROCESSING"] = "true" if config.parallel_processing else "false"
        env["MINIFY_OUTPUT"] = "true" if config.minify_output else "false"
        env["SOURCE_MAPS"] = "true" if config.source_maps else "false"
        env["TREE_SHAKING"] = "true" if config.tree_shaking else "false"
        env["CODE_SPLITTING"] = "true" if config.code_splitting else "false"
        env["COMPRESS_ASSETS"] = "true" if config.compress_assets else "false"
        env["OPTIMIZE_IMAGES"] = "true" if config.optimize_images else "false"
        env["REMOVE_CONSOLE_LOGS"] = "true" if config.remove_console_logs else "false"
        env["EXPERIMENTAL_TURBO"] = "true" if config.experimental_turbo else "false"
        
        # Run build script in background
        with open(log_path, "w") as log_file:
            process = await asyncio.create_subprocess_exec(
                "bash", build_script,
                cwd=working_dir,
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT
            )
            
            # Store process for kill functionality
            _running_processes[build_id] = process
            
            # Monitor process with heartbeat
            last_output_time = datetime.utcnow()
            last_output_size = 0
            
            while True:
                await asyncio.sleep(5)  # Heartbeat every 5 seconds
                
                # Check if process is done
                if process.returncode is not None:
                    # Clean up process tracking
                    _running_processes.pop(build_id, None)
                    break
                
                # Read status file created by build script
                status_file = Path(f"/var/www/build/status/{build_id}.json")
                if status_file.exists():
                    try:
                        with open(status_file, "r") as f:
                            script_status = json.load(f)
                        
                        # Update our status with script's progress
                        status_data = load_build_status(build_id)
                        if status_data:
                            status_data["current_step"] = script_status.get("current_step", "RUNNING")
                            status_data["progress"] = script_status.get("progress", 0)
                            status_data["message"] = script_status.get("message", "Build in progress...")
                            save_build_status(build_id, status_data)
                    except Exception as e:
                        print(f"Failed to read script status: {e}")
                
                # Check for stalled build (no output for 10 minutes)
                current_size = log_path.stat().st_size if log_path.exists() else 0
                if current_size != last_output_size:
                    last_output_size = current_size
                    last_output_time = datetime.utcnow()
                elif (datetime.utcnow() - last_output_time).total_seconds() > 600:
                    # Build stalled - no output for 10 minutes
                    status_data = load_build_status(build_id)
                    if status_data:
                        status_data["status"] = BuildStatus.ERROR.value
                        status_data["message"] = "Build stalled - no output for 10 minutes"
                        save_build_status(build_id, status_data)
                    
                    # Send stalled notification
                    try:
                        last_output = ""
                        if log_path.exists():
                            with open(log_path, "r") as f:
                                last_output = f.read()[-1000:]
                        await send_build_stalled_email(build_id, last_output)
                    except Exception as e:
                        print(f"Failed to send stalled email: {e}")
                    
                    # Kill process
                    process.kill()
                    break
            
            # Wait for process to complete
            await process.wait()
        
        # Read log file
        log_content = ""
        if log_path.exists():
            with open(log_path, "r") as f:
                log_content = f.read()
        
        # Update status based on return code
        completed_at = datetime.utcnow()
        status_data = load_build_status(build_id)
        
        # Calculate duration
        started_at_dt = datetime.fromisoformat(status_data["started_at"])
        duration_seconds = (completed_at - started_at_dt).total_seconds()
        
        # Get build size
        build_size_mb = None
        next_dir = Path(settings.DEV_DIR) / ".next"
        if next_dir.exists():
            try:
                total_size = sum(f.stat().st_size for f in next_dir.rglob('*') if f.is_file())
                build_size_mb = round(total_size / (1024 * 1024), 2)
            except:
                pass
        
        if process.returncode == 0:
            status_data["status"] = BuildStatus.SUCCESS.value
            status_data["message"] = "Build completed successfully"
            status_data["progress"] = 100.0
            status_data["current_step"] = "COMPLETE"
        else:
            status_data["status"] = BuildStatus.ERROR.value
            status_data["message"] = f"Build failed with exit code {process.returncode}"
            status_data["error"] = log_content[-2000:] if log_content else "Unknown error"
            
            # Determine error type from log
            error_lower = log_content.lower()
            if "out of memory" in error_lower or "heap out of memory" in error_lower:
                status_data["error_type"] = "OUT_OF_MEMORY"
            elif "econnrefused" in error_lower or "connection refused" in error_lower:
                status_data["error_type"] = "CONNECTION_ERROR"
            elif "module not found" in error_lower or "cannot find module" in error_lower:
                status_data["error_type"] = "MODULE_NOT_FOUND"
            elif "syntax error" in error_lower or "unexpected token" in error_lower:
                status_data["error_type"] = "SYNTAX_ERROR"
            elif "type error" in error_lower or "typescript error" in error_lower:
                status_data["error_type"] = "TYPE_ERROR"
            else:
                status_data["error_type"] = "BUILD_ERROR"
        
        status_data["completed_at"] = completed_at.isoformat()
        status_data["duration_seconds"] = round(duration_seconds, 2)
        status_data["build_size_mb"] = build_size_mb
        save_build_status(build_id, status_data)
        
        # Send completion email
        try:
            await send_build_completed_email(
                build_id,
                process.returncode == 0,
                status_data["message"],
                status_data.get("error")
            )
        except Exception as e:
            print(f"Failed to send completion email: {e}")
            
    except Exception as e:
        # Build error
        completed_at = datetime.utcnow()
        status_data = load_build_status(build_id)
        if status_data:
            status_data["status"] = BuildStatus.ERROR.value
            status_data["message"] = f"Build error: {str(e)}"
            status_data["error"] = str(e)
            status_data["completed_at"] = completed_at.isoformat()
            save_build_status(build_id, status_data)
        
        # Send error email
        try:
            await send_build_completed_email(build_id, False, f"Build error: {str(e)}", str(e))
        except:
            pass


async def get_build_status(build_id: str) -> Optional[BuildStatusResponse]:
    """Get build status by ID"""
    status_data = load_build_status(build_id)
    
    if not status_data:
        return None
    
    return BuildStatusResponse(
        build_id=status_data["build_id"],
        status=BuildStatus(status_data["status"]),
        started_at=datetime.fromisoformat(status_data["started_at"]),
        completed_at=datetime.fromisoformat(status_data["completed_at"]) if status_data.get("completed_at") else None,
        progress=status_data.get("progress", 0.0),
        message=status_data.get("message"),
        error=status_data.get("error"),
        config=BuildConfig(**status_data["config"]) if status_data.get("config") else None
    )


def get_build_logs(build_id: str, lines: int = 100) -> Optional[str]:
    """Get build logs (last N lines) with UTF-8 error handling"""
    log_path = get_build_log_path(build_id)
    
    if not log_path.exists():
        return None
    
    try:
        # Use error handling for UTF-8 encoding issues
        with open(log_path, "r", encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
            return "".join(all_lines[-lines:])
    except UnicodeDecodeError as e:
        # If UTF-8 fails, try with latin-1 as fallback
        try:
            with open(log_path, "r", encoding='latin-1') as f:
                all_lines = f.readlines()
                return "".join(all_lines[-lines:])
        except Exception as e2:
            return f"Error reading log: UTF-8 decode error ({str(e)}), fallback also failed ({str(e2)})"
    except Exception as e:
        return f"Error reading log: {str(e)}"


async def kill_build(build_id: str) -> Dict[str, Any]:
    """Kill a running build process"""
    try:
        # Check if build is running
        status_data = load_build_status(build_id)
        if not status_data:
            return {
                "success": False,
                "error": "Build not found"
            }
        
        if status_data.get("status") not in ["running", "pending"]:
            return {
                "success": False,
                "error": f"Build cannot be killed - current status: {status_data.get('status')}"
            }
        
        # Get the process
        process = _running_processes.get(build_id)
        if not process or process.returncode is not None:
            return {
                "success": False,
                "error": "Build process is not running"
            }
        
        # Kill the process
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            # Force kill if terminate doesn't work
            process.kill()
            await process.wait()
        
        # Update status
        status_data["status"] = BuildStatus.CANCELLED.value
        status_data["message"] = "Build was cancelled by user"
        status_data["end_time"] = datetime.utcnow().isoformat()
        save_build_status(build_id, status_data)
        
        # Clean up process tracking
        _running_processes.pop(build_id, None)
        
        return {
            "success": True,
            "message": "Build cancelled successfully"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to kill build: {str(e)}"
        }


def get_build_history(limit: int = 20) -> list:
    """Get recent build history"""
    builds = []
    
    # Load from files
    data_dir = Path(settings.BUILD_DATA_DIR)
    if data_dir.exists():
        for json_file in sorted(data_dir.glob("*.json"), reverse=True)[:limit]:
            try:
                with open(json_file, "r") as f:
                    builds.append(json.load(f))
            except:
                continue
    
    # Sort by started_at
    builds.sort(key=lambda x: x.get("started_at", ""), reverse=True)
    
    return builds[:limit]

