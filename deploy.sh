#!/bin/bash

# BuildMaster Deployment Script
# This script deploys BuildMaster to production server

set -e  # Exit on any error

echo "🚀 Starting BuildMaster deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUILDMASTER_DIR="/var/www/buildmaster"
API_DIR="$BUILDMASTER_DIR/api"
WEB_DIR="$BUILDMASTER_DIR/web"
LOG_DIR="/var/www/build/logs"
NGINX_CONF_DIR="/etc/nginx/sites-available"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

# Create directories
print_status "Creating directories..."
mkdir -p $BUILDMASTER_DIR
mkdir -p $LOG_DIR
mkdir -p /var/www/dintrafikskolax_dev
mkdir -p /var/www/dintrafikskolax_prod

# Copy files to production
print_status "Copying application files..."
cp -r api $BUILDMASTER_DIR/
cp -r web $BUILDMASTER_DIR/
cp nginx/buildmaster.conf $NGINX_CONF_DIR/

# Install Python dependencies
print_status "Installing Python dependencies..."
cd $API_DIR
pip3 install -r requirements.txt --system-site-packages

# Install Node.js dependencies and build frontend
print_status "Building frontend..."
cd $WEB_DIR
npm ci --production
npm run build

# Set permissions
print_status "Setting permissions..."
chown -R www-data:www-data $BUILDMASTER_DIR
chmod -R 755 $BUILDMASTER_DIR
chmod -R 755 $LOG_DIR

# Setup PM2
print_status "Setting up PM2..."
cd $API_DIR
pm2 delete buildmaster-api 2>/dev/null || true
pm2 start pm2.config.js --env production
pm2 save
pm2 startup

# Setup Nginx
print_status "Configuring Nginx..."
ln -sf $NGINX_CONF_DIR/buildmaster.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Create systemd service for PM2 (if not exists)
if [ ! -f /etc/systemd/system/pm2-root.service ]; then
    print_status "Creating PM2 systemd service..."
    cat > /etc/systemd/system/pm2-root.service << EOF
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=root
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/bin:/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
Environment=PM2_HOME=/root/.pm2
PIDFile=/root/.pm2/pm2.pid
ExecStart=/usr/local/bin/pm2 resurrect
ExecReload=/usr/local/bin/pm2 reload all
ExecStop=/usr/local/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable pm2-root
    systemctl start pm2-root
fi

# Test the deployment
print_status "Testing deployment..."
sleep 5

# Check API health
if curl -f -s http://127.0.0.1:8889/health > /dev/null; then
    print_status "✅ API server is responding"
else
    print_error "❌ API server is not responding"
    exit 1
fi

# Check PM2 status
pm2 status

print_status "🎉 BuildMaster deployment completed successfully!"
print_status "📱 Frontend: http://your-domain-or-ip"
print_status "🔧 API: http://your-domain-or-ip/api/health"
print_status "📊 PM2 status: pm2 status"
print_status "📋 Logs: pm2 logs buildmaster-api"

echo ""
print_warning "Don't forget to:"
echo "  1. Update server_name in nginx config"
echo "  2. Generate production secrets in .env.production"
echo "  3. Configure SSL certificate (optional)"
echo "  4. Update firewall rules if needed"
