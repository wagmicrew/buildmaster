#!/bin/bash

# Copy Frontend Files to Ubuntu Server
# Run this on your Windows machine (with WSL or Git Bash) to copy files to Ubuntu

set -e

# Configuration
SERVER_USER="root"  # Change to your username
SERVER_IP=""       # Add your server IP here
BUILDMASTER_PATH="/var/www/build"

echo "🚀 Copying Frontend Files to Ubuntu Server"
echo "=========================================="

# Check if server IP is provided
if [ -z "$SERVER_IP" ]; then
    echo "❌ Please edit this script and add your server IP:"
    echo "   SERVER_IP=\"your-server-ip-here\""
    exit 1
fi

# Check if frontend is built
if [ ! -d "./web/dist" ]; then
    echo "❌ Frontend not built. Please run 'npm run build' first:"
    echo "   cd web && npm run build"
    exit 1
fi

echo "✅ Frontend build found"
echo "📋 Copying to $SERVER_USER@$SERVER_IP:$BUILDMASTER_PATH/web/dist"

# Create temporary directory on server
ssh "$SERVER_USER@$SERVER_IP" "mkdir -p /tmp/web/dist"

# Copy frontend files
scp -r ./web/dist/* "$SERVER_USER@$SERVER_IP:/tmp/web/dist/"

echo "✅ Files copied to server"
echo ""
echo "🔧 Now run this on your Ubuntu server:"
echo "   sudo bash /tmp/deploy-frontend-updates.sh"
echo ""
echo "📋 Or copy and run this command:"
echo "   ssh $SERVER_USER@$SERVER_IP 'sudo bash /tmp/deploy-frontend-updates.sh'"
