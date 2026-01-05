#!/bin/bash

# BuildMaster API Management Script
# Easy commands to manage the BuildMaster API service

SERVICE_NAME="build-dashboard-api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

case "$1" in
    start)
        echo -e "${BLUE}🚀 Starting $SERVICE_NAME...${NC}"
        sudo systemctl start "$SERVICE_NAME"
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            echo -e "${GREEN}✅ Service started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start service${NC}"
        fi
        ;;
        
    stop)
        echo -e "${YELLOW}🛑 Stopping $SERVICE_NAME...${NC}"
        sudo systemctl stop "$SERVICE_NAME"
        echo -e "${GREEN}✅ Service stopped${NC}"
        ;;
        
    restart)
        echo -e "${YELLOW}🔄 Restarting $SERVICE_NAME...${NC}"
        sudo systemctl restart "$SERVICE_NAME"
        sleep 2
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            echo -e "${GREEN}✅ Service restarted successfully${NC}"
        else
            echo -e "${RED}❌ Failed to restart service${NC}"
        fi
        ;;
        
    status)
        echo -e "${BLUE}📊 $SERVICE_NAME Status:${NC}"
        sudo systemctl status "$SERVICE_NAME"
        ;;
        
    logs)
        echo -e "${BLUE}📋 $SERVICE_NAME Logs (Ctrl+C to exit):${NC}"
        sudo journalctl -u "$SERVICE_NAME" -f
        ;;
        
    setup)
        echo -e "${BLUE}⚙️  Running full setup...${NC}"
        sudo bash "$(dirname "$0")/setup-api-service.sh"
        ;;
        
    *)
        echo -e "${BLUE}BuildMaster API Management${NC}"
        echo "=========================="
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the API service"
        echo "  stop     - Stop the API service"
        echo "  restart  - Restart the API service"
        echo "  status   - Show service status"
        echo "  logs     - Show live logs"
        echo "  setup    - Run full setup (first time only)"
        echo ""
        echo "Examples:"
        echo "  $0 restart    # Restart the service"
        echo "  $0 status     # Check status"
        echo "  $0 logs       # View logs"
        ;;
esac
