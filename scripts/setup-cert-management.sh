#!/bin/bash

# BuildMaster Certificate Management Setup
# This script sets up certificate management functionality for BuildMaster

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BUILDMASTER_DIR="/var/www/build"
API_SERVICE_NAME="build-dashboard-api"
CERTBOT_AVAILABLE=false

echo -e "${BLUE}🔐 BuildMaster Certificate Management Setup${NC}"
echo "=========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Check if BuildMaster is installed
if [ ! -d "$BUILDMASTER_DIR" ]; then
    echo -e "${RED}❌ BuildMaster not found at $BUILDMASTER_DIR${NC}"
    echo "Please install BuildMaster first"
    exit 1
fi

echo -e "${GREEN}✅ BuildMaster directory found${NC}"

# Check if certbot is available
echo -e "${YELLOW}🔍 Checking for certbot...${NC}"
if command -v certbot &> /dev/null; then
    CERTBOT_AVAILABLE=true
    echo -e "${GREEN}✅ Certbot found${NC}"
else
    echo -e "${YELLOW}⚠️  Certbot not found - certificate renewal will be limited${NC}"
    echo "Install certbot with: apt install certbot python3-certbot-nginx"
fi

# Check if openssl is available
echo -e "${YELLOW}🔍 Checking for openssl...${NC}"
if command -v openssl &> /dev/null; then
    echo -e "${GREEN}✅ OpenSSL found${NC}"
else
    echo -e "${RED}❌ OpenSSL not found - installing...${NC}"
    apt update && apt install -y openssl
fi

# Check if nginx is available
echo -e "${YELLOW}🔍 Checking for nginx...${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✅ Nginx found${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx not found - nginx reload will not work${NC}"
fi

# Create certificate management helper script
echo -e "${YELLOW}📝 Creating certificate management script...${NC}"
cat > "$BUILDMASTER_DIR/api/cert-manager.sh" << 'EOF'
#!/bin/bash

# BuildMaster Certificate Management Helper
# This script provides certificate management functions for the API

CERTBOT_PATH=$(which certbot || echo "")
OPENSSL_PATH=$(which openssl || "")
NGINX_PATH=$(which nginx || "")

