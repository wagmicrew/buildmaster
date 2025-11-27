#!/bin/bash
# Build wrapper script for Build Dashboard
# This script wraps the existing build process and provides status updates

set -e

BUILD_ID="${1:-unknown}"
LOG_FILE="${2:-/var/www/build/logs/builds/${BUILD_ID}.log}"
STATUS_FILE="/var/www/build/data/${BUILD_ID}.json"
DEV_DIR="/var/www/dintrafikskolax_dev"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$STATUS_FILE")"

# Function to update status
update_status() {
    local status=$1
    local message=$2
    local progress=${3:-0}
    
    cat > "$STATUS_FILE" <<EOF
{
    "build_id": "$BUILD_ID",
    "status": "$status",
    "message": "$message",
    "progress": $progress,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Start build
log "Starting build: $BUILD_ID"
update_status "running" "Build in progress..." 0

cd "$DEV_DIR" || {
    log "ERROR: Failed to change to dev directory: $DEV_DIR"
    update_status "error" "Failed to change directory"
    exit 1
}

# Run the build
log "Running: pnpm run build:server"
if pnpm run build:server >> "$LOG_FILE" 2>&1; then
    log "Build completed successfully"
    update_status "success" "Build completed successfully" 100
    exit 0
else
    BUILD_EXIT_CODE=$?
    log "Build failed with exit code: $BUILD_EXIT_CODE"
    update_status "error" "Build failed with exit code $BUILD_EXIT_CODE" 0
    exit $BUILD_EXIT_CODE
fi

