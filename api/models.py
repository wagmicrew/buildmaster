"""Pydantic models for API requests and responses"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class BuildStatus(str, Enum):
    """Build status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    STALLED = "stalled"
    CANCELLED = "cancelled"


class BuildMode(str, Enum):
    """Build mode enumeration"""
    QUICK = "quick"
    FULL = "full"
    PHASED = "phased"
    PHASED_PROD = "phased-prod"
    CLEAN = "clean"
    RAM_OPTIMIZED = "ram-optimized"


class ProjectType(str, Enum):
    """Project type enumeration"""
    NEXTJS = "nextjs"
    AUTO = "auto"  # Auto-detect based on package.json


# Authentication Models
class OTPRequest(BaseModel):
    """Request OTP model"""
    email: EmailStr


class OTPVerify(BaseModel):
    """Verify OTP model"""
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6)


class SessionResponse(BaseModel):
    """Session response model"""
    session_token: str
    expires_at: datetime


# Git Operations Models
class GitPullRequest(BaseModel):
    """Git pull request model"""
    stash_changes: Optional[bool] = True
    force: Optional[bool] = False
    branch: Optional[str] = None


class GitPullResponse(BaseModel):
    """Git pull response model"""
    success: bool
    message: str
    changes: Optional[List[str]] = None
    conflicts: Optional[List[str]] = None
    has_changes: Optional[bool] = None
    sql_migrations: Optional[List[str]] = None
    build_dashboard_changes: Optional[List[str]] = None
    should_reload: Optional[bool] = False


# PM2 Operations Models
class PM2ReloadResponse(BaseModel):
    """PM2 reload response model"""
    success: bool
    message: str
    status: Optional[Dict[str, Any]] = None


# Build Configuration Models
class BuildConfig(BaseModel):
    """Build configuration model"""
    workers: Optional[int] = Field(None, ge=0, le=16)
    max_old_space_size: Optional[int] = Field(None, ge=0, le=32768)
    max_semi_space_size: Optional[int] = Field(None, ge=0, le=4096)
    build_mode: BuildMode = BuildMode.FULL
    build_type: Optional[str] = Field('development', description="Build type: development or production")
    project_type: ProjectType = ProjectType.AUTO  # Auto-detect or specify framework
    build_target: Optional[str] = Field('development', description="Build target: development or production")
    test_database: bool = True
    test_redis: bool = True
    skip_deps: bool = False
    force_clean: bool = False
    experimental_flags: Optional[List[str]] = None
    # Advanced options
    use_redis_cache: bool = False
    incremental_build: bool = False
    skip_type_check: bool = False
    parallel_processing: bool = True
    minify_output: bool = True
    source_maps: bool = False
    tree_shaking: bool = True
    code_splitting: bool = True
    compress_assets: bool = True
    optimize_images: bool = False
    remove_console_logs: bool = False
    experimental_turbo: bool = False
    # Vite-specific options
    vite_mode: Optional[str] = Field(None, description="Vite build mode override")
    express_build: bool = True  # Build Express backend for Vite+Express projects
    vite_minify: bool = True
    vite_legacy: bool = False
    vite_ssr: bool = False
    vite_manifest: bool = True
    vite_css_code_split: bool = True
    vite_sourcemap: bool = False
    vite_report_size: bool = False
    vite_chunk_size_warning: bool = True
    vite_chunk_size_limit: int = 500
    vite_asset_inline_limit: int = 4
    vite_target: str = "esnext"
    vite_minifier: str = "esbuild"
    # Next.js specific options
    next_standalone: bool = True
    next_export: bool = False
    next_swc_minify: bool = True
    next_image_optimization: bool = True
    next_bundle_analyzer: bool = False
    next_modularize_imports: bool = True
    next_output: str = "standalone"
    next_image_formats: str = "webp"
    next_compiler: str = "swc"
    next_react_compiler: str = "disabled"
    # Express specific options
    express_typescript: bool = True
    express_bundle: bool = False
    express_sourcemap: bool = True
    express_minify: bool = False
    express_copy_assets: bool = True
    express_node_target: str = "node18"
    express_module_format: str = "esm"
    express_out_dir: str = "dist"
    express_entry: str = "src/index.ts"


class BuildStartRequest(BaseModel):
    """Start build request model"""
    config: BuildConfig


class BuildStatusResponse(BaseModel):
    """Build status response model"""
    build_id: str
    status: BuildStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    progress: Optional[float] = None
    current_step: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None
    config: Optional[BuildConfig] = None


class BuildHistoryResponse(BaseModel):
    """Build history response model"""
    builds: List[BuildStatusResponse]
    total: int


# Deploy Models
class DeployGoLiveRequest(BaseModel):
    """Go Live deployment request model"""
    build_id: Optional[str] = None
    skip_backup: bool = False


class DeployGoLiveResponse(BaseModel):
    """Go Live deployment response model"""
    success: bool
    message: str
    build_id: Optional[str] = None
    deployed_at: datetime


# Health Check Models
class ServerHealthResponse(BaseModel):
    """Server health response model"""
    cpu_percent: float
    memory_total: int
    memory_available: int
    memory_percent: float
    disk_total: int
    disk_free: int
    disk_percent: float
    uptime: float
    timestamp: datetime


class DatabaseHealthResponse(BaseModel):
    """Database health response model"""
    connected: bool
    response_time_ms: Optional[float] = None
    error: Optional[str] = None
    timestamp: datetime
    version: Optional[str] = None
    size_bytes: Optional[int] = None
    connection_count: Optional[int] = None
    table_count: Optional[int] = None


class RedisHealthResponse(BaseModel):
    """Redis health response model"""
    connected: bool
    response_time_ms: Optional[float] = None
    error: Optional[str] = None
    timestamp: datetime


class EnvironmentHealthResponse(BaseModel):
    """Environment health response model"""
    dev_env_exists: bool
    prod_env_exists: bool
    app_env_exists: bool
    pm2_dev_running: bool
    pm2_prod_running: bool
    pm2_app_running: bool
    git_repo_status: str
    timestamp: datetime


# Error Response Model
class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    code: str
    details: Optional[Dict[str, Any]] = None

