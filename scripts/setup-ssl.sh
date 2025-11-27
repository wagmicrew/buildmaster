#!/bin/bash
# Setup SSL Certificate for Build Dashboard
# This script sets up nginx and obtains SSL certificate from Let's Encrypt

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔐 Build Dashboard SSL Setup${NC}"
echo -e "${CYAN}=============================${NC}"
echo ""

# Configuration
DOMAIN="build.dintrafikskolahlm.se"
NGINX_CONFIG="/etc/nginx/sites-available/build-dashboard"
NGINX_ENABLED="/etc/nginx/sites-enabled/build-dashboard"
CERTBOT_ROOT="/var/www/certbot"
EMAIL="info@dintrafikskolahlm.se"  # Update this!

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

# Step 1: Create certbot directory
echo -e "${YELLOW}📁 Step 1: Creating certbot directory...${NC}"
mkdir -p "$CERTBOT_ROOT"
chown -R www-data:www-data "$CERTBOT_ROOT"
echo -e "   ${GREEN}✅ Created: $CERTBOT_ROOT${NC}"
echo ""

# Step 2: Copy nginx config
echo -e "${YELLOW}📝 Step 2: Setting up nginx configuration...${NC}"
if [ -f "$NGINX_CONFIG" ]; then
    echo -e "   ${YELLOW}⚠️  Backing up existing config...${NC}"
    cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
fi

cp /var/www/build/nginx-ssl-config.conf "$NGINX_CONFIG"
echo -e "   ${GREEN}✅ Config copied to: $NGINX_CONFIG${NC}"
echo ""

# Step 3: Enable site
echo -e "${YELLOW}🔗 Step 3: Enabling site...${NC}"
if [ ! -L "$NGINX_ENABLED" ]; then
    ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
    echo -e "   ${GREEN}✅ Site enabled${NC}"
else
    echo -e "   ${GREEN}✅ Site already enabled${NC}"
fi
echo ""

# Step 4: Test nginx config
echo -e "${YELLOW}🧪 Step 4: Testing nginx configuration...${NC}"
if nginx -t; then
    echo -e "   ${GREEN}✅ Nginx config is valid${NC}"
else
    echo -e "   ${RED}❌ Nginx config has errors${NC}"
    exit 1
fi
echo ""

# Step 5: Reload nginx
echo -e "${YELLOW}🔄 Step 5: Reloading nginx...${NC}"
systemctl reload nginx
echo -e "   ${GREEN}✅ Nginx reloaded${NC}"
echo ""

# Step 6: Check if certbot is installed
echo -e "${YELLOW}📦 Step 6: Checking certbot installation...${NC}"
if ! command -v certbot &> /dev/null; then
    echo -e "   ${YELLOW}⚠️  Certbot not found. Installing...${NC}"
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
    echo -e "   ${GREEN}✅ Certbot installed${NC}"
else
    echo -e "   ${GREEN}✅ Certbot is installed${NC}"
fi
echo ""

# Step 7: Obtain SSL certificate
echo -e "${YELLOW}🔐 Step 7: Obtaining SSL certificate...${NC}"
echo -e "   ${CYAN}Domain: $DOMAIN${NC}"
echo -e "   ${CYAN}Email: $EMAIL${NC}"
echo ""

# Check if certificate already exists
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo -e "   ${YELLOW}⚠️  Certificate already exists${NC}"
    read -p "   Do you want to renew it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        certbot renew --cert-name "$DOMAIN"
    fi
else
    # Obtain new certificate
    certbot certonly \
        --webroot \
        --webroot-path="$CERTBOT_ROOT" \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

    if [ $? -eq 0 ]; then
        echo -e "   ${GREEN}✅ SSL certificate obtained${NC}"
    else
        echo -e "   ${RED}❌ Failed to obtain SSL certificate${NC}"
        echo -e "   ${YELLOW}Make sure:${NC}"
        echo -e "   1. DNS A record for $DOMAIN points to this server"
        echo -e "   2. Port 80 is open in firewall"
        echo -e "   3. Nginx is running and serving the domain"
        exit 1
    fi
fi
echo ""

# Step 8: Update nginx config to enable HTTPS
echo -e "${YELLOW}🔧 Step 8: Enabling HTTPS in nginx config...${NC}"

# Uncomment HTTPS server block and comment HTTP redirect
sed -i '
    # Uncomment HTTPS server block
    /^# server {$/,/^# }$/ {
        /^# server {$/,/^#     listen 443/ s/^# //
        /^#     ssl_/s/^# //
        /^#     add_header/s/^# //
        /^#     location/,/^#     }/ s/^# //
        /^# }$/s/^# //
    }
    # Comment out the temporary HTTP server (keep redirect)
    /^server {$/,/^}$/ {
        /listen 80/,/}/ {
            /location \/\.well-known/,/}/ !s/^/# /
        }
    }
' "$NGINX_CONFIG"

echo -e "   ${GREEN}✅ HTTPS enabled in config${NC}"
echo ""

# Step 9: Test and reload nginx again
echo -e "${YELLOW}🧪 Step 9: Testing updated nginx configuration...${NC}"
if nginx -t; then
    echo -e "   ${GREEN}✅ Nginx config is valid${NC}"
    systemctl reload nginx
    echo -e "   ${GREEN}✅ Nginx reloaded with HTTPS${NC}"
else
    echo -e "   ${RED}❌ Nginx config has errors${NC}"
    echo -e "   ${YELLOW}Restoring backup...${NC}"
    cp "${NGINX_CONFIG}.backup."* "$NGINX_CONFIG"
    systemctl reload nginx
    exit 1
fi
echo ""

# Step 10: Setup auto-renewal
echo -e "${YELLOW}⏰ Step 10: Setting up auto-renewal...${NC}"
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    echo -e "   ${GREEN}✅ Auto-renewal cron job added${NC}"
else
    echo -e "   ${GREEN}✅ Auto-renewal already configured${NC}"
fi
echo ""

# Final verification
echo -e "${CYAN}🔍 Verification:${NC}"
echo -e "   HTTP URL: http://$DOMAIN"
echo -e "   HTTPS URL: https://$DOMAIN"
echo ""
echo -e "${GREEN}✅ SSL Setup Complete!${NC}"
echo ""
echo -e "${CYAN}📝 Next steps:${NC}"
echo -e "   1. Test HTTP: curl http://$DOMAIN"
echo -e "   2. Test HTTPS: curl https://$DOMAIN"
echo -e "   3. Check certificate: certbot certificates"
echo -e "   4. Test auto-renewal: certbot renew --dry-run"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo -e "   - Update DNS A record to point to this server"
echo -e "   - Open ports 80 and 443 in firewall"
echo -e "   - Build and deploy the frontend: cd /var/www/build/web && npm run build"
echo ""
