#!/bin/bash
# Minimal build script for development environment
# This script runs non-interactively and outputs minimal information
# System metrics are handled by API endpoints

set -e  # Exit on error

# Build configuration from environment variables
BUILD_ID="${BUILD_ID:-unknown}"
BUILD_MODE="${BUILD_MODE:-full}"
WORKERS="${WORKERS:-0}"
MAX_OLD_SPACE="${MAX_OLD_SPACE:-8192}"
MAX_SEMI_SPACE="${MAX_SEMI_SPACE:-0}"
SKIP_DEPS="${SKIP_DEPS:-false}"
FORCE_CLEAN="${FORCE_CLEAN:-false}"
TEST_DATABASE="${TEST_DATABASE:-true}"
TEST_REDIS="${TEST_REDIS:-true}"

# Advanced options
USE_REDIS_CACHE="${USE_REDIS_CACHE:-false}"
INCREMENTAL_BUILD="${INCREMENTAL_BUILD:-false}"
SKIP_TYPE_CHECK="${SKIP_TYPE_CHECK:-false}"
PARALLEL_PROCESSING="${PARALLEL_PROCESSING:-true}"
MINIFY_OUTPUT="${MINIFY_OUTPUT:-true}"
SOURCE_MAPS="${SOURCE_MAPS:-false}"
TREE_SHAKING="${TREE_SHAKING:-true}"
CODE_SPLITTING="${CODE_SPLITTING:-true}"
COMPRESS_ASSETS="${COMPRESS_ASSETS:-true}"
OPTIMIZE_IMAGES="${OPTIMIZE_IMAGES:-false}"
REMOVE_CONSOLE_LOGS="${REMOVE_CONSOLE_LOGS:-false}"
EXPERIMENTAL_TURBO="${EXPERIMENTAL_TURBO:-false}"

# Directories
DEV_DIR="${DEV_DIR:-/var/www/dintrafikskolax_dev}"
LOG_FILE="${LOG_FILE:-/var/www/build/logs/${BUILD_ID}.log}"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Minimal logging function - only errors and critical info
log_step() {
    local step="$1"
    local message="$2"
    echo "[$step] $message" >> "$LOG_FILE"
    echo "[$step] $message"  # Also to console for BuildLogs component
}

log_error() {
    echo "ERROR: $1" | tee -a "$LOG_FILE"
}

# Update build status file
update_status() {
    local step="$1"
    local progress="$2"
    local message="$3"
    
    cat > "/var/www/build/status/${BUILD_ID}.json" <<EOF
{
  "build_id": "$BUILD_ID",
  "status": "running",
  "current_step": "$step",
  "progress": $progress,
  "message": "$message",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

# Create status directory
mkdir -p /var/www/build/status

# Start build
log_step "INIT" "Starting build process"
echo "Build started: $BUILD_ID"

cd "$DEV_DIR" || exit 1

# Step 1: Clean (if requested)
if [ "$FORCE_CLEAN" = "true" ]; then
    update_status "CLEAN" 5 "Cleaning build artifacts"
    log_step "CLEAN" "Removing old build artifacts"
    
    rm -rf .next 2>>"$LOG_FILE"
    rm -rf out 2>>"$LOG_FILE"
    
    if [ "$USE_REDIS_CACHE" = "false" ]; then
        rm -rf .cache 2>>"$LOG_FILE"
    fi
    
    log_step "CLEAN" "Clean completed"
fi

# Step 2: Dependencies (if not skipped)
if [ "$SKIP_DEPS" = "false" ]; then
    update_status "DEPS" 10 "Installing dependencies"
    log_step "DEPS" "Installing dependencies"
    
    # Non-interactive pnpm install
    PNPM_INSTALL_ARGS="--frozen-lockfile --prefer-offline"
    
    if pnpm install $PNPM_INSTALL_ARGS >>"$LOG_FILE" 2>&1; then
        log_step "DEPS" "Dependencies installed"
    else
        log_error "Failed to install dependencies"
        update_status "ERROR" 10 "Dependency installation failed"
        exit 1
    fi
fi

# Step 3: Pre-build checks
update_status "CHECKS" 15 "Running pre-build checks"
log_step "CHECKS" "Running pre-build checks"

# Test database connection
if [ "$TEST_DATABASE" = "true" ]; then
    if curl -s http://localhost:3001/api/health/database | grep -q "connected"; then
        log_step "CHECKS" "Database connection OK"
    else
        echo "WARNING: Database connection failed (continuing anyway)" >> "$LOG_FILE"
    fi
fi

# Test Redis connection
if [ "$TEST_REDIS" = "true" ]; then
    if redis-cli ping 2>>"$LOG_FILE" | grep -q "PONG"; then
        log_step "CHECKS" "Redis connection OK"
    else
        echo "WARNING: Redis connection failed (continuing anyway)" >> "$LOG_FILE"
    fi
fi

# Step 4: Build configuration
update_status "CONFIG" 20 "Configuring build"
log_step "CONFIG" "Configuring build environment"

# Build environment variables
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Memory settings
if [ "$MAX_OLD_SPACE" != "0" ]; then
    export NODE_OPTIONS="--max-old-space-size=$MAX_OLD_SPACE"
else
    case "$BUILD_MODE" in
        quick)
            export NODE_OPTIONS="--max-old-space-size=4096"
            ;;
        ram-optimized)
            export NODE_OPTIONS="--max-old-space-size=6144"
            ;;
        full)
            export NODE_OPTIONS="--max-old-space-size=8192"
            ;;
    esac
