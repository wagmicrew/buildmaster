#!/bin/bash
# Build script for development environment
# This script runs non-interactively based on environment variables set by the build dashboard

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

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

# Logging function
log_step() {
    local step="$1"
    local message="$2"
    echo -e "${BOLD}${CYAN}[STEP: $step]${NC} ${message}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1" | tee -a "$LOG_FILE"
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
log_info "Build ID: $BUILD_ID"
log_info "Build Mode: $BUILD_MODE"
log_info "Working Directory: $DEV_DIR"
echo "" | tee -a "$LOG_FILE"

cd "$DEV_DIR" || exit 1

# Step 1: Clean (if requested)
if [ "$FORCE_CLEAN" = "true" ]; then
    update_status "CLEAN" 5 "Cleaning build artifacts"
    log_step "CLEAN" "Removing old build artifacts"
    
    rm -rf .next 2>&1 | tee -a "$LOG_FILE"
    rm -rf out 2>&1 | tee -a "$LOG_FILE"
    
    if [ "$USE_REDIS_CACHE" = "false" ]; then
        log_info "Clearing build cache"
        rm -rf .cache 2>&1 | tee -a "$LOG_FILE"
    fi
    
    log_success "Clean completed"
    echo "" | tee -a "$LOG_FILE"
fi

# Step 2: Dependencies (if not skipped)
if [ "$SKIP_DEPS" = "false" ]; then
    update_status "DEPS" 10 "Installing dependencies"
    log_step "DEPS" "Installing dependencies"
    
    # Non-interactive pnpm install
    PNPM_INSTALL_ARGS="--frozen-lockfile --prefer-offline"
    
    if pnpm install $PNPM_INSTALL_ARGS 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Dependencies installed"
    else
        log_error "Failed to install dependencies"
        update_status "ERROR" 10 "Dependency installation failed"
        exit 1
    fi
    echo "" | tee -a "$LOG_FILE"
fi

# Step 3: Pre-build checks
update_status "CHECKS" 15 "Running pre-build checks"
log_step "CHECKS" "Running pre-build checks"

# Test database connection
if [ "$TEST_DATABASE" = "true" ]; then
    log_info "Testing database connection..."
    if curl -s http://localhost:3001/api/health/database | grep -q "connected"; then
        log_success "Database connection OK"
    else
        log_warning "Database connection failed (continuing anyway)"
    fi
fi

# Test Redis connection
if [ "$TEST_REDIS" = "true" ]; then
    log_info "Testing Redis connection..."
    if redis-cli ping 2>&1 | grep -q "PONG"; then
        log_success "Redis connection OK"
    else
        log_warning "Redis connection failed (continuing anyway)"
    fi
fi

echo "" | tee -a "$LOG_FILE"

# Step 4: Build configuration
update_status "CONFIG" 20 "Configuring build"
log_step "CONFIG" "Configuring build environment"

# Build environment variables
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Memory settings
if [ "$MAX_OLD_SPACE" != "0" ]; then
    export NODE_OPTIONS="--max-old-space-size=$MAX_OLD_SPACE"
    log_info "Memory limit: ${MAX_OLD_SPACE}MB"
else
    case "$BUILD_MODE" in
        quick)
            export NODE_OPTIONS="--max-old-space-size=4096"
            log_info "Quick mode: 4GB memory limit"
            ;;
        ram-optimized)
            export NODE_OPTIONS="--max-old-space-size=6144"
            log_info "RAM optimized: 6GB memory limit"
            ;;
        full)
            export NODE_OPTIONS="--max-old-space-size=8192"
            log_info "Full mode: 8GB memory limit"
            ;;
    esac
fi

# Advanced build options
if [ "$USE_REDIS_CACHE" = "true" ]; then
    export NEXT_BUILD_CACHE=redis
    log_info "✓ Redis cache enabled"
fi

