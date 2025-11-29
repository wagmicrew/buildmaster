"""Build operations and status tracking

Integrates with build-production-unified.mjs for Next.js builds.
Parses log output with prefixes: [BUILD], [STEP N], [OK], [INFO], [WARN], [ERROR]
"""
import subprocess
import uuid
import json
import os
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path
from enum import Enum
from dataclasses import dataclass
import asyncio
from config import settings
from models import BuildConfig, BuildStatus, BuildStatusResponse
from email_service import send_build_started_email, send_build_completed_email, send_build_stalled_email
from system_metrics import clear_workers


# In-memory build storage (in production, use SQLite)
_build_storage: Dict[str, Dict] = {}
_running_processes: Dict[str, asyncio.subprocess.Process] = {}

# Build timeout and sanity check constants
BUILD_TIMEOUT_SECONDS = 1800  # 30 minutes max build time
BUILD_STALL_TIMEOUT_SECONDS = 600  # 10 minutes no output = stalled
BUILD_SANITY_CHECK_INTERVAL = 30  # Check every 30 seconds
MAX_BUILD_SIZE_MB = 2048  # Warn if .next exceeds 2GB

# Build step weights for progress calculation
BUILD_STEPS = {
    0: {'name': 'Kill zombies', 'weight': 2},
    1: {'name': 'Stop PM2', 'weight': 5},
    2: {'name': 'Stop Redis', 'weight': 2},
    3: {'name': 'Check memory', 'weight': 1},
    4: {'name': 'Install deps', 'weight': 10},
    5: {'name': 'Build app', 'weight': 60},
    6: {'name': 'Verify build', 'weight': 3},
    7: {'name': 'Start Redis', 'weight': 2},
    8: {'name': 'Restart PM2', 'weight': 12},
    9: {'name': 'Switch Nginx', 'weight': 3},
}


class LogLevel(Enum):
    BUILD = "build"
    STEP = "step"
    OK = "ok"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


@dataclass
class BuildLogEntry:
    level: LogLevel
    message: str
    step: Optional[int] = None
    timestamp: datetime = None


def parse_log_line(line: str) -> Optional[BuildLogEntry]:
    """Parse a single log line from build output"""
    # Remove ANSI codes if any slip through
    line = re.sub(r'\x1b\[[0-9;]*m', '', line)
    line = line.strip()
    
    if not line:
        return None
    
    timestamp = datetime.utcnow()
    
    if line.startswith('[BUILD]'):
        return BuildLogEntry(level=LogLevel.BUILD, message=line[7:].strip(), timestamp=timestamp)
    
    if line.startswith('[STEP'):
        match = re.match(r'\[STEP (\d+)\] (.+)', line)
        if match:
            return BuildLogEntry(
                level=LogLevel.STEP,
                message=match.group(2),
                step=int(match.group(1)),
                timestamp=timestamp
            )
    
    if line.startswith('[OK]'):
        return BuildLogEntry(level=LogLevel.OK, message=line[4:].strip(), timestamp=timestamp)
    
    if line.startswith('[INFO]'):
        return BuildLogEntry(level=LogLevel.INFO, message=line[6:].strip(), timestamp=timestamp)
    
    if line.startswith('[WARN]'):
        return BuildLogEntry(level=LogLevel.WARN, message=line[6:].strip(), timestamp=timestamp)
    
    if line.startswith('[ERROR]'):
        return BuildLogEntry(level=LogLevel.ERROR, message=line[7:].strip(), timestamp=timestamp)
    
    # Untagged line (Next.js output, etc.)
    return BuildLogEntry(level=LogLevel.INFO, message=line, timestamp=timestamp)


def calculate_progress(current_step: int, step_complete: bool = False) -> float:
    """Calculate build progress percentage based on weighted steps"""
    total_weight = sum(s['weight'] for s in BUILD_STEPS.values())
    completed_weight = sum(
        BUILD_STEPS[s]['weight'] 
        for s in BUILD_STEPS 
        if s < current_step or (s == current_step and step_complete)
    )
    return min(99.0, (completed_weight / total_weight) * 100)


def is_build_successful(output: str, exit_code: int) -> bool:
    """Check if build completed successfully"""
    if exit_code != 0:
        return False
    
    success_indicators = [
        'Server build and restart completed!',
        'BUILD COMPLETED SUCCESSFULLY',
        'BUILD_COMPLETED created',
        'Build completed successfully'
    ]
    
    return any(indicator in output for indicator in success_indicators)


