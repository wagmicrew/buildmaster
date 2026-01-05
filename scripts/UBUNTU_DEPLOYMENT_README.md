# BuildMaster Ubuntu Deployment with Certificate Management

This guide provides complete Ubuntu deployment scripts for BuildMaster with SSL certificate management functionality.

## 📁 Files Overview

### Installation Scripts
- **`install-buildmaster-complete.sh`** - Complete fresh installation with all dependencies
- **`setup-cert-management.sh`** - Add certificate management to existing BuildMaster
- **`install-service.sh`** - Install/upgrade systemd service only

### Management Scripts
- **`buildmaster-manager.sh`** - Daily management commands (restart, status, logs, certificates)
- **`restart-api.sh`** - Safe API restart with logging
- **`api-manager.sh`** - Simple API management interface

## 🚀 Quick Start

### Option 1: Fresh Installation
```bash
# Download and run complete installation
sudo bash install-buildmaster-complete.sh
```

### Option 2: Add Certificate Management to Existing BuildMaster
```bash
# Add certificate management to existing installation
sudo bash setup-cert-management.sh
```

### Option 3: Manual Restart (if certificate features not visible)
```bash
# Restart API to pick up new certificate features
sudo bash restart-api.sh
```

## 📋 Installation Requirements

### System Requirements
- Ubuntu 18.04+ or Debian 10+
- Root/sudo access
- Internet connection
- Minimum 2GB RAM, 10GB disk space

### Software Dependencies (auto-installed)
- Python 3.8+
- Node.js 18+
- Nginx
- OpenSSL
- Certbot (for SSL certificates)
- Systemd

## 🔧 Management Commands

### Using the Management Script
```bash
# Make executable
chmod +x scripts/buildmaster-manager.sh

# Restart API service
sudo ./scripts/buildmaster-manager.sh restart-api

# Check service status
sudo ./scripts/buildmaster-manager.sh status

# View logs
sudo ./scripts/buildmaster-manager.sh logs

# Renew SSL certificates
sudo ./scripts/buildmaster-manager.sh cert-renew

# Check certificate status
sudo ./scripts/buildmaster-manager.sh cert-status

# Health check
sudo ./scripts/buildmaster-manager.sh health-check

# Restart all services
sudo ./scripts/buildmaster-manager.sh restart-all
```

### Direct Systemd Commands
```bash
# Restart API service
sudo systemctl restart build-dashboard-api

# Check status
sudo systemctl status build-dashboard-api

# View logs
sudo journalctl -u build-dashboard-api -f

# Restart nginx
sudo systemctl reload nginx
```

## 🔐 Certificate Management Features

### Available Features
- **Certificate Discovery** - Automatically find Let's Encrypt certificates
- **Certificate Renewal** - Renew individual or all certificates
- **Certificate Details** - View detailed certificate information
- **Expiry Monitoring** - Track certificate expiration dates
- **Nginx Integration** - Automatic nginx reload after renewal

### Web Interface Access
1. Navigate to BuildMaster dashboard
2. Go to **Settings → Nginx tab**
3. Look for **"SSL Certificate Management"** section
4. Features available:
   - Refresh certificate list
   - Renew all certificates
   - View individual certificate details
   - Renew specific certificates

### API Endpoints
```
GET  /api/nginx/ssl-certificates  - Discover certificates
POST /api/nginx/ssl-renew         - Renew certificates
GET  /api/nginx/ssl-details       - Get certificate details
```

## 📁 Directory Structure

After installation, your BuildMaster will be structured as:
```
/var/www/build/
├── api/
│   ├── main.py                 # FastAPI application
│   ├── cert-manager.sh         # Certificate management helper
│   ├── requirements.txt        # Python dependencies
│   └── venv/                   # Python virtual environment
├── web/
│   ├── dist/                   # Built frontend
│   ├── src/                    # Frontend source
│   └── package.json           # Node.js dependencies
└── scripts/                    # Management scripts
    ├── buildmaster-manager.sh
    ├── restart-api.sh
    └── setup-cert-management.sh
```

