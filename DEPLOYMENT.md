# Build Dashboard Deployment Guide

## Prerequisites

- Ubuntu server with root/sudo access
- Python 3.9+ installed
- Node.js 18+ and pnpm installed
- Nginx installed and configured
- PM2 installed
- SSL certificate for build.dintrafikskolahlm.se (Let's Encrypt)

## Step-by-Step Deployment

### 1. Transfer Files to Server

From your local machine:

```bash
# Copy all files to server
scp -r Documentation_new/build-dashboard/* user@server:/tmp/build-dashboard/

# SSH into server
ssh user@server
```

### 2. Create Directory Structure

On the server:

```bash
sudo mkdir -p /var/www/build/{api,web,scripts,logs/builds,data}
sudo chown -R $USER:$USER /var/www/build
cd /var/www/build
```

### 3. Copy Files

```bash
# Copy files from temp location
sudo cp -r /tmp/build-dashboard/* /var/www/build/

# Or if files are already in Documentation_new/build-dashboard on server:
sudo cp -r Documentation_new/build-dashboard/* /var/www/build/
```

### 4. Setup Python Backend

```bash
cd /var/www/build/api

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
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
```

### 5. Setup React Frontend

```bash
cd /var/www/build/web

# Install dependencies
pnpm install  # or npm install

# Build frontend
pnpm build  # or npm run build
```

### 6. Configure Nginx

```bash
# Copy nginx config
sudo cp /var/www/build/nginx-config.conf /etc/nginx/sites-available/build.dintrafikskolahlm.se

# Edit if needed (update paths, etc.)
sudo nano /etc/nginx/sites-available/build.dintrafikskolahlm.se

# Create symlink
sudo ln -s /etc/nginx/sites-available/build.dintrafikskolahlm.se /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d build.dintrafikskolahlm.se

# Reload nginx
sudo systemctl reload nginx
```

### 7. Setup Systemd Service

```bash
# Copy service file
sudo cp /var/www/build/build-dashboard-api.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable build-dashboard-api

# Start service
sudo systemctl start build-dashboard-api

# Check status
sudo systemctl status build-dashboard-api
```

### 8. Set Permissions

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/build

# Set permissions
sudo chmod +x /var/www/build/scripts/*.sh
sudo chmod 755 /var/www/build/api
sudo chmod 755 /var/www/build/web
```

### 9. Verify Installation

```bash
# Check API is running
curl http://127.0.0.1:8889/health

# Check API logs
sudo journalctl -u build-dashboard-api -n 50

# Check Nginx logs
sudo tail -f /var/log/nginx/build-dashboard-error.log
```

### 10. Access Dashboard

Visit: `https://build.dintrafikskolahlm.se`

You should see the login page. Request an OTP to `johaswe@gmail.com`.

## Post-Deployment

### Update SMTP Settings (Optional)

If you need to configure SMTP settings, edit `/var/www/build/api/.env`:

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=noreply@dintrafikskolahlm.se
SMTP_FROM_NAME=Build Dashboard
```

Or configure in the database `site_settings` table (future enhancement).

### Update Database URL (Optional)

If you want database health checks:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

## Troubleshooting

### API Won't Start

```bash
# Check Python environment
cd /var/www/build/api
source venv/bin/activate
python -c "import fastapi; print('OK')"

# Check service logs
sudo journalctl -u build-dashboard-api -f

# Check if port is in use
sudo netstat -tlnp | grep 8889
```

### Frontend Not Loading

```bash
# Check if build directory exists
ls -la /var/www/build/web/build

# Rebuild frontend
cd /var/www/build/web
pnpm build

# Check Nginx config
sudo nginx -t
sudo tail -f /var/log/nginx/build-dashboard-error.log
```

### OTP Not Sending

```bash
# Check email service logs
sudo journalctl -u build-dashboard-api | grep -i email

# Test SMTP connection
cd /var/www/build/api
source venv/bin/activate
python -c "from email_service import test_connection; test_connection()"
```

### Build Failures

```bash
# Check build logs
ls -la /var/www/build/logs/builds/

# Check PM2 status
pm2 list

# Check disk space
df -h

# Check memory
free -h
```

## Maintenance

### Update Frontend

```bash
cd /var/www/build/web
git pull  # if using git
pnpm install
pnpm build
```

### Update Backend

```bash
cd /var/www/build/api
source venv/bin/activate
pip install -r requirements.txt --upgrade
sudo systemctl restart build-dashboard-api
```

### Backup

```bash
# Backup build data
tar -czf build-dashboard-backup-$(date +%Y%m%d).tar.gz \
  /var/www/build/data \
  /var/www/build/logs
```

## Security Checklist

- [ ] SSL certificate installed and valid
- [ ] `.env` file has secure random secrets
- [ ] File permissions set correctly (www-data user)
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Rate limiting enabled in Nginx
- [ ] OTP expiry set appropriately
- [ ] Session tokens expire after reasonable time
- [ ] Logs don't contain sensitive information

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u build-dashboard-api`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/build-dashboard-error.log`
3. Verify all services are running: `pm2 list`, `systemctl status build-dashboard-api`