if [ "$INCREMENTAL_BUILD" = "true" ]; then
    export NEXT_BUILD_INCREMENTAL=true
    log_info "✓ Incremental build enabled"
fi

if [ "$SKIP_TYPE_CHECK" = "true" ]; then
    export NEXT_BUILD_SKIP_TYPE_CHECK=true
    log_warning "⚠ Type checking disabled (risky)"
fi

if [ "$PARALLEL_PROCESSING" = "true" ]; then
    export NEXT_BUILD_PARALLEL=true
    log_info "✓ Parallel processing enabled"
fi

if [ "$EXPERIMENTAL_TURBO" = "true" ]; then
    export NEXT_BUILD_TURBO=true
    log_warning "⚠ Experimental turbo mode enabled (unstable)"
fi

if [ "$MINIFY_OUTPUT" = "true" ]; then
    export NEXT_BUILD_MINIFY=true
    log_info "✓ Minification enabled"
fi

if [ "$SOURCE_MAPS" = "true" ]; then
    export NEXT_BUILD_SOURCE_MAPS=true
    log_info "✓ Source maps enabled"
fi

if [ "$TREE_SHAKING" = "true" ]; then
    export NEXT_BUILD_TREE_SHAKING=true
    log_info "✓ Tree shaking enabled"
fi

if [ "$CODE_SPLITTING" = "true" ]; then
    export NEXT_BUILD_CODE_SPLITTING=true
    log_info "✓ Code splitting enabled"
fi

if [ "$COMPRESS_ASSETS" = "true" ]; then
    export NEXT_BUILD_COMPRESS=true
    log_info "✓ Asset compression enabled"
fi

if [ "$OPTIMIZE_IMAGES" = "true" ]; then
    export NEXT_BUILD_OPTIMIZE_IMAGES=true
    log_info "✓ Image optimization enabled"
fi

if [ "$REMOVE_CONSOLE_LOGS" = "true" ]; then
    export NEXT_BUILD_REMOVE_CONSOLE=true
    log_info "✓ Console log removal enabled"
fi

# Database/Redis disabled at build time
export DATABASE_DISABLED_AT_BUILD=true
export REDIS_DISABLED_AT_BUILD=true

echo "" | tee -a "$LOG_FILE"

# Step 5: Build
update_status "BUILD" 30 "Building application"
log_step "BUILD" "Starting Next.js build"
log_info "This may take 10-35 minutes depending on configuration..."
echo "" | tee -a "$LOG_FILE"

# Run build with all output to log
if pnpm run build 2>&1 | tee -a "$LOG_FILE"; then
    update_status "BUILD_COMPLETE" 90 "Build completed successfully"
    log_success "Build completed successfully!"
else
    update_status "ERROR" 30 "Build failed"
    log_error "Build failed!"
    exit 1
fi

echo "" | tee -a "$LOG_FILE"

# Step 6: Post-build verification
update_status "VERIFY" 95 "Verifying build output"
log_step "VERIFY" "Verifying build output"

if [ -d ".next" ]; then
    NEXT_SIZE=$(du -sh .next | cut -f1)
    log_success "Build output verified (.next size: $NEXT_SIZE)"
else
    log_error "Build output directory not found!"
    update_status "ERROR" 95 "Build verification failed"
    exit 1
fi

# Step 7: Complete
update_status "COMPLETE" 100 "Build completed successfully"
log_step "COMPLETE" "Build process finished"
log_success "All steps completed successfully!"
echo "" | tee -a "$LOG_FILE"

# Final status
cat > "/var/www/build/status/${BUILD_ID}.json" <<EOF
{
  "build_id": "$BUILD_ID",
  "status": "success",
  "current_step": "COMPLETE",
  "progress": 100,
  "message": "Build completed successfully",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

log_info "Build ID: $BUILD_ID"
log_info "Log file: $LOG_FILE"
log_success "Build completed in $(date -u +%H:%M:%S)"