## 🔧 Configuration

### API Configuration
- **Port**: 8001 (configurable in service file)
- **Host**: 127.0.0.1 (behind nginx proxy)
- **User**: www-data (for security)

### Nginx Configuration
- **Frontend**: Serves from `/var/www/build/web/dist`
- **API Proxy**: Routes `/api/*` to port 8001
- **SSL**: Configured for Let's Encrypt certificates

### Certificate Paths
- **Certificates**: `/etc/letsencrypt/live/DOMAIN/fullchain.pem`
- **Private Keys**: `/etc/letsencrypt/live/DOMAIN/privkey.pem`

## 🚨 Troubleshooting

### Common Issues

#### Certificate Management Not Visible
```bash
# Restart API to pick up new features
sudo bash scripts/restart-api.sh

# Check if API is running
sudo systemctl status build-dashboard-api

# Check API logs
sudo journalctl -u build-dashboard-api -f
```

#### Certificate Renewal Fails
```bash
# Check certbot installation
which certbot

# Test certbot manually
sudo certbot renew --dry-run

# Check nginx configuration
sudo nginx -t
```

#### API Not Responding
```bash
# Check service status
sudo systemctl status build-dashboard-api

# Restart service
sudo systemctl restart build-dashboard-api

# Check port availability
sudo netstat -tlnp | grep :8001
```

#### Permission Issues
```bash
# Fix permissions
sudo chown -R www-data:www-data /var/www/build
sudo chmod -R 755 /var/www/build
```

### Log Locations
- **API Service**: `journalctl -u build-dashboard-api -f`
- **Nginx**: `/var/log/nginx/error.log`
- **Management**: `/var/log/buildmaster-management.log`

### Health Checks
```bash
# API health
curl http://localhost:8001/health

# Full health check
sudo ./scripts/buildmaster-manager.sh health-check
```

## 🔄 Updates and Maintenance

### Update BuildMaster
```bash
# Pull latest code
cd /var/www/build
git pull

# Rebuild frontend
cd web && npm run build

# Restart API
sudo systemctl restart build-dashboard-api
```

### Update Dependencies
```bash
# Python dependencies
cd /var/www/build/api
source venv/bin/activate
pip install -r requirements.txt

# Node.js dependencies
cd /var/www/build/web
npm install
npm run build
```

### Backup Configuration
```bash
# Backup configuration files
sudo cp -r /etc/nginx/sites-available/buildmaster /backup/
sudo cp /etc/systemd/system/build-dashboard-api.service /backup/
sudo cp -var/www/build/api/settings.example.json /backup/
```

## 🌐 SSL Certificate Setup

### Initial Certificate Setup
```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Manual Certificate Renewal
```bash
# Via web interface or API
curl -X POST http://localhost:8001/api/nginx/ssl-renew

# Via management script
sudo ./scripts/buildmaster-manager.sh cert-renew

# Direct certbot
sudo certbot renew
```

## 📞 Support

### Getting Help
1. Check logs: `sudo journalctl -u build-dashboard-api -f`
2. Run health check: `sudo ./scripts/buildmaster-manager.sh health-check`
3. Check status: `sudo ./scripts/buildmaster-manager.sh status`

### Common Solutions
- **Restart API**: Most issues fixed with API restart
- **Check permissions**: Ensure www-data ownership
- **Verify nginx**: Test nginx configuration
- **Clear browser cache**: Hard refresh (Ctrl+F5)

## 🎯 Next Steps After Installation

1. **Configure Domain**: Update nginx server_name
2. **Setup SSL**: Obtain Let's Encrypt certificates
3. **Test Certificate Management**: Navigate to Settings → Nginx
4. **Configure Monitoring**: Set up log monitoring
5. **Backup Configuration**: Save important config files
6. **Schedule Maintenance**: Set up automatic certificate renewal checks
