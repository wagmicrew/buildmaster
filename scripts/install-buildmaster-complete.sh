#!/bin/bash

# BuildMaster Complete Installation with Certificate Management
# This script installs BuildMaster with certificate management functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BUILDMASTER_DIR="/var/www/build"
SERVICE_NAME="build-dashboard-api"
API_PORT="8001"
WEB_PORT="3000"

echo -e "${BLUE}🚀 BuildMaster Complete Installation${NC}"
echo "=================================="
echo "This will install BuildMaster with certificate management"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Function to install system dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
    
    # Update package list
    apt update
    
    # Install required packages
    apt install -y python3 python3-pip python3-venv nginx curl wget git
    
    # Install SSL tools
    apt install -y openssl certbot python3-certbot-nginx
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to setup Python environment
setup_python_env() {
    echo -e "${YELLOW}🐍 Setting up Python environment...${NC}"
    
    # Create virtual environment
    cd "$BUILDMASTER_DIR/api"
    python3 -m venv venv
    source venv/bin/activate
    
    # Install Python dependencies
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        # Install basic FastAPI dependencies
        pip install fastapi uvicorn python-multipart python-jose[cryptography] passlib[bcrypt] python-dotenv
    fi
    
    echo -e "${GREEN}✅ Python environment setup${NC}"
}

# Function to setup web frontend
setup_web_frontend() {
    echo -e "${YELLOW}🌐 Setting up web frontend...${NC}"
    
    cd "$BUILDMASTER_DIR/web"
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}📦 Installing Node.js...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # Install npm dependencies
    npm install
    
    # Build the frontend
    npm run build
    
    echo -e "${GREEN}✅ Web frontend setup${NC}"
}

# Function to setup systemd service
setup_systemd_service() {
    echo -e "${YELLOW}⚙️  Setting up systemd service...${NC}"
    
    # Create service file
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=BuildMaster API with Certificate Management
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$BUILDMASTER_DIR/api
Environment=PATH=$BUILDMASTER_DIR/api/venv/bin
ExecStart=$BUILDMASTER_DIR/api/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port $API_PORT
Restart=always
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Environment
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    systemctl daemon-reload
    
    echo -e "${GREEN}✅ Systemd service setup${NC}"
}

# Function to setup nginx reverse proxy
setup_nginx_proxy() {
    echo -e "${YELLOW}🌐 Setting up nginx reverse proxy...${NC}"
    
    # Create nginx configuration
    cat > "/etc/nginx/sites-available/buildmaster" << EOF
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root $BUILDMASTER_DIR/web/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$API_PORT/health;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/buildmaster /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload nginx
    nginx -t && systemctl reload nginx
    
    echo -e "${GREEN}✅ Nginx proxy setup${NC}"
}

# Function to setup certificate management
setup_certificate_management() {
    echo -e "${YELLOW}🔐 Setting up certificate management...${NC}"
    
    # Run the certificate management setup script
    if [ -f "$BUILDMASTER_DIR/../scripts/setup-cert-management.sh" ]; then
        bash "$BUILDMASTER_DIR/../scripts/setup-cert-management.sh"
    else
        echo -e "${YELLOW}⚠️  Certificate management script not found, creating basic setup...${NC}"
        
        # Create basic certificate management script
        cat > "$BUILDMASTER_DIR/api/cert-manager.sh" << 'EOF'
#!/bin/bash
# Basic certificate management for BuildMaster

case "$1" in
    "discover")
        echo "{\"certificates\":[],\"success\":true}"
        ;;
    "renew")
        echo "{\"success\":false,\"output\":\"Certbot not configured\"}"
        ;;
    "details")
        echo "{\"success\":false,\"error\":\"Certificate not found\"}"
        ;;
    *)
        echo "{\"success\":false,\"error\":\"Invalid command\"}"
        ;;
esac
EOF
        chmod +x "$BUILDMASTER_DIR/api/cert-manager.sh"
    fi
    
    echo -e "${GREEN}✅ Certificate management setup${NC}"
}

# Function to set permissions
set_permissions() {
    echo -e "${YELLOW}🔒 Setting permissions...${NC}"
    
    # Set ownership
    chown -R www-data:www-data "$BUILDMASTER_DIR"
    
    # Set permissions
    find "$BUILDMASTER_DIR" -type d -exec chmod 755 {} \;
    find "$BUILDMASTER_DIR" -type f -exec chmod 644 {} \;
    
    # Make scripts executable
    find "$BUILDMASTER_DIR" -name "*.sh" -exec chmod 755 {} \;
    
    echo -e "${GREEN}✅ Permissions set${NC}"
}

# Function to start services
start_services() {
    echo -e "${YELLOW}🚀 Starting services...${NC}"
    
    # Start API service
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"
    
    # Wait for API to start
    sleep 3
    
    # Check if API is running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ API service running${NC}"
    else
        echo -e "${RED}❌ API service failed to start${NC}"
        systemctl status "$SERVICE_NAME"
        exit 1
    fi
    
    # Test API
    if curl -s http://localhost:$API_PORT/health > /dev/null; then
        echo -e "${GREEN}✅ API responding${NC}"
    else
        echo -e "${YELLOW}⚠️  API not responding (may need more time)${NC}"
    fi
    
    echo -e "${GREEN}✅ Services started${NC}"
}

# Main installation flow
main() {
    echo -e "${BLUE}📋 Installation Plan:${NC}"
    echo "  1. Install system dependencies"
    echo "  2. Setup Python environment"
    echo "  3. Setup web frontend"
    echo "  4. Setup systemd service"
    echo "  5. Setup nginx proxy"
    echo "  6. Setup certificate management"
    echo "  7. Set permissions"
    echo "  8. Start services"
    echo ""
    
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 1
    fi
    
    # Check if BuildMaster directory exists
    if [ ! -d "$BUILDMASTER_DIR" ]; then
        echo -e "${RED}❌ BuildMaster directory not found at $BUILDMASTER_DIR${NC}"
        echo "Please ensure BuildMaster is deployed to this location"
        exit 1
    fi
    
    # Run installation steps
    install_dependencies
    setup_python_env
    setup_web_frontend
    setup_systemd_service
    setup_nginx_proxy
    setup_certificate_management
    set_permissions
    start_services
    
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 What's been installed:${NC}"
    echo "  ✅ BuildMaster API with certificate management"
    echo "  ✅ Web frontend"
    echo "  ✅ Nginx reverse proxy"
    echo "  ✅ Systemd service"
    echo "  ✅ SSL certificate management tools"
    echo ""
    echo -e "${BLUE}🌐 Access Information:${NC}"
    echo "  Web Interface: http://your-server-ip"
    echo "  API Endpoint:  http://your-server-ip/api/"
    echo "  Health Check:  http://your-server-ip/health"
    echo ""
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "  Restart API:    sudo systemctl restart $SERVICE_NAME"
    echo "  Check status:   sudo systemctl status $SERVICE_NAME"
    echo "  View logs:      sudo journalctl -u $SERVICE_NAME -f"
    echo "  Restart nginx:  sudo systemctl reload nginx"
    echo ""
    echo -e "${YELLOW}⚠️  Next Steps:${NC}"
    echo "  1. Configure your domain in nginx"
    echo "  2. Setup SSL certificates with certbot"
    echo "  3. Navigate to Settings → Nginx tab for certificate management"
}

# Run main function
main "$@"