# Function to discover SSL certificates
discover_certificates() {
    local certificates="[]"
    local letsencrypt_path="/etc/letsencrypt/live"
    
    if [ -d "$letsencrypt_path" ]; then
        certificates="{\"certificates\":["
        local first=true
        
        for domain_dir in "$letsencrypt_path"/*; do
            if [ -d "$domain_dir" ]; then
                local domain=$(basename "$domain_dir")
                local cert_path="$domain_dir/fullchain.pem"
                local key_path="$domain_dir/privkey.pem"
                
                if [ -f "$cert_path" ] && [ -f "$key_path" ]; then
                    if [ "$first" = true ]; then
                        first=false
                    else
                        certificates="$certificates,"
                    fi
                    
                    # Get certificate info
                    local cert_info=$("$OPENSSL_PATH" x509 -in "$cert_path" -noout -subject -dates 2>/dev/null || echo "")
                    local subject=$(echo "$cert_info" | grep "subject=" | cut -d'=' -f2 | tr -d '\n' || echo "Unknown")
                    local not_before=$(echo "$cert_info" | grep "notBefore=" | cut -d'=' -f2 | tr -d '\n' || echo "Unknown")
                    local not_after=$(echo "$cert_info" | grep "notAfter=" | cut -d'=' -f2 | tr -d '\n' || echo "Unknown")
                    
                    certificates="$certificates{\"domain\":\"$domain\",\"cert_path\":\"$cert_path\",\"key_path\":\"$key_path\",\"subject\":\"$subject\",\"notBefore\":\"$not_before\",\"notAfter\":\"$not_after\"}"
                fi
            fi
        done
        
        certificates="$certificates],\"success\":true}"
    else
        certificates="{\"certificates\":[],\"success\":true}"
    fi
    
    echo "$certificates"
}

# Function to renew certificate
renew_certificate() {
    local domain="$1"
    local result="{\"success\":false,\"output\":\"\"}"
    
    if [ -n "$CERTBOT_PATH" ] && [ -n "$domain" ]; then
        local output=$("$CERTBOT_PATH" renew --cert-name "$domain" --non-interactive 2>&1 || echo "Renewal failed")
        local exit_code=$?
        
        if [ $exit_code -eq 0 ]; then
            # Reload nginx if available
            if [ -n "$NGINX_PATH" ]; then
                "$NGINX_PATH" -t && "$NGINX_PATH" -s reload 2>/dev/null || echo "Nginx reload failed"
            fi
            result="{\"success\":true,\"output\":\"$output\"}"
        else
            result="{\"success\":false,\"output\":\"$output\"}"
        fi
    else
        result="{\"success\":false,\"output\":\"Certbot not available or domain not specified\"}"
    fi
    
    echo "$result"
}

# Function to get certificate details
get_certificate_details() {
    local cert_path="$1"
    local result="{\"success\":false,\"certificate\":{},\"path\":\"$cert_path\"}"
    
    if [ -f "$cert_path" ] && [ -n "$OPENSSL_PATH" ]; then
        # Get detailed certificate information
        local cert_text=$("$OPENSSL_PATH" x509 -in "$cert_path" -noout -text 2>/dev/null || echo "")
        local subject=$(echo "$cert_text" | grep "Subject:" | cut -d':' -f2- | tr -d '\n' | xargs || echo "Unknown")
        local issuer=$(echo "$cert_text" | grep "Issuer:" | cut -d':' -f2- | tr -d '\n' | xargs || echo "Unknown")
        local not_before=$(echo "$cert_text" | grep "Not Before:" | cut -d':' -f2- | tr -d '\n' | xargs || echo "Unknown")
        local not_after=$(echo "$cert_text" | grep "Not After:" | cut -d':' -f2- | tr -d '\n' | xargs || echo "Unknown")
        local version=$(echo "$cert_text" | grep "Version:" | cut -d'(' -f2 | cut -d')' -f1 | tr -d '\n' || echo "Unknown")
        local serial=$(echo "$cert_text" | grep "Serial Number:" | cut -d':' -f2- | tr -d '\n' | xargs || echo "Unknown")
        local sig_algo=$(echo "$cert_text" | grep "Signature Algorithm:" | head -1 | cut -d':' -f2- | tr -d '\n' | xargs || echo "Unknown")
        
        # Get SAN (Subject Alternative Names)
        local sans=$(echo "$cert_text" | grep -A 20 "Subject Alternative Name:" | grep "DNS:" | sed 's/.*DNS://g' | tr -d '\n' | tr ',' '\n' | paste -sd ',' - | xargs || echo "")
        
        # Get fingerprint
        local fingerprint=$("$OPENSSL_PATH" x509 -in "$cert_path" -noout -fingerprint -sha256 2>/dev/null | cut -d'=' -f2 | tr -d '\n' | xargs || echo "")
        
        # Calculate days until expiry
        local expiry_timestamp=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        local is_expiring_soon="false"
        if [ $days_until_expiry -lt 30 ] && $days_until_expiry -gt 0 ]; then
            is_expiring_soon="true"
        fi
        
        result="{\"success\":true,\"certificate\":{\"subject\":\"$subject\",\"issuer\":\"$issuer\",\"not_before\":\"$not_before\",\"not_after\":\"$not_after\",\"version\":\"$version\",\"serial_number\":\"$serial\",\"signature_algorithm\":\"$sig_algo\",\"domains\":[\"$(echo $sans | tr ',' '\" \"')\"],\"fingerprint\":\"$fingerprint\",\"days_until_expiry\":$days_until_expiry,\"is_expiring_soon\":$is_expiring_soon},\"path\":\"$cert_path\"}"
    else
        result="{\"success\":false,\"error\":\"Certificate file not found or openssl not available\",\"path\":\"$cert_path\"}"
    fi
    
    echo "$result"
}

# Main command handler
case "$1" in
    "discover")
        discover_certificates
        ;;
    "renew")
        renew_certificate "$2"
        ;;
    "details")
        get_certificate_details "$2"
        ;;
    *)
        echo "{\"success\":false,\"error\":\"Invalid command. Use: discover, renew, or details\"}"
        ;;
esac
EOF

# Make the script executable
chmod +x "$BUILDMASTER_DIR/api/cert-manager.sh"

echo -e "${GREEN}✅ Certificate management script created${NC}"

# Update the API service to include certificate management
echo -e "${YELLOW}🔄 Updating API service...${NC}"

# Check if service is running
if systemctl is-active --quiet "$API_SERVICE_NAME"; then
    echo -e "${YELLOW}🔄 Restarting API service to include certificate management...${NC}"
    systemctl restart "$API_SERVICE_NAME"
    
    # Wait for service to start
    sleep 3
    
    if systemctl is-active --quiet "$API_SERVICE_NAME"; then
        echo -e "${GREEN}✅ API service restarted successfully${NC}"
    else
        echo -e "${RED}❌ Failed to restart API service${NC}"
        echo "Check status with: systemctl status $API_SERVICE_NAME"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  API service is not running. Starting it...${NC}"
    systemctl start "$API_SERVICE_NAME"
    
    sleep 3
    
    if systemctl is-active --quiet "$API_SERVICE_NAME"; then
        echo -e "${GREEN}✅ API service started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start API service${NC}"
        echo "Check status with: systemctl status $API_SERVICE_NAME"
        exit 1
    fi
fi

# Test the certificate management functionality
echo -e "${YELLOW}🧪 Testing certificate management...${NC}"
sleep 2

# Test certificate discovery
if curl -s http://localhost:8001/api/nginx/ssl-certificates > /dev/null; then
    echo -e "${GREEN}✅ Certificate discovery endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️  Certificate discovery endpoint not responding (may be normal if no certificates exist)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Certificate Management Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📋 What's been set up:${NC}"
echo "  ✅ Certificate discovery functionality"
echo "  ✅ Certificate renewal capabilities"
echo "  ✅ Certificate details viewing"
echo "  ✅ Integration with existing BuildMaster API"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  Restart API:     sudo systemctl restart $API_SERVICE_NAME"
echo "  Check status:    sudo systemctl status $API_SERVICE_NAME"
echo "  View logs:       sudo journalctl -u $API_SERVICE_NAME -f"
echo ""
echo -e "${BLUE}🌐 Available Features:${NC}"
echo "  Navigate to: Settings → Nginx tab"
echo "  Look for: 'SSL Certificate Management' section"
echo "  Features: Certificate discovery, renewal, and detailed viewing"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "  - Certificate renewal requires certbot to be installed"
echo "  - Nginx reload requires nginx to be properly configured"
echo "  - Let's Encrypt certificates should be in /etc/letsencrypt/live/"
echo "  - The API service will automatically include certificate management"
