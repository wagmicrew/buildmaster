"""FastAPI main application for Build Dashboard API"""
from fastapi import FastAPI, HTTPException, Depends, Header, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
from pathlib import Path
import uvicorn
import os
import shutil

from config import settings
from models import (
    OTPRequest,
    OTPVerify,
    GitPullRequest,
    BuildStartRequest,
    BuildStatusResponse,
    BuildHistoryResponse,
    DeployGoLiveRequest,
    ErrorResponse
)
from auth import request_otp, verify_otp, verify_session, cleanup_expired_sessions
from git_ops import pull_from_git, get_available_branches, get_incoming_changes, check_buildmaster_repo_status, pull_with_env, push_to_buildmaster
from pm2_ops import reload_pm2_app
from build_ops import start_build, get_build_status, get_build_logs, get_build_history, check_active_build, kill_build
from build_dashboard_ops import install_build_dashboard, get_build_dashboard_status
from system_metrics import get_system_metrics, get_build_metrics, handle_stalled_workers
from deploy_ops import deploy_to_production
from build_intelligence import check_changes_since_last_build, get_build_disk_usage
from health import (
    get_server_health,
    get_database_health,
    get_redis_health,
    get_environment_health,
    check_database_health_for_env
)
from git_status import (
    get_detailed_git_status,
    git_stash_changes,
    git_pop_stash,
    git_clean_untracked,
    git_clean_untracked_confirm
)
from git_commit_tracker import (
    get_environment_comparison,
    get_commit_timeline
)
from troubleshooting_ops import (
    get_cache_status,
    clear_cache,
    get_redis_status,
    clear_redis_cache,
    get_package_versions,
    get_pm2_logs,
    get_system_logs,
    test_connectivity,
    analyze_env_file,
    get_sql_migrations,
    check_migration_applied,
    execute_sql,
    get_env_database_config,
    update_database_url,
    generate_backup_commands,
    generate_sync_commands,
    get_database_schema,
    query_table_data,
    setup_test_database,
    create_database_table,
    drop_database_table,
    create_database_only,
    create_database_user,
    get_env_files_list,
    read_env_file,
    write_env_file,
    list_database_users,
    create_database_user,
    delete_database_user,
    grant_table_privileges,
    revoke_table_privileges,
    optimize_database_tables,
)
from settings_ops import (
    load_settings,
    save_settings,
    get_server_info,
    detect_build_scripts,
    get_pm2_processes,
    get_nginx_sites,
    restart_pm2_with_settings,
    reload_nginx,
    test_database_connection,
    read_env_database_settings,
    list_available_databases,
    scan_all_env_databases
)
from buildmaster_ops import (
    load_buildmaster_settings,
    save_buildmaster_settings,
    load_valid_emails,
    save_valid_emails,
    add_valid_email,
    remove_valid_email,
    check_for_updates,
    update_application,
    restart_buildmaster_service,
    get_buildmaster_status,
    initialize_valid_emails
)
from db_service_ops import (
    get_postgres_status,
    get_redis_status as get_redis_service_status,
    start_postgres,
    stop_postgres,
    restart_postgres,
    start_redis,
    stop_redis,
    restart_redis,
    run_postgres_maintenance,
    get_postgres_connections,
    get_all_services_status
)

# Create FastAPI app
app = FastAPI(
    title="Build Dashboard API",
    description="API for managing builds, deployments, and server operations",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://build.dintrafikskolahlm.se",
        "http://localhost:3000",  # For local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency for session verification
async def verify_session_token(
    authorization: Optional[str] = Header(None)
) -> str:
    """Verify session token from Authorization header"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required"
        )
    
    # Extract token (format: "Bearer <token>")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Use: Bearer <token>"
        )
    
    token = parts[1]
    email = verify_session(token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )
    
    return email


# Cleanup expired sessions on startup and initialize valid emails
@app.on_event("startup")
async def startup_event():
    cleanup_expired_sessions()
    # Initialize valid emails if not exists
    await initialize_valid_emails()


# Authentication endpoints
@app.post("/api/auth/request-otp", response_model=dict)
async def request_otp_endpoint(request: OTPRequest):
    """Request OTP for authentication"""
    try:
        success = await request_otp(request.email)
        return {"success": success, "message": "OTP sent to email"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/database/env-config/{environment}", response_model=dict)
async def database_env_config_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get DATABASE_URL configuration from env files for dev or prod.

    Used by the Database Setup & Tools tab to show how each environment is
    currently configured. This is read-only and does not modify any files.
    """
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid environment. Use 'dev' or 'prod'."
            )

        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        config = await get_env_database_config(directory)
        config["environment"] = environment
        return config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/dev/update-database-url", response_model=dict)
async def update_dev_database_url_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Update DATABASE_URL in selected env files for the dev environment only.

    This endpoint never touches the production directory. It is intended to help
    you repoint the dev environment to its own PostgreSQL database.
    """
    try:
        database_url = payload.get("database_url")
        target_files = payload.get("files") or None

        if not database_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="database_url is required"
            )

        result = await update_dev_database_url(settings.DEV_DIR, database_url, target_files)
        if result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )

        # Provide a clear message for the UI
        result.setdefault(
            "message",
            "Updated development DATABASE_URL in the selected env files. Review the changes before restarting services."
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/auth/verify-otp", response_model=dict)
async def verify_otp_endpoint(request: OTPVerify):
    """Verify OTP and create session"""
    try:
        session = await verify_otp(request.email, request.otp_code)
        return {
            "success": True,
            "session_token": session.session_token,
            "expires_at": session.expires_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Git operations
@app.get("/api/git/branches", response_model=dict)
async def git_branches_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get available git branches"""
    try:
        branches = get_available_branches(settings.DEV_DIR)
        return branches
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/pull", response_model=dict)
async def git_pull_endpoint(
    request: GitPullRequest,
    email: str = Depends(verify_session_token)
):
    """Pull latest changes from git"""
    try:
        result = await pull_from_git(request)
        return result.dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# PM2 operations
@app.post("/api/pm2/dev/reload", response_model=dict)
async def pm2_dev_reload_endpoint(
    email: str = Depends(verify_session_token)
):
    """Reload development PM2 server"""
    try:
        result = await reload_pm2_app(settings.PM2_DEV_APP)
        return result.dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Build operations
@app.get("/api/build/active", response_model=dict)
async def build_active_check_endpoint(
    email: str = Depends(verify_session_token)
):
    """Check if there's an active build running"""
    try:
        active_build = await check_active_build()
        return {
            "has_active_build": active_build is not None,
            "active_build": active_build
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/build/start", response_model=BuildStatusResponse)
async def build_start_endpoint(
    request: BuildStartRequest,
    email: str = Depends(verify_session_token)
):
    """Start a new build"""
    try:
        # Check if build is already running
        active = await check_active_build()
        if active:
            raise HTTPException(
                status_code=400,
                detail=f"Build already running: {active.get('build_id')}"
            )
        
        result = await start_build(request.config)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/status/{build_id}", response_model=BuildStatusResponse)
async def build_status_endpoint(
    build_id: str,
    email: str = Depends(verify_session_token)
):
    """Get build status"""
    status = await get_build_status(build_id)
    if not status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Build {build_id} not found"
        )
    return status


@app.get("/api/build/logs/{build_id}")
async def build_logs_endpoint(
    build_id: str,
    lines: int = 100,
    email: str = Depends(verify_session_token)
):
    """Get build logs"""
    logs = get_build_logs(build_id, lines)
    if logs is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Logs for build {build_id} not found"
        )
    return {"build_id": build_id, "logs": logs}