def extract_errors(output: str) -> List[str]:
    """Extract error messages from build output"""
    errors = []
    
    for line in output.split('\n'):
        line = line.strip()
        
        if line.startswith('[ERROR]'):
            errors.append(line[7:].strip())
        
        # Next.js specific errors
        if 'Build error' in line or 'Failed to compile' in line:
            errors.append(line)
        
        # Memory errors
        if 'FATAL ERROR' in line or 'heap out of memory' in line.lower():
            errors.append(line)
    
    return errors


def extract_timings(output: str) -> Dict[str, float]:
    """Extract timing breakdown from build output"""
    timings = {}
    
    if 'Timing breakdown:' in output:
        lines = output.split('\n')
        in_timing_section = False
        
        for line in lines:
            if 'Timing breakdown:' in line:
                in_timing_section = True
                continue
            
            if in_timing_section:
                # Parse lines like "[INFO]   Kill zombies: 3.21s"
                match = re.match(r'.*?(\w[\w\s]+):\s*([\d.]+)s', line)
                if match:
                    step_name = match.group(1).strip()
                    duration = float(match.group(2))
                    timings[step_name] = duration
                elif line.strip() and not line.strip().startswith('[INFO]'):
                    break
    
    # Extract total time
    total_match = re.search(r'Total time:\s*([\d.]+)s', output)
    if total_match:
        timings['total'] = float(total_match.group(1))
    
    return timings


