# Build Dashboard Setup Instructions

## Overview
This build dashboard provides a web-based interface for managing deployments, builds, and server operations for TrafikskolaX.

## Prerequisites
- Ubuntu server with root/sudo access
- Python 3.9+ installed
- Node.js 18+ and pnpm installed
- Nginx installed and configured
- PM2 installed
- SSL certificate for build.dintrafikskolahlm.se (Let's Encrypt)

## Step 1: Create Directory Structure

```bash
sudo mkdir -p /var/www/build/{api,web,scripts,logs/builds,data}
sudo chown -R $USER:$USER /var/www/build
cd /var/www/build
```

## Step 2: Setup Python Backend

```bash
cd /var/www/build/api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Step 3: Setup React Frontend

```bash
cd /var/www/build/web
pnpm install
pnpm build
```

## Step 4: Configure Nginx

1. Copy the nginx config:
```bash
sudo cp Documentation_new/build-dashboard/nginx-config.conf /etc/nginx/sites-available/build.dintrafikskolahlm.se
```

2. Create symlink:
```bash
sudo ln -s /etc/nginx/sites-available/build.dintrafikskolahlm.se /etc/nginx/sites-enabled/
```

3. Get SSL certificate:
```bash
sudo certbot --nginx -d build.dintrafikskolahlm.se
```

4. Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Setup Systemd Service

```bash
sudo cp Documentation_new/build-dashboard/build-dashboard-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable build-dashboard-api
sudo systemctl start build-dashboard-api
```

## Step 6: Configure Environment Variables

Create `/var/www/build/api/.env`:
```env
BUILD_API_PORT=8889
OTP_SECRET_KEY=your-secret-key-here
SESSION_SECRET=your-session-secret-here
ALLOWED_EMAIL=johaswe@gmail.com
DEV_DIR=/var/www/dintrafikskolax_dev
PROD_DIR=/var/www/dintrafikskolax_prod
PM2_DEV_APP=dintrafikskolax-dev
PM2_PROD_APP=dintrafikskolax-prod
DATABASE_URL=postgresql://trafikskolaxv2_user:secure_password_123@localhost:5432/trafikskolaxv2
```

## Step 7: Test the Setup

1. Visit https://build.dintrafikskolahlm.se
2. Request OTP (will be sent to johaswe@gmail.com)
3. Verify OTP and login
4. Test git pull, build, and deploy operations

## Troubleshooting

### Check Python API logs:
```bash
sudo journalctl -u build-dashboard-api -f
```

### Check Nginx logs:
```bash
sudo tail -f /var/log/nginx/build-dashboard-error.log
```

### Restart services:
```bash
sudo systemctl restart build-dashboard-api
sudo systemctl reload nginx
```

