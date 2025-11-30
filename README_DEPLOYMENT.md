# BuildMaster Server Deployment Guide

This guide covers deploying BuildMaster to a production server.

## Prerequisites

### System Requirements
- Ubuntu 20.04+ or CentOS 8+
- Python 3.8+
- Node.js 18+
- Nginx
- PM2
- Git

### Install Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3 python3-pip nodejs npm nginx git

# CentOS/RHEL
sudo yum install -y python3 python3-pip nodejs npm nginx git
```

### Install PM2
```bash
sudo npm install -g pm2
```

## Quick Deployment

1. **Copy files to server**
```bash
scp -r buildmaster/ user@your-server:/var/www/
```

2. **Run deployment script**
```bash
sudo bash /var/www/buildmaster/deploy.sh
```

3. **Configure domain**
```bash
sudo nano /etc/nginx/sites-available/buildmaster.conf
# Update server_name to your domain
sudo nginx -t && sudo systemctl reload nginx
```

## Manual Deployment Steps

### 1. Directory Structure
```
/var/www/buildmaster/
├── api/                    # Backend API
├── web/                    # Frontend build
├── nginx/                  # Nginx config
└── logs/                   # Application logs
```

### 2. Backend Setup

```bash
cd /var/www/buildmaster/api

# Install Python dependencies
pip3 install -r requirements.txt --system-site-packages

# Configure environment
cp .env.production .env
nano .env  # Update secrets and paths

# Start with PM2
pm2 start pm2.config.js --env production
pm2 save
```

### 3. Frontend Build

```bash
cd /var/www/buildmaster/web

# Install dependencies
npm ci --production

# Build for production
npm run build

# Test preview server (optional)
npm run preview
```

### 4. Nginx Configuration

```bash
# Copy config
sudo cp nginx/buildmaster.conf /etc/nginx/sites-available/

# Enable site
sudo ln -s /etc/nginx/sites-available/buildmaster.conf /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Configuration

### Environment Variables (.env)

```bash
# API Configuration
BUILD_API_HOST=0.0.0.0
BUILD_API_PORT=8889

# Security (generate new secrets)
OTP_SECRET_KEY=your-production-secret
SESSION_SECRET=your-production-secret
ALLOWED_EMAIL=your-email@domain.com

# Project paths
DEV_DIR=/var/www/dintrafikskolax_dev
PROD_DIR=/var/www/dintrafikskolax_prod
```

### Nginx Configuration

Update `server_name` in `/etc/nginx/sites-available/buildmaster.conf`:
```nginx
server_name buildmaster.yourdomain.com;
```

## SSL/HTTPS Setup (Optional)

1. **Get SSL certificate**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d buildmaster.yourdomain.com
```

2. **Enable HTTPS in nginx**
Uncomment the HTTPS section in `nginx/buildmaster.conf`

## Monitoring

### PM2 Commands
```bash
pm2 status                    # Show process status
pm2 logs buildmaster-api      # View logs
pm2 restart buildmaster-api   # Restart API
pm2 monit                     # Monitor dashboard
```

### Log Files
- API logs: `/var/www/build/logs/buildmaster-api-*.log`
- Nginx logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### Health Checks
```bash
# API health
curl http://localhost:8889/health

# Full application
curl http://your-domain/health
```

## Troubleshooting

### Common Issues

1. **API not responding**
```bash
pm2 status          # Check if API is running
pm2 logs api        # Check for errors
sudo netstat -tlnp | grep 8889  # Check port
```

2. **Frontend not loading**
```bash
sudo nginx -t       # Test nginx config
sudo systemctl status nginx
ls -la /var/www/buildmaster/web/build/  # Check build files
```

3. **Permission issues**
```bash
sudo chown -R www-data:www-data /var/www/buildmaster
sudo chmod -R 755 /var/www/buildmaster
```

### Port Conflicts
Default ports:
- Frontend: 80 (Nginx)
- API: 8889 (internal)

### Firewall
```bash
# Ubuntu (UFW)
sudo ufw allow 80
sudo ufw allow 443  # if using HTTPS

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Updates

To update BuildMaster:
```bash
cd /var/www/buildmaster
git pull
sudo bash deploy.sh
```

## Security Recommendations

1. **Generate strong secrets** for OTP_SECRET_KEY and SESSION_SECRET
2. **Use HTTPS** with SSL certificates
3. **Configure firewall** to only allow necessary ports
4. **Regular updates** of system packages
5. **Monitor logs** for suspicious activity
6. **Backup configuration** and data regularly

## Performance Optimization

1. **Enable gzip compression** (included in nginx config)
2. **Set up CDN** for static assets
3. **Configure caching** headers
4. **Monitor memory usage** with PM2
5. **Use Redis** for session storage (if needed)

## Support

For issues:
1. Check logs: `pm2 logs buildmaster-api`
2. Verify configuration: `nginx -t`
3. Check system resources: `htop`, `df -h`
4. Review this guide and documentation