def get_current_step_from_log(log_content: str) -> tuple[int, str]:
    """Extract current step number and name from log content"""
    step_matches = re.findall(r'\[STEP (\d+)\] (.+)', log_content)
    if step_matches:
        last_step = step_matches[-1]
        return int(last_step[0]), last_step[1]
    return 0, "Initializing"


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
    """
    Run the build process using pnpm run build:server
    
    Integrates with build-production-unified.mjs which outputs:
    - [BUILD] General messages
    - [STEP N] Step progress
    - [OK] Success messages
    - [INFO] Informational
    - [WARN] Warnings
    - [ERROR] Errors
    """
    log_path = get_build_log_path(build_id)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Update status to running
    status_data = load_build_status(build_id)
    if status_data:
        status_data["status"] = BuildStatus.RUNNING.value
        status_data["message"] = "Build starting..."
        status_data["current_step"] = "INIT"
        status_data["progress"] = 0
        save_build_status(build_id, status_data)
    
    try:
        working_dir = settings.DEV_DIR
        
        # Build environment variables for build-production-unified.mjs
        env = os.environ.copy()
        env["BUILD_ID"] = build_id
        
        # Determine build script based on build mode
        build_mode = config.build_mode.value if hasattr(config.build_mode, 'value') else str(config.build_mode)
        
        # Map build mode to build script
        build_script_map = {
            "quick": "build:quick",
            "full": "build:server",
            "phased": "build:phased",
            "phased-prod": "build:phased:prod",
            "clean": "build:clean",
            "ram-optimized": "build:server"
        }
        
        build_script = build_script_map.get(build_mode, "build:server")
        
        # Set environment variables based on build mode
        if build_mode == "quick":
            env["BUILD_MODE"] = "quick"
            env["SKIP_DEPS"] = "true"
            env["SKIP_PM2"] = "true"
            env["SKIP_REDIS"] = "true"
        elif build_mode == "clean":
            env["BUILD_MODE"] = "full"
            env["FORCE_CLEAN"] = "true"
        elif build_mode == "phased":
            env["BUILD_MODE"] = "phased"
        elif build_mode == "phased-prod":
            env["BUILD_MODE"] = "phased"
            env["SKIP_DEPS"] = "false"
            env["TEST_DATABASE"] = "true"
            env["TEST_REDIS"] = "true"
        else:  # full, ram-optimized
            env["BUILD_MODE"] = "full"
        
        # Skip dependencies installation (only if not already set)
        if "SKIP_DEPS" not in env:
            env["SKIP_DEPS"] = "true" if config.skip_deps else "false"
        
        # Clear .next cache before build
        if "FORCE_CLEAN" not in env:
            env["FORCE_CLEAN"] = "false" if config.force_clean else "true"
        
        # Quick build (skip static generation)
        env["QUICK_BUILD"] = "true" if build_mode == "quick" else "false"
        
        # Force full rebuild
        env["FORCE_FULL_BUILD"] = "true" if build_mode == "full" else "false"
        
        # Memory settings (auto-detected by script, but can override)
        if config.max_old_space_size and config.max_old_space_size > 0:
            env["MAX_OLD_SPACE"] = str(config.max_old_space_size)
        
        # Workers (auto-detected by script)
        if workers and workers > 0:
            env["BUILD_WORKERS"] = str(workers)
        
        # Build script is already determined above
        
        # Run the selected build script
        with open(log_path, "w", encoding='utf-8', errors='replace') as log_file:
            # Write initial header
            log_file.write(f"[BUILD] BuildMaster Build Started\n")
            log_file.write(f"[INFO] Build ID: {build_id}\n")
            log_file.write(f"[INFO] Build Script: pnpm run {build_script}\n")
            log_file.write(f"[INFO] Mode: {build_mode}\n")
            log_file.write(f"[INFO] Working Directory: {working_dir}\n")
            log_file.write(f"[INFO] Skip Deps: {env.get('SKIP_DEPS', 'false')}\n")
            log_file.write(f"[INFO] Force Clean: {env.get('FORCE_CLEAN', 'false')}\n")
            log_file.write(f"[INFO] Test Database: {env.get('TEST_DATABASE', 'false')}\n")
            log_file.write(f"[INFO] Test Redis: {env.get('TEST_REDIS', 'false')}\n")
            log_file.write(f"[INFO] Max Old Space: {env.get('MAX_OLD_SPACE', 'auto')}\n")
            log_file.write(f"[INFO] Workers: {env.get('BUILD_WORKERS', 'auto')}\n")
            log_file.write(f"[BUILD] ================================\n\n")
            log_file.flush()
            
            process = await asyncio.create_subprocess_exec(
                "pnpm", "run", build_script,
                cwd=working_dir,
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT
            )
            
            # Store process for kill functionality
            _running_processes[build_id] = process
            
            # Monitor process with heartbeat and sanity checks
            build_start_time = datetime.utcnow()
            last_output_time = datetime.utcnow()
            last_output_size = 0
            last_step = 0
            last_sanity_check = datetime.utcnow()
            
            while True:
                await asyncio.sleep(5)  # Check every 5 seconds
                
                # Check if process is done
                if process.returncode is not None:
                    _running_processes.pop(build_id, None)
                    break
                
                current_time = datetime.utcnow()
                elapsed_seconds = (current_time - build_start_time).total_seconds()
                
                # SANITY CHECK 1: Hard timeout (30 minutes default)
                if elapsed_seconds > BUILD_TIMEOUT_SECONDS:
                    status_data = load_build_status(build_id)
                    if status_data:
                        status_data["status"] = BuildStatus.ERROR.value
                        status_data["error_type"] = "TIMEOUT"
                        status_data["message"] = f"Build exceeded maximum time limit ({BUILD_TIMEOUT_SECONDS // 60} minutes)"
                        status_data["error"] = (
                            f"Build timeout after {int(elapsed_seconds)} seconds.\n\n"
                            f"Suggestions:\n"
                            f"1. Use 'build:phased' for large projects\n"
                            f"2. Increase memory with --max-old-space-size\n"
                            f"3. Check for infinite loops in build scripts\n"
                            f"4. Use 'build:quick' for faster iteration"
                        )
                        save_build_status(build_id, status_data)
                    
                    try:
                        await send_build_stalled_email(build_id, f"Build timed out after {int(elapsed_seconds)} seconds")
                    except:
                        pass
                    
                    process.kill()
                    print(f"[BUILD] Killed build {build_id} - exceeded {BUILD_TIMEOUT_SECONDS}s timeout")
                    break
                
                # Parse log for progress updates
                if log_path.exists():
                    try:
                        current_size = log_path.stat().st_size
                        
                        with open(log_path, "r", encoding='utf-8', errors='replace') as f:
                            content = f.read()
                        
                        # Get current step from log
                        current_step, step_name = get_current_step_from_log(content)
                        
                        if current_step != last_step:
                            last_step = current_step
                            progress = calculate_progress(current_step)
                            
                            status_data = load_build_status(build_id)
                            if status_data:
                                status_data["current_step"] = f"STEP_{current_step}"
                                status_data["progress"] = round(progress, 1)
                                status_data["message"] = step_name
                                status_data["elapsed_seconds"] = int(elapsed_seconds)
                                save_build_status(build_id, status_data)
                        
                        # SANITY CHECK 2: Stall detection (no output for 10 minutes)
                        if current_size != last_output_size:
                            last_output_size = current_size
                            last_output_time = datetime.utcnow()
                        elif (current_time - last_output_time).total_seconds() > BUILD_STALL_TIMEOUT_SECONDS:
                            # Build stalled - no output for 10 minutes
                            status_data = load_build_status(build_id)
                            if status_data:
                                status_data["status"] = BuildStatus.STALLED.value
                                status_data["error_type"] = "STALLED"
                                status_data["message"] = f"Build stalled - no output for {BUILD_STALL_TIMEOUT_SECONDS // 60} minutes"
                                status_data["error"] = (
                                    f"Build appears to be stuck.\n\n"
                                    f"Last output was {int((current_time - last_output_time).total_seconds())} seconds ago.\n"
                                    f"Total elapsed time: {int(elapsed_seconds)} seconds.\n\n"
                                    f"Suggestions:\n"
                                    f"1. Check memory usage - may be swapping\n"
                                    f"2. Use 'build:phased' for memory-safe builds\n"
                                    f"3. Reduce worker count\n"
                                    f"4. Check for network issues if fetching packages"
                                )
                                save_build_status(build_id, status_data)
                            
                            try:
                                await send_build_stalled_email(build_id, content[-2000:])
                            except:
                                pass
                            
                            process.kill()
                            print(f"[BUILD] Killed build {build_id} - stalled for {BUILD_STALL_TIMEOUT_SECONDS}s")
                            break
                        
                        # SANITY CHECK 3: Periodic health checks (every 30 seconds)
                        if (current_time - last_sanity_check).total_seconds() > BUILD_SANITY_CHECK_INTERVAL:
                            last_sanity_check = current_time
                            
                            # Check for memory errors in log
                            if "heap out of memory" in content.lower() or "fatal error" in content.lower():
                                status_data = load_build_status(build_id)
                                if status_data:
                                    status_data["status"] = BuildStatus.ERROR.value
                                    status_data["error_type"] = "OUT_OF_MEMORY"
                                    status_data["message"] = "Build crashed - out of memory"
                                    status_data["error"] = (
                                        f"Memory exhausted during build.\n\n"
                                        f"Suggestions:\n"
                                        f"1. Increase --max-old-space-size (current may be too low)\n"
                                        f"2. Use 'build:phased' for memory-safe builds\n"
                                        f"3. Reduce parallel workers\n"
                                        f"4. Close other applications on the server"
                                    )
                                    save_build_status(build_id, status_data)
                                
                                process.kill()
                                print(f"[BUILD] Killed build {build_id} - out of memory detected")
                                break
                            
                            # Update elapsed time in status
                            status_data = load_build_status(build_id)
                            if status_data:
                                status_data["elapsed_seconds"] = int(elapsed_seconds)
                                # Add warning if build is taking too long
                                if elapsed_seconds > 900:  # 15 minutes
                                    status_data["warning"] = f"Build running for {int(elapsed_seconds // 60)} minutes"
                                save_build_status(build_id, status_data)
                            
                    except Exception as e:
                        print(f"Error parsing log: {e}")
            
            await process.wait()
        
        # Read final log content
        log_content = ""
        if log_path.exists():
            with open(log_path, "r", encoding='utf-8', errors='replace') as f:
                log_content = f.read()
        
        # Determine result
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
        
        # Check success using both exit code AND success message
        if process.returncode == 0 and is_build_successful(log_content, process.returncode):
            status_data["status"] = BuildStatus.SUCCESS.value
            status_data["message"] = "Build completed successfully"
            status_data["progress"] = 100.0
            status_data["current_step"] = "COMPLETE"
            
            # Extract and store timing info
            timings = extract_timings(log_content)
            if timings:
                status_data["timings"] = timings
        else:
            status_data["status"] = BuildStatus.ERROR.value
            
            # Extract specific errors
            errors = extract_errors(log_content)
            if errors:
                status_data["message"] = f"Build failed: {errors[0]}"
                status_data["error"] = '\n'.join(errors[:10])
            else:
                status_data["message"] = f"Build failed with exit code {process.returncode}"
                status_data["error"] = log_content[-3000:] if log_content else "Unknown error"
            
            # Determine error type
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
                status_data["status"] == BuildStatus.SUCCESS.value,
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

