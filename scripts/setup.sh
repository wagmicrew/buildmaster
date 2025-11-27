#!/bin/bash
# Setup script for Build Dashboard
# Run this script on the Ubuntu server to set up the build dashboard

set -e

echo "🚀 Setting up Build Dashboard..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Create directory structure
echo -e "${GREEN}Creating directory structure...${NC}"
mkdir -p /var/www/build/{api,web,scripts,logs/builds,data}
chown -R www-data:www-data /var/www/build
chmod +x /var/www/build/scripts/*.sh 2>/dev/null || true

# Setup Python backend
echo -e "${GREEN}Setting up Python backend...${NC}"
cd /var/www/build/api
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt || {
    echo -e "${YELLOW}requirements.txt not found, installing from plan...${NC}"
    pip install fastapi uvicorn[standard] pydantic pydantic-settings python-dotenv aiosmtplib sqlalchemy python-multipart python-jose[cryptography] passlib[bcrypt] psutil psycopg2-binary redis
}

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env <<EOF
BUILD_API_PORT=8889
BUILD_API_HOST=127.0.0.1
OTP_SECRET_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ALLOWED_EMAIL=johaswe@gmail.com
DEV_DIR=/var/www/dintrafikskolax_dev
PROD_DIR=/var/www/dintrafikskolax_prod
PM2_DEV_APP=dintrafikskolax-dev
PM2_PROD_APP=dintrafikskolax-prod
BUILD_LOG_DIR=/var/www/build/logs/builds
BUILD_DATA_DIR=/var/www/build/data
EOF
    chmod 600 .env
fi

# Setup React frontend
echo -e "${GREEN}Setting up React frontend...${NC}"
cd /var/www/build/web
if [ ! -d "node_modules" ]; then
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        echo -e "${RED}Neither pnpm nor npm found. Please install Node.js and pnpm.${NC}"
        exit 1
    fi
fi

# Build frontend
echo -e "${GREEN}Building frontend...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm build
elif command -v npm &> /dev/null; then
    npm run build
fi

# Setup systemd service
echo -e "${GREEN}Setting up systemd service...${NC}"
cat > /etc/systemd/system/build-dashboard-api.service <<EOF
[Unit]
Description=Build Dashboard API (FastAPI)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/build/api
Environment="PATH=/var/www/build/api/venv/bin"
ExecStart=/var/www/build/api/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8889
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=build-dashboard-api

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable build-dashboard-api

echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure Nginx (see Documentation_new/build-dashboard/nginx-config.conf)"
echo "2. Get SSL certificate: certbot --nginx -d build.dintrafikskolahlm.se"
echo "3. Start the API: systemctl start build-dashboard-api"
echo "4. Visit: https://build.dintrafikskolahlm.se"

