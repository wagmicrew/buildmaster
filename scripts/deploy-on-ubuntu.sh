#!/bin/bash

# Download and Deploy Updated Frontend
# Run this directly on your Ubuntu server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BUILDMASTER_DIR="/var/www/build"
TEMP_DIR="/tmp/buildmaster-deploy"
WEB_DIST_DIR="$BUILDMASTER_DIR/web/dist"
BACKUP_DIR="/var/www/build/backup/$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🚀 Download and Deploy Updated Frontend${NC}"
echo "========================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Check if BuildMaster directory exists
if [ ! -d "$BUILDMASTER_DIR" ]; then
    echo -e "${RED}❌ BuildMaster directory not found at $BUILDMASTER_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ BuildMaster directory found${NC}"

# Clean up and create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/web"

echo -e "${YELLOW}📥 Downloading updated frontend files...${NC}"

# Method 1: Try to download from a web location (if you have one)
# Uncomment and modify if you have a URL where the files are hosted
# if wget -q --spider http://your-domain.com/buildmaster-dist.tar.gz 2>/dev/null; then
#     wget -O "$TEMP_DIR/frontend.tar.gz" http://your-domain.com/buildmaster-dist.tar.gz
#     cd "$TEMP_DIR"
#     tar -xzf frontend.tar.gz
#     echo -e "${GREEN}✅ Files downloaded from web${NC}"
# else

# Method 2: Manual instructions
echo -e "${YELLOW}⚠️  Please copy the frontend files manually:${NC}"
echo ""
echo "On your Windows machine, run these commands:"
echo "1. cd c:\\Project\\Buildmaster\\buildmaster"
echo "2. scp -r web/dist root@YOUR_SERVER_IP:/tmp/buildmaster-deploy/web/"
echo ""
echo "Replace YOUR_SERVER_IP with your actual server IP"
echo ""
echo "After copying files, run this script again"
echo ""

# Check if files exist
if [ ! -f "$TEMP_DIR/web/dist/index.html" ]; then
    echo -e "${RED}❌ Frontend files not found in $TEMP_DIR/web/dist/${NC}"
    echo "Please copy the files first as described above"
    exit 1
fi

# Method 3: If files exist, continue with deployment
echo -e "${GREEN}✅ Frontend files found, proceeding with deployment${NC}"

# fi

# Create backup of current frontend
echo -e "${YELLOW}📦 Creating backup of current frontend...${NC}"
if [ -d "$WEB_DIST_DIR" ]; then
    mkdir -p "$(dirname "$BACKUP_DIR")"
    cp -r "$WEB_DIST_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✅ Backup created at $BACKUP_DIR${NC}"
else
    echo -e "${YELLOW}⚠️  No existing frontend to backup${NC}"
fi

# Copy updated frontend files
echo -e "${YELLOW}📋 Copying updated frontend files...${NC}"
mkdir -p "$WEB_DIST_DIR"
cp -r "$TEMP_DIR/web/dist/"* "$WEB_DIST_DIR/"
echo -e "${GREEN}✅ Frontend files copied${NC}"

# Set proper permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
chown -R www-data:www-data "$WEB_DIST_DIR"
chmod -R 755 "$WEB_DIST_DIR"
echo -e "${GREEN}✅ Permissions set${NC}"

# Test nginx configuration
echo -e "${YELLOW}🧪 Testing nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}✅ Nginx configuration is valid${NC}"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    echo "Please check nginx configuration before reloading"
    exit 1
fi

# Reload nginx
echo -e "${YELLOW}🔄 Reloading nginx...${NC}"
systemctl reload nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx reloaded successfully${NC}"
else
    echo -e "${RED}❌ Failed to reload nginx${NC}"
    exit 1
fi

# Check API service
echo -e "${YELLOW}🔍 Checking API service status...${NC}"
if systemctl is-active --quiet build-dashboard-api; then
    echo -e "${GREEN}✅ API service is running${NC}"
else
    echo -e "${YELLOW}⚠️  API service is not running, starting it...${NC}"
    systemctl start build-dashboard-api
    sleep 3
    
    if systemctl is-active --quiet build-dashboard-api; then
        echo -e "${GREEN}✅ API service started${NC}"
    else
        echo -e "${RED}❌ Failed to start API service${NC}"
        exit 1
    fi
fi

# Test API endpoints
echo -e "${YELLOW}🧪 Testing API endpoints...${NC}"
sleep 2

# Test health endpoint
if curl -s http://localhost:8001/health > /dev/null; then
    echo -e "${GREEN}✅ API health endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️  API health endpoint not responding (may need more time)${NC}"
fi

# Test certificate endpoint
if curl -s http://localhost:8001/api/nginx/ssl-certificates > /dev/null; then
    echo -e "${GREEN}✅ Certificate management endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️  Certificate management endpoint not responding (may need more time)${NC}"
fi

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 What's been deployed:${NC}"
echo "  ✅ Updated frontend with dedicated Certificates tab"
echo "  ✅ Enhanced certificate management interface"
echo "  ✅ Improved user experience for SSL certificates"
echo "  ✅ Certificate details modal"
echo "  ✅ Individual certificate renewal"
echo ""
echo -e "${BLUE}🌐 New Features Available:${NC}"
echo "  📱 Dedicated 'Certificates' tab in Settings"
echo "  🔐 Enhanced SSL certificate management"
echo "  🔄 Individual certificate renewal"
echo "  👁️ Detailed certificate information"
echo "  ⚠️ Expiry warnings and status"
echo ""
echo -e "${BLUE}🔧 Access Information:${NC}"
echo "  Web Interface: http://your-server-ip"
echo "  Settings → Certificates tab"
echo ""
echo -e "${BLUE}📋 Management Commands:${NC}"
echo "  Restart API:    sudo systemctl restart build-dashboard-api"
echo "  Check status:   sudo systemctl status build-dashboard-api"
echo "  View logs:      sudo journalctl -u build-dashboard-api -f"
echo "  Renew certs:    sudo /var/www/build/scripts/buildmaster-manager.sh cert-renew"
echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "  1. Clear browser cache (Ctrl+F5)"
echo "  2. Navigate to Settings → Certificates"
echo "  3. Test certificate management features"
echo "  4. Verify SSL certificates are displayed"
echo ""
echo -e "${BLUE}📁 Backup Information:${NC}"
echo "  Previous frontend backed up to: $BACKUP_DIR"
echo "  To restore if needed: cp -r $BACKUP_DIR/* $WEB_DIST_DIR/"