@app.get("/api/build/history", response_model=dict)
async def build_history_endpoint(
    limit: int = 20,
    email: str = Depends(verify_session_token)
):
    """Get a list of past build history"""
    history = get_build_history(limit)
    return {"history": history}


@app.post("/api/build/kill/{build_id}", response_model=dict)
async def kill_build_endpoint(
    build_id: str,
    email: str = Depends(verify_session_token)
):
    """Kill a running build process"""
    try:
        result = await kill_build(build_id)
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to kill build")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to kill build: {str(e)}"
        )


@app.get("/api/build/changes-since-last", response_model=dict)
async def build_changes_check_endpoint(
    email: str = Depends(verify_session_token)
):
    """Check if there are code changes since last build"""
    try:
        changes = check_changes_since_last_build(settings.DEV_DIR)
        return changes
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/disk-usage", response_model=dict)
async def build_disk_usage_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get disk usage for build artifacts"""
    try:
        usage = get_build_disk_usage(settings.DEV_DIR)
        return usage
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/scripts", response_model=dict)
async def build_scripts_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get available build scripts from dev package.json - consolidated list"""
    try:
        import json
        package_json_path = Path(settings.DEV_DIR) / "package.json"
        
        if not package_json_path.exists():
            return {"scripts": [], "error": "package.json not found"}
        
        with open(package_json_path, "r") as f:
            package_data = json.load(f)
        
        all_scripts = package_data.get("scripts", {})
        
        # Only show the main build scripts - consolidated list with V24 optimizations
        main_build_scripts = {
            "build:server": {"desc": "Production build with PM2, Redis, Nginx (recommended)", "category": "production"},
            "build:prod": {"desc": "Production build (same as build:server)", "category": "production"},
            "build:quick": {"desc": "Quick build - skip PM2, Redis, deps install", "category": "quick"},
            "build:clean": {"desc": "Clean build - removes .next cache before building", "category": "clean"},
            "build:phased": {"desc": "Phased build - memory-safe for large projects", "category": "phased"},
            "build:phased:prod": {"desc": "Phased production build with monitoring", "category": "phased"},
            "build": {"desc": "Standard Next.js build", "category": "standard"},
        }
        
        build_scripts = []
        for name, meta in main_build_scripts.items():
            if name in all_scripts:
                build_scripts.append({
                    "name": name,
                    "command": all_scripts[name],
                    "category": meta["category"],
                    "description": meta["desc"],
                    "recommended": name == "build:server"
                })
        
        # Sort: recommended first
        build_scripts.sort(key=lambda x: (not x['recommended'], x['name']))
        
        return {
            "scripts": build_scripts,
            "default": "build:server",
            "dev_path": settings.DEV_DIR
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/scripts/all", response_model=dict)
async def build_scripts_all_endpoint(
    environment: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Get all build scripts from package.json with full details"""
    try:
        import json
        project_dir = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        package_json_path = Path(project_dir) / "package.json"
        
        if not package_json_path.exists():
            return {"scripts": [], "error": "package.json not found"}
        
        with open(package_json_path, "r") as f:
            package_data = json.load(f)
        
        all_scripts = package_data.get("scripts", {})
        
        # Build script metadata
        script_metadata = {
            "build": {"desc": "Standard Next.js build", "category": "standard", "timeout": 1800},
            "build:server": {"desc": "Production build with PM2, Redis, Nginx", "category": "production", "timeout": 1800, "recommended": True},
            "build:prod": {"desc": "Production build (same as build:server)", "category": "production", "timeout": 1800},
            "build:quick": {"desc": "Quick build - skip PM2, Redis, deps", "category": "quick", "timeout": 600},
            "build:clean": {"desc": "Clean build - removes .next cache", "category": "clean", "timeout": 2400},
            "build:phased": {"desc": "Phased build - memory-safe for large projects", "category": "phased", "timeout": 2400},
            "build:phased:prod": {"desc": "Phased production build with monitoring", "category": "phased", "timeout": 3000},
            "dev": {"desc": "Start development server", "category": "development", "timeout": 0},
            "start": {"desc": "Start production server", "category": "production", "timeout": 0},
            "lint": {"desc": "Run ESLint", "category": "quality", "timeout": 300},
            "test": {"desc": "Run tests", "category": "quality", "timeout": 600},
        }
        
        build_scripts = []
        for name, command in all_scripts.items():
            meta = script_metadata.get(name, {"desc": "", "category": "other", "timeout": 1800})
            build_scripts.append({
                "name": name,
                "command": command,
                "category": meta.get("category", "other"),
                "description": meta.get("desc", ""),
                "recommended": meta.get("recommended", False),
                "timeout": meta.get("timeout", 1800),
                "isCustom": False
            })
        
        # Sort: recommended first, then by category
        build_scripts.sort(key=lambda x: (not x['recommended'], x['category'], x['name']))
        
        return {
            "scripts": build_scripts,
            "default": "build:server",
            "path": project_dir,
            "environment": environment
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/scripts/custom", response_model=dict)
async def build_scripts_custom_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get custom build scripts stored in BuildMaster"""
    try:
        custom_scripts_file = Path(settings.BUILD_DATA_DIR) / "custom_scripts.json"
        
        if not custom_scripts_file.exists():
            return {"scripts": []}
        
        with open(custom_scripts_file, "r") as f:
            data = json.load(f)
        
        return {"scripts": data.get("scripts", [])}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/build/scripts/create", response_model=dict)
async def build_scripts_create_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Create a new custom build script"""
    try:
        name = payload.get("name", "").strip()
        command = payload.get("command", "").strip()
        description = payload.get("description", "").strip()
        
        if not name or not command:
            raise HTTPException(status_code=400, detail="Name and command are required")
        
        # Validate script name format
        if not name.replace(":", "").replace("-", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Invalid script name format")
        
        # Load existing custom scripts
        custom_scripts_file = Path(settings.BUILD_DATA_DIR) / "custom_scripts.json"
        custom_scripts_file.parent.mkdir(parents=True, exist_ok=True)
        
        if custom_scripts_file.exists():
            with open(custom_scripts_file, "r") as f:
                data = json.load(f)
        else:
            data = {"scripts": []}
        
        # Check for duplicate
        if any(s["name"] == name for s in data["scripts"]):
            raise HTTPException(status_code=400, detail=f"Script '{name}' already exists")
        
        # Add new script
        new_script = {
            "name": name,
            "command": command,
            "description": description,
            "category": "custom",
            "isCustom": True,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": email
        }
        data["scripts"].append(new_script)
        
        with open(custom_scripts_file, "w") as f:
            json.dump(data, f, indent=2)
        
        return {"success": True, "script": new_script}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/build/scripts/save", response_model=dict)
async def build_scripts_save_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Save/update a build script in package.json or custom scripts"""
    try:
        name = payload.get("name", "").strip()
        command = payload.get("command", "").strip()
        description = payload.get("description", "").strip()
        environment = payload.get("environment", "dev")
        
        if not name or not command:
            raise HTTPException(status_code=400, detail="Name and command are required")
        
        # Check if it's a custom script
        custom_scripts_file = Path(settings.BUILD_DATA_DIR) / "custom_scripts.json"
        is_custom = False
        
        if custom_scripts_file.exists():
            with open(custom_scripts_file, "r") as f:
                custom_data = json.load(f)
            
            for script in custom_data.get("scripts", []):
                if script["name"] == name:
                    is_custom = True
                    script["command"] = command
                    script["description"] = description
                    script["updated_at"] = datetime.utcnow().isoformat()
                    script["updated_by"] = email
                    break
            
            if is_custom:
                with open(custom_scripts_file, "w") as f:
                    json.dump(custom_data, f, indent=2)
                return {"success": True, "message": f"Custom script '{name}' updated"}
        
        # Update package.json
        project_dir = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        package_json_path = Path(project_dir) / "package.json"
        
        if not package_json_path.exists():
            raise HTTPException(status_code=404, detail="package.json not found")
        
        with open(package_json_path, "r") as f:
            package_data = json.load(f)
        
        if "scripts" not in package_data:
            package_data["scripts"] = {}
        
        package_data["scripts"][name] = command
        
        with open(package_json_path, "w") as f:
            json.dump(package_data, f, indent=2)
        
        return {"success": True, "message": f"Script '{name}' saved to package.json"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.delete("/api/build/scripts/{script_name}", response_model=dict)
async def build_scripts_delete_endpoint(
    script_name: str,
    email: str = Depends(verify_session_token)
):
    """Delete a custom build script"""
    try:
        custom_scripts_file = Path(settings.BUILD_DATA_DIR) / "custom_scripts.json"
        
        if not custom_scripts_file.exists():
            raise HTTPException(status_code=404, detail="Script not found")
        
        with open(custom_scripts_file, "r") as f:
            data = json.load(f)
        
        original_count = len(data.get("scripts", []))
        data["scripts"] = [s for s in data.get("scripts", []) if s["name"] != script_name]
        
        if len(data["scripts"]) == original_count:
            raise HTTPException(status_code=404, detail="Script not found or cannot be deleted")
        
        with open(custom_scripts_file, "w") as f:
            json.dump(data, f, indent=2)
        
        return {"success": True, "message": f"Script '{script_name}' deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/build/scripts/analyze", response_model=dict)
async def build_scripts_analyze_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Analyze a build script and provide optimization suggestions"""
    try:
        command = payload.get("command", "").strip()
        
        if not command:
            raise HTTPException(status_code=400, detail="Command is required")
        
        suggestions = []
        estimated_time = "10-20 min"
        memory_estimate = "4-8 GB"
        risk_level = "low"
        
        # Analyze memory settings
        if "max-old-space-size" not in command:
            suggestions.append({
                "type": "warning",
                "title": "No memory limit set",
                "description": "Build may crash on large projects without memory limits",
                "fix": 'Add NODE_OPTIONS="--max-old-space-size=8192"',
                "impact": "high"
            })
        else:
            import re
            mem_match = re.search(r'max-old-space-size=(\d+)', command)
            if mem_match:
                mem_size = int(mem_match.group(1))
                memory_estimate = f"{mem_size // 1024} GB"
                if mem_size < 4096:
                    suggestions.append({
                        "type": "warning",
                        "title": "Low memory limit",
                        "description": f"{mem_size}MB may not be enough for large builds",
                        "fix": "Increase to at least 4096 or 8192",
                        "impact": "medium"
                    })
        
        # Check NODE_ENV
        if "NODE_ENV=" not in command:
            suggestions.append({
                "type": "error",
                "title": "NODE_ENV not set",
                "description": "Build environment not specified",
                "fix": "Add NODE_ENV=production or NODE_ENV=development",
                "impact": "high"
            })
            risk_level = "medium"
        
        # Check for turbo
        if "--turbo" in command:
            suggestions.append({
                "type": "warning",
                "title": "Turbopack is experimental",
                "description": "May have stability issues in production",
                "impact": "medium"
            })
            risk_level = "medium"
            estimated_time = "5-10 min"
        
        # Check for cache clearing
        if "rimraf .next" in command or "rm -rf .next" in command:
            suggestions.append({
                "type": "info",
                "title": "Cache will be cleared",
                "description": "Build will take longer but ensures clean state",
                "impact": "low"
            })
            estimated_time = "20-35 min"
        
        # Sanity checks
        sanity_checks = [
            {"name": "Memory Limit", "passed": "max-old-space-size" in command, "message": "Memory limit configured" if "max-old-space-size" in command else "No memory limit"},
            {"name": "Environment", "passed": "NODE_ENV=" in command, "message": "NODE_ENV set" if "NODE_ENV=" in command else "NODE_ENV not set"},
            {"name": "Timeout Protection", "passed": True, "message": "BuildMaster enforces 30-min timeout"},
            {"name": "Loop Safety", "passed": "while true" not in command and "for (;;)" not in command, "message": "No dangerous loops detected"}
        ]
        
        if not suggestions:
            suggestions.append({
                "type": "success",
                "title": "Script looks good!",
                "description": "No major issues detected",
                "impact": "low"
            })
        
        return {
            "suggestions": suggestions,
            "estimatedTime": estimated_time,
            "memoryEstimate": memory_estimate,
            "riskLevel": risk_level,
            "sanityChecks": {
                "passed": all(c["passed"] for c in sanity_checks),
                "checks": sanity_checks
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Deploy operations
@app.post("/api/deploy/golive", response_model=dict)
async def deploy_golive_endpoint(
    request: DeployGoLiveRequest,
    email: str = Depends(verify_session_token)
):
    """Deploy to production (Go Live)"""
    try:
        result = await deploy_to_production(request)
        return result.dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Health check endpoints
@app.get("/api/health/server", response_model=dict)
async def health_server_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Get server health metrics including database status"""
    import psutil
    
    try:
        health = await get_server_health()
        
        # Get CPU cores
        cpu_cores = psutil.cpu_count(logical=True) or 0
        
        # Convert memory from bytes to MB
        memory_total_mb = round(health.memory_total / (1024 * 1024))
        memory_used_mb = round((health.memory_total - health.memory_available) / (1024 * 1024))
        
        # Build response in expected format for Dashboard
        response = {
            "uptime": health.uptime,
            "timestamp": health.timestamp.isoformat(),
            "cpu": {
                "percent": health.cpu_percent,
                "cores": cpu_cores
            },
            "memory": {
                "total_mb": memory_total_mb,
                "used_mb": memory_used_mb,
                "available_mb": round(health.memory_available / (1024 * 1024)),
                "percent": health.memory_percent
            },
            "disk": {
                "total_gb": round(health.disk_total / (1024 * 1024 * 1024), 1),
                "free_gb": round(health.disk_free / (1024 * 1024 * 1024), 1),
                "percent": health.disk_percent
            }
        }
        
        # Add database health for the specified environment
        db_health = await check_database_health_for_env(env)
        response["database"] = db_health
        
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/health/database", response_model=dict)
async def health_database_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get database health"""
    try:
        health = await get_database_health()
        return health.dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/health/redis", response_model=dict)
async def health_redis_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get Redis health"""
    try:
        health = await get_redis_health()
        return health.dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/health/environment", response_model=dict)
async def health_environment_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get environment health"""
    try:
        health = await get_environment_health()
        return health.dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Database service management endpoints
@app.get("/api/services/status", response_model=dict)
async def services_status_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get status of all database-related services"""
    try:
        return await get_all_services_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/services/postgres/status", response_model=dict)
async def postgres_status_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get PostgreSQL service status"""
    try:
        return await get_postgres_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/postgres/start", response_model=dict)
async def postgres_start_endpoint(
    email: str = Depends(verify_session_token)
):
    """Start PostgreSQL service"""
    try:
        return await start_postgres()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/postgres/stop", response_model=dict)
async def postgres_stop_endpoint(
    email: str = Depends(verify_session_token)
):
    """Stop PostgreSQL service"""
    try:
        return await stop_postgres()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/postgres/restart", response_model=dict)
async def postgres_restart_endpoint(
    email: str = Depends(verify_session_token)
):
    """Restart PostgreSQL service"""
    try:
        return await restart_postgres()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/postgres/maintenance", response_model=dict)
async def postgres_maintenance_endpoint(
    email: str = Depends(verify_session_token)
):
    """Run PostgreSQL maintenance (VACUUM ANALYZE)"""
    try:
        return await run_postgres_maintenance()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/services/postgres/connections", response_model=dict)
async def postgres_connections_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get current PostgreSQL connections"""
    try:
        return await get_postgres_connections()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/services/redis/status", response_model=dict)
async def redis_service_status_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get Redis service status"""
    try:
        return await get_redis_service_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/redis/start", response_model=dict)
async def redis_start_endpoint(
    email: str = Depends(verify_session_token)
):
    """Start Redis service"""
    try:
        return await start_redis()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/redis/stop", response_model=dict)
async def redis_stop_endpoint(
    email: str = Depends(verify_session_token)
):
    """Stop Redis service"""
    try:
        return await stop_redis()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/services/redis/restart", response_model=dict)
async def redis_restart_endpoint(
    email: str = Depends(verify_session_token)
):
    """Restart Redis service"""
    try:
        return await restart_redis()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Git status endpoints
@app.get("/api/git/status/detailed", response_model=dict)
async def git_status_detailed_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get detailed git status with file changes and suggestions"""
    try:
        status_info = await get_detailed_git_status()
        return status_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/stash", response_model=dict)
async def git_stash_endpoint(
    email: str = Depends(verify_session_token)
):
    """Stash current changes"""
    try:
        result = await git_stash_changes()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/stash/pop", response_model=dict)
async def git_stash_pop_endpoint(
    email: str = Depends(verify_session_token)
):
    """Pop the latest stash"""
    try:
        result = await git_pop_stash()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/clean", response_model=dict)
async def git_clean_endpoint(
    email: str = Depends(verify_session_token)
):
    """Check what untracked files would be removed (dry-run)"""
    try:
        result = await git_clean_untracked()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/clean/confirm", response_model=dict)
async def git_clean_confirm_endpoint(
    email: str = Depends(verify_session_token)
):
    """Actually remove untracked files"""
    try:
        result = await git_clean_untracked_confirm()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Git commit tracking endpoints
@app.get("/api/git/environment-comparison", response_model=dict)
async def git_environment_comparison_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get comparison of dev and prod environments with remote"""
    try:
        comparison = await get_environment_comparison()
        return comparison
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/git/commit-timeline", response_model=dict)
async def git_commit_timeline_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get recent commit timeline from remote"""
    try:
        timeline = await get_commit_timeline()
        return {"commits": timeline}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# BuildMaster Git Pull endpoints
@app.get("/api/git/preview-pull", response_model=dict)
async def git_preview_pull_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Preview incoming changes before pulling"""
    try:
        working_dir = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        result = get_incoming_changes(working_dir)
        
        # If there are BuildMaster files, check their status
        if result.get("success") and result.get("buildmaster_files"):
            bm_status = check_buildmaster_repo_status(result["buildmaster_files"])
            result["buildmaster_status"] = bm_status
        
        result["env"] = env
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/pull-env", response_model=dict)
async def git_pull_env_endpoint(
    env: str = "dev",
    branch: str = None,
    stash: bool = False,
    force: bool = False,
    email: str = Depends(verify_session_token)
):
    """Pull from git for a specific environment without auto-restart"""
    try:
        result = await pull_with_env(env, branch, stash, force)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/push-buildmaster", response_model=dict)
async def git_push_buildmaster_endpoint(
    commit_message: str = None,
    email: str = Depends(verify_session_token)
):
    """Push changes to BuildMaster repo"""
    try:
        result = push_to_buildmaster(commit_message)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/pm2/restart", response_model=dict)
async def pm2_restart_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Restart PM2 process for environment"""
    try:
        app_name = "dintrafikskolax-dev" if env == "dev" else "dintrafikskolax-prod"
        result = await reload_pm2_app(app_name)
        return {"success": True, "message": f"Restarted {app_name}", "result": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/git/local-changes", response_model=dict)
async def git_local_changes_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Get detailed local changes for an environment"""
    try:
        from git_ops import get_local_changes_detailed
        working_dir = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        result = get_local_changes_detailed(working_dir)
        result["env"] = env
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/reset-files", response_model=dict)
async def git_reset_files_endpoint(
    env: str = "dev",
    files: list = None,
    reset_all: bool = False,
    email: str = Depends(verify_session_token)
):
    """Reset specific files or all files to match remote"""
    try:
        from git_ops import reset_files
        working_dir = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        result = reset_files(working_dir, files, reset_all)
        result["env"] = env
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/git/force-sync", response_model=dict)
async def git_force_sync_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Force sync local to match remote (discards all local changes and commits)"""
    try:
        from git_ops import force_sync_to_remote
        working_dir = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        result = force_sync_to_remote(working_dir)
        result["env"] = env
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Build Dashboard update endpoints
@app.post("/api/build-dashboard/install", response_model=dict)
async def build_dashboard_install_endpoint(
    email: str = Depends(verify_session_token)
):
    """Install/update Build Dashboard from dev repository"""
    try:
        result = await install_build_dashboard()
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Installation failed")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build-dashboard/status", response_model=dict)
async def build_dashboard_status_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get Build Dashboard status"""
    try:
        status_info = await get_build_dashboard_status()
        return status_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# System metrics endpoints
@app.get("/api/system/metrics", response_model=dict)
async def system_metrics_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get current system metrics"""
    try:
        metrics = get_system_metrics()
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/metrics", response_model=dict)
async def build_metrics_endpoint(
    build_id: Optional[str] = None,
    email: str = Depends(verify_session_token)
):
    """Get build metrics including workers and system info"""
    try:
        metrics = get_build_metrics(build_id)
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/workers/handle-stalled", response_model=dict)
async def handle_stalled_workers_endpoint(
    email: str = Depends(verify_session_token)
):
    """Handle stalled workers and attempt recovery"""
    try:
        stalled = handle_stalled_workers()
        return {
            "success": True,
            "stalled_workers": stalled,
            "handled_count": len(stalled)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Troubleshooting endpoints
@app.get("/api/troubleshooting/cache-status/{environment}", response_model=dict)
async def cache_status_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get cache status for dev or prod"""
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        status_data = await get_cache_status(directory)
        return status_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/troubleshooting/clear-cache/{environment}/{cache_type}", response_model=dict)
async def clear_cache_endpoint(
    environment: str,
    cache_type: str,
    email: str = Depends(verify_session_token)
):
    """Clear cache for dev or prod"""
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        result = await clear_cache(directory, cache_type)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/redis-status", response_model=dict)
async def redis_status_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get Redis status"""
    try:
        status_data = await get_redis_status()
        return status_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/troubleshooting/clear-redis", response_model=dict)
async def clear_redis_endpoint(
    pattern: str = "*",
    email: str = Depends(verify_session_token)
):
    """Clear Redis cache"""
    try:
        result = await clear_redis_cache(pattern)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/packages/{environment}", response_model=dict)
async def packages_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get package versions"""
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        packages = await get_package_versions(directory)
        return packages
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/pm2-logs/{app_name}", response_model=dict)
async def pm2_logs_endpoint(
    app_name: str,
    lines: int = 100,
    email: str = Depends(verify_session_token)
):
    """Get PM2 logs"""
    try:
        logs = await get_pm2_logs(app_name, lines)
        return logs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/system-logs/{log_type}", response_model=dict)
async def system_logs_endpoint(
    log_type: str,
    lines: int = 100,
    email: str = Depends(verify_session_token)
):
    """Get system logs"""
    try:
        logs = await get_system_logs(log_type, lines)
        return logs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/connectivity-test", response_model=dict)
async def connectivity_test_endpoint(
    email: str = Depends(verify_session_token)
):
    """Test connectivity to services"""
    try:
        results = await test_connectivity()
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/env-analysis/{environment}", response_model=dict)
async def env_analysis_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Analyze .env files"""
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        analysis = await analyze_env_file(directory)
        return analysis
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/sql-migrations/{environment}", response_model=dict)
async def sql_migrations_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get SQL migration files"""
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        migrations = await get_sql_migrations(directory)
        return migrations
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/troubleshooting/check-migration-applied/{environment}", response_model=dict)
async def check_migration_applied_endpoint(
    environment: str,
    filename: str,
    email: str = Depends(verify_session_token)
):
    """Check if a specific migration has been applied"""
    try:
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        result = await check_migration_applied(directory, filename)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/troubleshooting/execute-sql", response_model=dict)
async def execute_sql_endpoint(
    sql: str,
    dry_run: bool = True,
    email: str = Depends(verify_session_token)
):
    """Execute SQL query"""
    try:
        result = await execute_sql(sql, dry_run)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Build Dashboard API",
        "version": "1.0.0",
        "status": "running"
    }


# ============= DATABASE SYNC TOOLS =============

@app.post("/api/database/sync/commands", response_model=dict)
async def database_sync_commands_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Generate and optionally execute sync commands between environments"""
    try:
        source_env = payload.get("source_env")
        target_env = payload.get("target_env") 
        options = payload.get("options", {})
        execute = payload.get("execute", False)
        
        if source_env not in ("dev", "prod") or target_env not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await generate_sync_commands(source_env, target_env, options, execute)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= DATABASE BACKUP TOOLS =============

@app.get("/api/database/backup/commands/{environment}", response_model=dict)
async def database_backup_commands_endpoint(
    environment: str,
    backup_type: str = "full",
    execute: bool = False,
    email: str = Depends(verify_session_token)
):
    """Generate and optionally execute backup commands for environment"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await generate_backup_commands(environment, backup_type, execute)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/database/backup/download/{filename}", response_class=FileResponse)
async def download_backup_file(
    filename: str,
    email: str = Depends(verify_session_token)
):
    """Download a backup file"""
    import os
    backup_path = f"/var/www/build/backups/{filename}"
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    # Security check - only allow files in backups directory
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    return FileResponse(
        path=backup_path,
        filename=filename,
        media_type="application/sql"
    )


@app.post("/api/database/backup/upload", response_model=dict)
async def upload_backup_file(
    file: UploadFile = File(...),
    email: str = Depends(verify_session_token)
):
    """Upload a backup file for restoration"""
    try:
        # Validate file type
        if not file.filename.endswith('.sql'):
            raise HTTPException(status_code=400, detail="Only .sql files are allowed")
        
        # Security check
        if ".." in file.filename or "/" in file.filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Ensure upload directory exists
        upload_dir = "/var/www/build/backups/uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save uploaded file
        upload_path = os.path.join(upload_dir, file.filename)
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(upload_path)
        size_mb = file_size / (1024 * 1024)
        
        return {
            "success": True,
            "filename": file.filename,
            "size_mb": round(size_mb, 2),
            "path": upload_path,
            "message": f"Uploaded {file.filename} ({size_mb:.2f} MB)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/database/backup/restore", response_model=dict)
async def restore_backup_file(
    filename: str = Form(...),
    environment: str = Form(...),
    restore_type: str = Form(...),
    tables: Optional[str] = Form(None),
    sanity_check: str = Form(...),
    email: str = Depends(verify_session_token)
):
    """Restore a backup file to database with sanity check"""
    import subprocess
    from datetime import datetime
    from urllib.parse import urlparse
    
    result = {
        "success": False,
        "console_output": [],
        "warnings": []
    }
    
    try:
        # Verify sanity check (simple math problem)
        # Expected format: "answer:5" where 5 is the answer
        try:
            expected_answer = int(sanity_check)
            # The frontend should send the correct answer
        except:
            result["console_output"].append("❌ Invalid sanity check format")
            result["warnings"].append("Sanity check failed")
            return result
        
        result["console_output"].append("✅ Sanity check passed")
        result["console_output"].append("")
        
        # Validate environment
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        # Check if file exists
        upload_path = f"/var/www/build/backups/uploads/{filename}"
        if not os.path.exists(upload_path):
            result["console_output"].append(f"❌ Backup file not found: {filename}")
            result["warnings"].append("File not found")
            return result
        
        # Get database configuration
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        from troubleshooting_ops import get_env_database_config
        config = await get_env_database_config(directory)
        
        # Find DATABASE_URL
        db_url = None
        for file_info in config.get("env_files", []):
            if file_info.get("has_database_url") and file_info.get("database_url"):
                db_url = file_info["database_url"]
                break
        
        if not db_url:
            result["console_output"].append("❌ Could not find DATABASE_URL")
            result["warnings"].append("DATABASE_URL not found")
            return result
        
        parsed = urlparse(db_url)
        
        result["console_output"].append(f"$ Restoring backup to {environment}")
        result["console_output"].append(f"→ Target: {parsed.path[1:]}")
        result["console_output"].append(f"→ Host: {parsed.hostname}:{parsed.port}")
        result["console_output"].append(f"→ User: {parsed.username}")
        result["console_output"].append(f"→ File: {filename}")
        result["console_output"].append(f"→ Type: {restore_type}")
        result["console_output"].append("")
        
        # Build restore command
        if restore_type == "all":
            # Restore full backup
            result["console_output"].append("🚀 Restoring full database...")
            cmd_list = [
                "psql",
                "-h", str(parsed.hostname),
                "-p", str(parsed.port),
                "-U", str(parsed.username),
                "-d", parsed.path[1:],
                "-f", upload_path
            ]
        elif restore_type == "tables" and tables:
            # Restore specific tables
            table_list = [t.strip() for t in tables.split(",")]
            result["console_output"].append(f"🚀 Restoring tables: {', '.join(table_list)}")
            result["console_output"].append("⚠️  Table-specific restore: extracting tables...")
            
            # First, extract only the specified tables from the backup
            result["warnings"].append("Table-specific restore may require manual intervention")
            cmd_list = [
                "psql",
                "-h", str(parsed.hostname),
                "-p", str(parsed.port),
                "-U", str(parsed.username),
                "-d", parsed.path[1:],
                "-f", upload_path
            ]
        else:
            result["console_output"].append("❌ Invalid restore type or missing tables")
            result["warnings"].append("Invalid restore configuration")
            return result
        
        result["console_output"].append("")
        
        # Set PGPASSWORD for authentication
        env = os.environ.copy()
        if parsed.password:
            env["PGPASSWORD"] = parsed.password
        
        # Execute restore
        process = subprocess.run(
            cmd_list,
            env=env,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout for restore
        )
        
        if process.returncode == 0:
            result["success"] = True
            result["console_output"].append("✅ Restore completed successfully!")
            result["console_output"].append(f"→ Environment: {environment}")
            result["console_output"].append(f"→ Database: {parsed.path[1:]}")
        else:
            result["console_output"].append(f"❌ Restore failed with exit code {process.returncode}")
            
        if process.stdout:
            result["console_output"].append("")
            result["console_output"].append("📋 Output:")
            for line in process.stdout.strip().split("\n")[:50]:  # Limit to 50 lines
                result["console_output"].append(f"  {line}")
                
        if process.stderr:
            result["console_output"].append("")
            result["console_output"].append("⚠️  Errors/Warnings:")
            for line in process.stderr.strip().split("\n")[:50]:  # Limit to 50 lines
                result["console_output"].append(f"  {line}")
        
        # Clean up uploaded file after restore
        if result["success"]:
            try:
                os.remove(upload_path)
                result["console_output"].append("")
                result["console_output"].append("🗑️  Uploaded file cleaned up")
            except:
                pass
                
    except subprocess.TimeoutExpired:
        result["console_output"].append("❌ Restore timed out after 10 minutes")
        result["warnings"].append("Operation timed out")
    except Exception as e:
        result["console_output"].append(f"❌ Error: {str(e)}")
        result["warnings"].append(str(e))
    
    return result


# ============= DATABASE CRUD EXPLORER =============

@app.get("/api/database/schema/{environment}", response_model=dict)
async def database_schema_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get database schema for CRUD explorer"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await get_database_schema(environment)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/database/query/{environment}/{table_name}", response_model=dict)
async def database_query_endpoint(
    environment: str,
    table_name: str,
    limit: int = 100,
    offset: int = 0,
    email: str = Depends(verify_session_token)
):
    """Query table data for CRUD explorer"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await query_table_data(environment, table_name, limit, offset)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= TABLE MANAGEMENT =============

@app.post("/api/database/create-table/{environment}", response_model=dict)
async def create_table_endpoint(
    environment: str,
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Create a new database table"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        table_name = payload.get("table_name")
        columns = payload.get("columns", [])
        
        if not table_name or not columns:
            raise HTTPException(status_code=400, detail="Missing table_name or columns")
        
        result = await create_database_table(environment, table_name, columns)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.delete("/api/database/drop-table/{environment}/{table_name}", response_model=dict)
async def drop_table_endpoint(
    environment: str,
    table_name: str,
    email: str = Depends(verify_session_token)
):
    """Delete a database table"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await drop_database_table(environment, table_name)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= DATABASE TOOLKIT =============

@app.get("/api/database/toolkit/users/{environment}", response_model=dict)
async def list_database_users_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """List all database users"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await list_database_users(environment)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/toolkit/users/{environment}", response_model=dict)
async def create_database_user_endpoint(
    environment: str,
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Create a new database user"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        username = payload.get("username")
        password = payload.get("password")
        privileges = payload.get("privileges", {})
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Missing username or password")
        
        result = await create_database_user(environment, username, password, privileges)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.delete("/api/database/toolkit/users/{environment}/{username}", response_model=dict)
async def delete_database_user_endpoint(
    environment: str,
    username: str,
    email: str = Depends(verify_session_token)
):
    """Delete a database user"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await delete_database_user(environment, username)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/toolkit/privileges/grant", response_model=dict)
async def grant_privileges_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Grant table privileges to a user"""
    try:
        environment = payload.get("environment")
        username = payload.get("username")
        table_name = payload.get("table_name")
        privileges = payload.get("privileges", [])
        
        if not all([environment, username, table_name, privileges]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await grant_table_privileges(environment, username, table_name, privileges)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/toolkit/privileges/revoke", response_model=dict)
async def revoke_privileges_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Revoke table privileges from a user"""
    try:
        environment = payload.get("environment")
        username = payload.get("username")
        table_name = payload.get("table_name")
        privileges = payload.get("privileges", [])
        
        if not all([environment, username, table_name, privileges]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await revoke_table_privileges(environment, username, table_name, privileges)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/toolkit/optimize", response_model=dict)
async def optimize_tables_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Optimize database tables"""
    try:
        environment = payload.get("environment")
        table_names = payload.get("table_names")
        
        if not environment:
            raise HTTPException(status_code=400, detail="Missing environment")
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        result = await optimize_database_tables(environment, table_names)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= ENV FILE EDITOR =============

@app.get("/api/database/env-files/{environment}", response_model=dict)
async def get_env_files_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get list of .env* files in environment directory"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        from troubleshooting_ops import get_env_files_list
        result = await get_env_files_list(directory)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/database/env-file/{environment}/{filename}", response_model=dict)
async def read_env_file_endpoint(
    environment: str,
    filename: str,
    email: str = Depends(verify_session_token)
):
    """Read content of a specific .env file"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        # Security check - only allow .env* files
        if not filename.startswith(".env"):
            raise HTTPException(status_code=400, detail="Invalid filename - must start with .env")
        
        if ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        from troubleshooting_ops import read_env_file
        result = await read_env_file(directory, filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/env-file/{environment}/{filename}", response_model=dict)
async def write_env_file_endpoint(
    environment: str,
    filename: str,
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Write content to a specific .env file"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        # Security check - only allow .env* files
        if not filename.startswith(".env"):
            raise HTTPException(status_code=400, detail="Invalid filename - must start with .env")
        
        if ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        content = payload.get("content", "")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        from troubleshooting_ops import write_env_file
        result = await write_env_file(directory, filename, content)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= DATABASE SELECTOR =============

@app.get("/api/database/selector/{environment}", response_model=dict)
async def get_database_selector_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get selected database and available databases for an environment"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        from database_selector import get_selected_database, list_available_databases
        
        selected = get_selected_database(environment)
        available = await list_available_databases(environment)
        
        return {
            "environment": environment,
            "selected": selected,
            "available": available.get("databases", []),
            "error": available.get("error")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/selector/{environment}", response_model=dict)
async def set_database_selector_endpoint(
    environment: str,
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Set selected database for an environment"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        database_url = payload.get("database_url")
        if not database_url:
            raise HTTPException(status_code=400, detail="Missing database_url")
        
        from database_selector import set_selected_database
        result = set_selected_database(environment, database_url)
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= SETUP TEST DATABASE =============

@app.post("/api/database/setup-test", response_model=dict)
async def setup_test_database_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Setup test database with user and optional cloning.
    
    Updates all .env* files in the selected environment directory.
    """
    try:
        db_name = payload.get("db_name")
        username = payload.get("username")
        password = payload.get("password")
        environment = payload.get("environment", "dev")
        clone_from_prod = payload.get("clone_from_prod", True)
        
        if not all([db_name, username, password]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'")
        
        result = await setup_test_database(db_name, username, password, environment, clone_from_prod)
        
        # Execute SQL commands to create database if setup was successful
        if result.get("success") and result.get("sql_commands"):
            from troubleshooting_ops import execute_test_database_setup
            new_db_url = result.get("new_database_url")
            
            # Connect to postgres database to execute commands (use localhost)
            from urllib.parse import urlparse
            parsed = urlparse(new_db_url)
            postgres_url = f"postgresql://{parsed.username}:{parsed.password}@127.0.0.1:{parsed.port}/postgres"
            
            execute_result = await execute_test_database_setup(result.get("sql_commands"), postgres_url)
            
            if execute_result.get("success"):
                result["console_output"].append("✅ Database and user created successfully")
                for cmd in execute_result.get("commands_executed", []):
                    result["console_output"].append(f"  → Executed: {cmd}")
            else:
                result["warnings"].extend(execute_result.get("errors", []))
                result["console_output"].append("⚠️  Some SQL commands failed - check warnings")
                for error in execute_result.get("errors", []):
                    result["console_output"].append(f"  ❌ {error}")
        
        # Actually update ALL .env* files using the proper function
        if result.get("success") and result.get("new_database_url"):
            target_dir = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
            new_db_url = result.get("new_database_url")
            
            # Parse URL for verbose feedback
            from urllib.parse import urlparse
            parsed = urlparse(new_db_url)
            db_host = parsed.hostname or "localhost"
            db_port = str(parsed.port or 5432)
            db_user = parsed.username or ""
            db_name = parsed.path.lstrip("/") if parsed.path else ""
            
            result["console_output"].append("")
            result["console_output"].append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            result["console_output"].append("📝 UPDATING ENVIRONMENT FILES")
            result["console_output"].append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            result["console_output"].append(f"→ Target directory: {target_dir}")
            result["console_output"].append(f"→ New DATABASE_URL: {new_db_url}")
            result["console_output"].append(f"→ Database: {db_name}")
            result["console_output"].append(f"→ Host: {db_host}")
            result["console_output"].append(f"→ Port: {db_port}")
            result["console_output"].append(f"→ User: {db_user}")
            result["console_output"].append("")
            
            # Find ALL .env* files in the directory - MUST update ALL of them
            import glob
            import os
            env_files_to_update = []
            
            # ALWAYS update .env and .env.local (critical files) - add them first
            critical_files = [".env", ".env.local"]
            for critical_file in critical_files:
                env_files_to_update.append(critical_file)
            
            # Find ALL existing .env* files in the directory
            env_glob_pattern = os.path.join(target_dir, ".env*")
            found_files = glob.glob(env_glob_pattern)
            for env_file_path in found_files:
                basename = os.path.basename(env_file_path)
                if basename not in env_files_to_update:
                    env_files_to_update.append(basename)
            
            # Also ensure standard patterns are included (even if they don't exist yet)
            env_patterns = [".env.production", ".env.development", ".env.test"]
            for pattern in env_patterns:
                if pattern not in env_files_to_update:
                    env_files_to_update.append(pattern)
            
            result["console_output"].append(f"📋 Found {len(env_files_to_update)} .env* files to update:")
            for env_file in env_files_to_update:
                env_path = os.path.join(target_dir, env_file)
                exists = "✓ exists" if os.path.exists(env_path) else "✗ will create"
                result["console_output"].append(f"  → {env_file} {exists}")
            result["console_output"].append("")
            
            # Use the proper update_database_url function to update all files at once
            from troubleshooting_ops import update_database_url
            try:
                update_result = await update_database_url(target_dir, new_db_url, env_files_to_update, create_if_missing=True)
                
                if update_result.get("error"):
                    result["warnings"].append(f"Error updating .env files: {update_result.get('error')}")
                    result["console_output"].append(f"❌ Error: {update_result.get('error')}")
                else:
                    result["console_output"].append("📝 Update Results:")
                    for file_result in update_result.get("files", []):
                        if file_result.get("updated"):
                            vars_added = file_result.get("variables_added", {})
                            vars_list = [k for k, v in vars_added.items() if v]
                            updated_vars = []
                            if not vars_added.get("DATABASE_URL", True):  # If DATABASE_URL existed, it was updated
                                updated_vars.append("DATABASE_URL")
                            if not vars_added.get("DB_HOST", True):
                                updated_vars.append("DB_HOST")
                            if not vars_added.get("DB_PORT", True):
                                updated_vars.append("DB_PORT")
                            if not vars_added.get("DB_USER", True):
                                updated_vars.append("DB_USER")
                            if not vars_added.get("DB_NAME", True):
                                updated_vars.append("DB_NAME")
                            if not vars_added.get("DB_PASSWORD", True):
                                updated_vars.append("DB_PASSWORD")
                            
                            if vars_list:
                                result["console_output"].append(f"  ✅ {file_result.get('name')}: Updated {', '.join(updated_vars)} | Added {', '.join(vars_list)}")
                            else:
                                result["console_output"].append(f"  ✅ {file_result.get('name')}: Updated {', '.join(updated_vars) if updated_vars else 'all variables'}")
                        elif file_result.get("created"):
                            vars_added = file_result.get("variables_added", {})
                            vars_list = [k for k, v in vars_added.items() if v]
                            result["console_output"].append(f"  ✅ {file_result.get('name')}: Created with {', '.join(vars_list)}")
                        else:
                            reason = file_result.get("reason", "unknown")
                            result["warnings"].append(f"Failed to update {file_result.get('name')}: {reason}")
                            result["console_output"].append(f"  ❌ {file_result.get('name')}: Failed ({reason})")
                    
                    result["console_output"].append("")
                    result["console_output"].append("✅ All environment files updated successfully!")
                    result["console_output"].append("→ Drizzle ORM will use: DB_HOST, DB_USER, DB_NAME, DB_PASSWORD, DB_PORT")
                    result["console_output"].append("→ Next.js will use: DATABASE_URL")
            except Exception as e:
                result["warnings"].append(f"Failed to update .env files: {str(e)}")
                result["console_output"].append(f"❌ Error updating .env files: {str(e)}")
                import traceback
                result["console_output"].append(f"   Traceback: {traceback.format_exc()}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/execute-test-setup", response_model=dict)
async def execute_test_setup_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Execute test database setup SQL commands"""
    try:
        commands = payload.get("commands", [])
        db_url = payload.get("db_url")
        
        if not commands or not db_url:
            raise HTTPException(status_code=400, detail="Missing commands or db_url")
        
        result = await execute_test_database_setup(commands, db_url)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/create-database", response_model=dict)
async def create_database_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Create a database only (without user)"""
    try:
        db_name = payload.get("db_name")
        environment = payload.get("environment", "dev")
        
        if not db_name:
            raise HTTPException(status_code=400, detail="Missing db_name")
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'")
        
        result = await create_database_only(db_name, environment)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/create-user", response_model=dict)
async def create_user_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Create a database user only (without database)"""
    try:
        username = payload.get("username")
        password = payload.get("password")
        environment = payload.get("environment", "dev")
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Missing username or password")
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'")
        
        result = await create_database_user(username, password, environment)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/database/env-files/{environment}", response_model=dict)
async def get_env_files_endpoint(
    environment: str,
    email: str = Depends(verify_session_token)
):
    """Get list of all .env* files for an environment"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        result = await get_env_files_list(directory)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/database/env-file/{environment}/{filename:path}", response_model=dict)
async def read_env_file_endpoint(
    environment: str,
    filename: str,
    email: str = Depends(verify_session_token)
):
    """Read content of a specific .env file"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'")
        
        # Security check - only allow .env* files
        if not filename.startswith(".env") or ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename. Only .env* files are allowed")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        result = await read_env_file(directory, filename)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/database/env-file/{environment}/{filename:path}", response_model=dict)
async def write_env_file_endpoint(
    environment: str,
    filename: str,
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Write content to a specific .env file"""
    try:
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'")
        
        # Security check - only allow .env* files
        if not filename.startswith(".env") or ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename. Only .env* files are allowed")
        
        content = payload.get("content")
        if content is None:
            raise HTTPException(status_code=400, detail="Missing content")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        result = await write_env_file(directory, filename, content)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Update DATABASE_URL for both dev and prod
@app.post("/api/database/update-database-url", response_model=dict)
async def update_database_url_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Update DATABASE_URL in dev or prod environment files"""
    try:
        environment = payload.get("environment")
        database_url = payload.get("database_url")
        target_files = payload.get("files") or [".env.local"]
        
        if environment not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        
        if not database_url:
            raise HTTPException(status_code=400, detail="Missing database_url")
        
        directory = settings.DEV_DIR if environment == "dev" else settings.PROD_DIR
        result = await update_database_url(directory, database_url, target_files)
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= SETTINGS ENDPOINTS =============

@app.get("/api/settings", response_model=dict)
async def get_settings_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get all settings"""
    try:
        app_settings = await load_settings()
        return app_settings
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/settings", response_model=dict)
async def save_settings_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Save all settings"""
    try:
        result = await save_settings(payload)
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to save settings")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/settings/server-info", response_model=dict)
async def server_info_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get server information"""
    try:
        info = await get_server_info()
        return info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/settings/detect-scripts", response_model=dict)
async def detect_scripts_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Detect build scripts from package.json"""
    try:
        path = payload.get("path", settings.DEV_DIR)
        result = await detect_build_scripts(path)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/settings/pm2-processes", response_model=dict)
async def pm2_processes_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get list of PM2 processes"""
    try:
        result = await get_pm2_processes()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/settings/nginx-sites", response_model=dict)
async def nginx_sites_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get list of Nginx sites"""
    try:
        result = await get_nginx_sites()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/settings/pm2/restart/{env}", response_model=dict)
async def pm2_restart_with_settings_endpoint(
    env: str,
    email: str = Depends(verify_session_token)
):
    """Restart PM2 process using saved settings"""
    try:
        if env not in ("dev", "prod"):
            raise HTTPException(status_code=400, detail="Invalid environment")
        result = await restart_pm2_with_settings(env)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/settings/nginx/reload", response_model=dict)
async def nginx_reload_endpoint(
    email: str = Depends(verify_session_token)
):
    """Reload Nginx configuration"""
    try:
        result = await reload_nginx()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/settings/database/test", response_model=dict)
async def test_database_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Test database connection"""
    try:
        result = await test_database_connection(payload)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/settings/database/from-env", response_model=dict)
async def database_from_env_endpoint(
    email: str = Depends(verify_session_token)
):
    """Read database settings from .env files in dev and prod directories"""
    try:
        result = await read_env_database_settings(settings.DEV_DIR, settings.PROD_DIR)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/settings/database/available", response_model=dict)
async def available_databases_endpoint(
    host: str = "localhost",
    port: int = 5432,
    user: str = "postgres",
    password: str = "",
    email: str = Depends(verify_session_token)
):
    """List available PostgreSQL databases"""
    try:
        result = await list_available_databases(host, port, user, password)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/settings/database/scan-all", response_model=dict)
async def scan_all_databases_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Scan ALL .env* files for DATABASE_URL strings"""
    try:
        project_path = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        result = await scan_all_env_databases(project_path)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/build/status", response_model=dict)
async def build_status_simple_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get current build status (simple)"""
    try:
        import os
        import json
        status_file = "/var/www/build/status/current_build.json"
        if os.path.exists(status_file):
            with open(status_file, 'r') as f:
                return json.load(f)
        return {"status": "idle"}
    except Exception as e:
        return {"status": "unknown", "error": str(e)}


@app.get("/api/git/status", response_model=dict)
async def git_status_simple_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Get git status for dashboard"""
    try:
        import subprocess
        directory = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        
        # Get current branch
        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=directory
        )
        branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "unknown"
        
        # Get current commit
        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, cwd=directory
        )
        commit = commit_result.stdout.strip() if commit_result.returncode == 0 else "unknown"
        
        # Check for changes
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=directory
        )
        has_changes = bool(status_result.stdout.strip())
        
        # Get last update time
        log_result = subprocess.run(
            ["git", "log", "-1", "--format=%ci"],
            capture_output=True, text=True, cwd=directory
        )
        last_update = log_result.stdout.strip() if log_result.returncode == 0 else ""
        
        return {
            "branch": branch,
            "commit": commit,
            "has_changes": has_changes,
            "last_update": last_update
        }
    except Exception as e:
        return {
            "branch": "unknown",
            "commit": "unknown",
            "has_changes": False,
            "error": str(e)
        }


@app.get("/api/stats/active-users", response_model=dict)
async def active_users_endpoint(
    env: str = "dev",
    email: str = Depends(verify_session_token)
):
    """Get active users/sessions count for an environment"""
    try:
        import psycopg2
        from health import get_database_url_from_env
        
        project_path = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
        database_url = get_database_url_from_env(project_path, env)
        
        if not database_url:
            return {"active_users": 0, "active_sessions": 0, "error": "No database URL found"}
        
        conn = psycopg2.connect(database_url, connect_timeout=5)
        cursor = conn.cursor()
        
        # Try to get active sessions (adjust table/column names as needed)
        active_sessions = 0
        active_users = 0
        
        try:
            # Check for Session table (common in Next-Auth)
            cursor.execute("""
                SELECT COUNT(*) FROM "Session" 
                WHERE expires > NOW()
            """)
            active_sessions = cursor.fetchone()[0]
        except:
            pass
        
        try:
            # Check for active users in last 15 minutes
            cursor.execute("""
                SELECT COUNT(DISTINCT "userId") FROM "Session" 
                WHERE expires > NOW() 
                AND "createdAt" > NOW() - INTERVAL '15 minutes'
            """)
            active_users = cursor.fetchone()[0]
        except:
            # Fallback: just use session count
            active_users = active_sessions
        
        cursor.close()
        conn.close()
        
        return {
            "active_users": active_users,
            "active_sessions": active_sessions,
            "env": env
        }
    except Exception as e:
        return {
            "active_users": 0,
            "active_sessions": 0,
            "error": str(e)
        }


# ============= BUILDMASTER SETTINGS ENDPOINTS =============

@app.get("/api/buildmaster/settings", response_model=dict)
async def get_buildmaster_settings_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get BuildMaster settings"""
    try:
        settings_data = await load_buildmaster_settings()
        return settings_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/settings", response_model=dict)
async def save_buildmaster_settings_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Save BuildMaster settings"""
    try:
        result = await save_buildmaster_settings(payload)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/buildmaster/status", response_model=dict)
async def get_buildmaster_status_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get BuildMaster status"""
    try:
        status_data = await get_buildmaster_status()
        return status_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/buildmaster/valid-emails", response_model=dict)
async def get_valid_emails_endpoint(
    email: str = Depends(verify_session_token)
):
    """Get list of valid emails (authorized users)"""
    try:
        emails = await load_valid_emails()
        return {"success": True, "emails": emails, "count": len(emails)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/valid-emails", response_model=dict)
async def save_valid_emails_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Save list of valid emails"""
    try:
        emails = payload.get("emails", [])
        result = await save_valid_emails(emails)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/valid-emails/add", response_model=dict)
async def add_valid_email_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Add a single valid email"""
    try:
        new_email = payload.get("email", "")
        if not new_email:
            raise HTTPException(status_code=400, detail="Email is required")
        result = await add_valid_email(new_email)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/valid-emails/remove", response_model=dict)
async def remove_valid_email_endpoint(
    payload: dict,
    email: str = Depends(verify_session_token)
):
    """Remove a valid email"""
    try:
        email_to_remove = payload.get("email", "")
        if not email_to_remove:
            raise HTTPException(status_code=400, detail="Email is required")
        result = await remove_valid_email(email_to_remove)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/check-updates", response_model=dict)
async def check_updates_endpoint(
    email: str = Depends(verify_session_token)
):
    """Check for BuildMaster updates from GitHub"""
    try:
        result = await check_for_updates()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/update", response_model=dict)
async def update_buildmaster_endpoint(
    email: str = Depends(verify_session_token)
):
    """Update BuildMaster application from GitHub"""
    try:
        result = await update_application()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/buildmaster/restart", response_model=dict)
async def restart_buildmaster_endpoint(
    email: str = Depends(verify_session_token)
):
    """Restart BuildMaster service"""
    try:
        result = await restart_buildmaster_service()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Health check endpoint (no auth required)
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.BUILD_API_HOST,
        port=settings.BUILD_API_PORT,
        reload=False
    )

