#!/bin/bash

# BuildMaster API Restart Script
# This script safely restarts the BuildMaster API service

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="build-dashboard-api"
LOG_FILE="/var/log/buildmaster-api-restart.log"

echo -e "${BLUE}🔄 BuildMaster API Restart${NC}"
echo "=========================="

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   log_message "ERROR: Script not run as root"
   exit 1
fi

log_message "API restart initiated"

# Check if service exists
if ! systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
    echo -e "${RED}❌ Service $SERVICE_NAME not found${NC}"
    log_message "ERROR: Service $SERVICE_NAME not found"
    exit 1
fi

# Get current status
current_status=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")
echo -e "${YELLOW}📊 Current status: $current_status${NC}"
log_message "Current status: $current_status"

# Stop the service if running
if [ "$current_status" = "active" ]; then
    echo -e "${YELLOW}🛑 Stopping $SERVICE_NAME...${NC}"
    systemctl stop "$SERVICE_NAME"
    log_message "Service stopped"
    
    # Wait for service to stop
    sleep 2
    
    # Verify it's stopped
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${RED}❌ Failed to stop service${NC}"
        log_message "ERROR: Failed to stop service"
        exit 1
    fi
    echo -e "${GREEN}✅ Service stopped${NC}"
fi

# Start the service
echo -e "${YELLOW}🚀 Starting $SERVICE_NAME...${NC}"
systemctl start "$SERVICE_NAME"
log_message "Service start initiated"

# Wait for service to start
sleep 3

# Check if service started successfully
new_status=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "failed")
if [ "$new_status" = "active" ]; then
    echo -e "${GREEN}✅ Service started successfully${NC}"
    log_message "Service started successfully"
    
    # Test API endpoint
    echo -e "${YELLOW}🧪 Testing API endpoint...${NC}"
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API endpoint responding${NC}"
        log_message "API endpoint test successful"
    else
        echo -e "${YELLOW}⚠️  API endpoint not responding (may need more time)${NC}"
        log_message "API endpoint test failed - service may still be starting"
    fi
else
    echo -e "${RED}❌ Failed to start service${NC}"
    log_message "ERROR: Failed to start service - status: $new_status"
    
    # Show error details
    echo -e "${YELLOW}📋 Service status details:${NC}"
    systemctl status "$SERVICE_NAME" --no-pager | tail -10
    exit 1
fi

# Show service info
echo ""
echo -e "${BLUE}📋 Service Information:${NC}"
echo "  Status: $new_status"
echo "  Main PID: $(systemctl show -p MainPID --value "$SERVICE_NAME" 2>/dev/null || echo "N/A")"
echo "  Memory: $(systemctl show -p MemoryCurrent --value "$SERVICE_NAME" 2>/dev/null || echo "N/A") bytes"
echo "  Uptime: $(systemctl show -p ActiveEnterTimestamp --value "$SERVICE_NAME" 2>/dev/null || echo "N/A")"

echo ""
echo -e "${GREEN}🎉 API restart completed successfully!${NC}"
echo ""
echo -e "${BLUE}🔧 Additional Commands:${NC}"
echo "  View logs:    sudo journalctl -u $SERVICE_NAME -f"
echo "  Check status: sudo systemctl status $SERVICE_NAME"
echo "  View restart log: cat $LOG_FILE"

log_message "API restart completed successfully"
