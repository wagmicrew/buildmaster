#!/bin/bash

# BuildMaster API Setup Script
# This script sets up the BuildMaster API as a systemd service

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="build-dashboard-api"
SERVICE_USER="www-data"
SERVICE_DIR="/var/www/build"
PYTHON_PATH=$(which python3)
API_PORT="8000"

echo -e "${BLUE}🚀 BuildMaster API Setup Script${NC}"
echo "=================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Service Name: $SERVICE_NAME"
echo "  Service User: $SERVICE_USER"
echo "  Service Directory: $SERVICE_DIR"
echo "  Python Path: $PYTHON_PATH"
echo "  API Port: $API_PORT"
echo ""

# Check if required directories exist
echo -e "${YELLOW}📁 Checking directories...${NC}"
if [ ! -d "$SERVICE_DIR" ]; then
    echo -e "${RED}❌ Service directory $SERVICE_DIR does not exist${NC}"
    echo "Please ensure the BuildMaster application is deployed to $SERVICE_DIR"
    exit 1
fi

if [ ! -d "$SERVICE_DIR/api" ]; then
    echo -e "${RED}❌ API directory $SERVICE_DIR/api does not exist${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Directories found${NC}"

# Check Python installation
echo -e "${YELLOW}🐍 Checking Python installation...${NC}"
if [ -z "$PYTHON_PATH" ]; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    echo "Please install Python 3: apt install python3 python3-pip"
    exit 1
fi

echo -e "${GREEN}✅ Python found: $PYTHON_PATH${NC}"

# Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
cd "$SERVICE_DIR/api"

if [ -f "requirements.txt" ]; then
    $PYTHON_PATH -m pip install -r requirements.txt
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  No requirements.txt found, installing basic dependencies${NC}"
    $PYTHON_PATH -m pip install fastapi uvicorn python-multipart
fi

# Create systemd service file
echo -e "${YELLOW}⚙️  Creating systemd service...${NC}"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=BuildMaster API Service
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$SERVICE_DIR/api
Environment="PATH=$($PYTHON_PATH -c 'import sys; print ":".join(sys.path)')"
ExecStart=$PYTHON_PATH -m uvicorn main:app --host 0.0.0.0 --port $API_PORT
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$SERVICE_DIR

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✅ Service file created${NC}"

# Set proper permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
chown -R $SERVICE_USER:$SERVICE_USER "$SERVICE_DIR"
chmod 755 "$SERVICE_DIR/api"
chmod 644 "/etc/systemd/system/${SERVICE_NAME}.service"

# Reload systemd and enable service
echo -e "${YELLOW}🔄 Reloading systemd...${NC}"
systemctl daemon-reload

# Enable and start service
echo -e "${YELLOW}🚀 Enabling and starting service...${NC}"
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# Check service status
echo -e "${YELLOW}📊 Checking service status...${NC}"
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service is running!${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    echo "Check status with: systemctl status $SERVICE_NAME"
    echo "Check logs with: journalctl -u $SERVICE_NAME -f"
    exit 1
fi

# Show service details
echo ""
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Service Information:${NC}"
echo "  Status: $(systemctl is-active $SERVICE_NAME)"
echo "  Port: $API_PORT"
echo "  Log file: journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "${BLUE}🌐 API Endpoints:${NC}"
echo "  Health:  http://localhost:$API_PORT/health"
echo "  SSL Certs: http://localhost:$API_PORT/api/nginx/ssl-certificates"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "  - Make sure port $API_PORT is open in your firewall"
echo "  - The service will auto-restart if it crashes"
echo "  - Logs are managed by systemd journald"
echo "  - Check nginx configuration to proxy requests to this port"