fi

# Advanced build options (no verbose output)
if [ "$USE_REDIS_CACHE" = "true" ]; then
    export NEXT_BUILD_CACHE=redis
fi

if [ "$INCREMENTAL_BUILD" = "true" ]; then
    export NEXT_BUILD_INCREMENTAL=true
fi

if [ "$SKIP_TYPE_CHECK" = "true" ]; then
    export NEXT_BUILD_SKIP_TYPE_CHECK=true
fi

if [ "$PARALLEL_PROCESSING" = "true" ]; then
    export NEXT_BUILD_PARALLEL=true
fi

if [ "$EXPERIMENTAL_TURBO" = "true" ]; then
    export NEXT_BUILD_TURBO=true
fi

if [ "$MINIFY_OUTPUT" = "true" ]; then
    export NEXT_BUILD_MINIFY=true
fi

if [ "$SOURCE_MAPS" = "true" ]; then
    export NEXT_BUILD_SOURCE_MAPS=true
fi

if [ "$TREE_SHAKING" = "true" ]; then
    export NEXT_BUILD_TREE_SHAKING=true
fi

if [ "$CODE_SPLITTING" = "true" ]; then
    export NEXT_BUILD_CODE_SPLITTING=true
fi

if [ "$COMPRESS_ASSETS" = "true" ]; then
    export NEXT_BUILD_COMPRESS=true
fi

if [ "$OPTIMIZE_IMAGES" = "true" ]; then
    export NEXT_BUILD_OPTIMIZE_IMAGES=true
fi

if [ "$REMOVE_CONSOLE_LOGS" = "true" ]; then
    export NEXT_BUILD_REMOVE_CONSOLE=true
fi

# Step 5: Build Next.js app
update_status "BUILD" 30 "Building Next.js app"
log_step "BUILD" "Building Next.js application"

# Track worker for this build
WORKER_ID="worker-$(date +%s)"
echo "WORKER_ID=$WORKER_ID" >> "$LOG_FILE"

# Build command
BUILD_START_TIME=$(date +%s)

if pnpm build >>"$LOG_FILE" 2>&1; then
    BUILD_END_TIME=$(date +%s)
    BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))
    log_step "BUILD" "Build completed in ${BUILD_DURATION}s"
    
    update_status "SUCCESS" 100 "Build completed successfully"
    echo "Build completed successfully in ${BUILD_DURATION}s"
    
    # Update worker status
    cat > "/var/www/build/status/${BUILD_ID}-workers.json" <<EOF
{
  "workers": {
    "$WORKER_ID": {
      "job_name": "Next.js Build",
      "status": "completed",
      "duration": $BUILD_DURATION,
      "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  }
}
EOF
    
    exit 0
else
    BUILD_END_TIME=$(date +%s)
    BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))
    log_error "Build failed after ${BUILD_DURATION}s"
    
    update_status "ERROR" 100 "Build failed"
    
    # Update worker status
    cat > "/var/www/build/status/${BUILD_ID}-workers.json" <<EOF
{
  "workers": {
    "$WORKER_ID": {
      "job_name": "Next.js Build",
      "status": "failed",
      "duration": $BUILD_DURATION,
      "failed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  }
}
EOF
    
    # Show last 20 lines of log for debugging
    echo "=== Last 20 lines of build log ==="
    tail -20 "$LOG_FILE"
    echo "=================================="
    
    exit 1
fi
