# BuildMaster - Universal Build Dashboard

A powerful web-based build and deployment dashboard for managing any Node.js/Next.js application. Provides a graphical interface for managing builds, deployments, PM2 processes, Nginx configuration, and server operations.

## Features

- **🔐 OTP Authentication**: Secure email-based OTP login
- **📊 Real-time Dashboard**: Monitor Dev and Prod environments
- **🔄 Git Operations**: Pull latest changes with conflict handling
- **🔨 Build Management**: Configure and monitor builds with real-time logs
- **🚀 One-click Deployment**: Deploy builds from dev to production (Go Live)
- **⚙️ Settings Management**: Configure paths, databases, PM2, Nginx from UI
- **📡 Auto-detection**: Reads config from .env files automatically
- **💚 Health Monitoring**: Server, database, Redis, and environment health
- **📦 PM2 Management**: Fork/Cluster mode, restart, memory limits
- **🌐 Nginx Configuration**: Manage sites and SSL settings

## Architecture

- **Backend**: FastAPI Python API (port 8889)
- **Frontend**: React + TypeScript + Tailwind CSS (port 443)
- **Authentication**: Email OTP with session tokens
- **Email**: SMTP integration for notifications
- **Storage**: JSON files for build status (can be upgraded to SQLite)

## Quick Start

### 1. Copy Files to Server

```bash
# On your local machine
scp -r Documentation_new/build-dashboard/* user@server:/var/www/build/
```

### 2. Run Setup Script

```bash
# On the server
cd /var/www/build
sudo bash scripts/setup.sh
```

### 3. Configure Nginx

```bash
# Copy nginx config
sudo cp Documentation_new/build-dashboard/nginx-config.conf /etc/nginx/sites-available/build.dintrafikskolahlm.se

# Create symlink
sudo ln -s /etc/nginx/sites-available/build.dintrafikskolahlm.se /etc/nginx/sites-enabled/

# Get SSL certificate
sudo certbot --nginx -d build.dintrafikskolahlm.se

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Start Services

```bash
# Start API service
sudo systemctl start build-dashboard-api
sudo systemctl status build-dashboard-api

# Check logs
sudo journalctl -u build-dashboard-api -f
```

### 5. Access Dashboard

Visit: `https://build.dintrafikskolahlm.se`

Login with OTP sent to `johaswe@gmail.com`

## Directory Structure

```
/var/www/build/
├── api/                    # FastAPI backend
│   ├── main.py            # Main FastAPI app
│   ├── auth.py            # OTP authentication
│   ├── git_ops.py         # Git operations
│   ├── pm2_ops.py         # PM2 management
│   ├── build_ops.py       # Build operations
│   ├── deploy_ops.py      # Deployment operations
│   ├── health.py          # Health checks
│   ├── email_service.py   # Email notifications
│   ├── config.py          # Configuration
│   ├── models.py          # Pydantic models
│   ├── requirements.txt   # Python dependencies
│   └── venv/              # Python virtual environment
├── web/                    # React frontend
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   └── services/     # API client
│   ├── build/            # Built frontend (served by Nginx)
│   └── package.json
├── scripts/
│   ├── build-wrapper.sh  # Build wrapper script
│   └── setup.sh          # Setup script
├── logs/
│   └── builds/          # Build log files
└── data/
    └── *.json           # Build status files
```

## Configuration

### Environment Variables

Edit `/var/www/build/api/.env`:

```env
BUILD_API_PORT=8889
BUILD_API_HOST=127.0.0.1
OTP_SECRET_KEY=your-secret-key
SESSION_SECRET=your-session-secret
ALLOWED_EMAIL=johaswe@gmail.com
DEV_DIR=/var/www/dintrafikskolax_dev
PROD_DIR=/var/www/dintrafikskolax_prod
PM2_DEV_APP=dintrafikskolax-dev
PM2_PROD_APP=dintrafikskolax-prod
```

### SMTP Configuration

The email service will use server SMTP settings. Configure in:
- Environment variables (`SMTP_HOST`, `SMTP_PORT`, etc.)
- Or database `site_settings` table (future enhancement)

## API Endpoints

### Authentication
- `POST /api/auth/request-otp` - Request OTP
- `POST /api/auth/verify-otp` - Verify OTP and get session

### Git Operations
- `POST /api/git/pull` - Pull from git

### PM2 Operations
- `POST /api/pm2/dev/reload` - Reload dev server

### Build Operations
- `POST /api/build/start` - Start a build
- `GET /api/build/status/{build_id}` - Get build status
- `GET /api/build/logs/{build_id}` - Get build logs
- `GET /api/build/history` - Get build history

### Deployment
- `POST /api/deploy/golive` - Deploy to production

### Health Checks
- `GET /api/health/server` - Server health
- `GET /api/health/database` - Database health
- `GET /api/health/redis` - Redis health
- `GET /api/health/environment` - Environment health

## Usage

### Workflow

1. **Pull from Git**: Pull latest changes from repository
2. **Reload Dev Server**: Restart dev PM2 process to test changes
3. **Build**: Configure and start a build
4. **Go Live**: Deploy build to production

### Build Configuration

- **Build Mode**: Quick, Full, or RAM Optimized
- **Workers**: Number of parallel workers (0 = auto)
- **Memory Settings**: Max old space size, semi space size
- **Options**: Test database/Redis, skip deps, force clean

## Troubleshooting

### API Not Starting

```bash
# Check service status
sudo systemctl status build-dashboard-api

# Check logs
sudo journalctl -u build-dashboard-api -n 50

# Check Python environment
cd /var/www/build/api
source venv/bin/activate
python -c "import fastapi; print('OK')"
```

### Frontend Not Loading

```bash
# Check Nginx config
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/build-dashboard-error.log

# Rebuild frontend
cd /var/www/build/web
pnpm build
```

### Build Failures

- Check build logs in `/var/www/build/logs/builds/`
- Verify PM2 processes are running: `pm2 list`
- Check disk space: `df -h`
- Check memory: `free -h`

## Security

- OTP expires after 10 minutes
- Session tokens expire after 24 hours
- Rate limiting: Max 3 OTP requests per 15 minutes
- All API endpoints require authentication (except `/health`)
- HTTPS required for production

## Development

### Backend Development

```bash
cd /var/www/build/api
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8889
```

### Frontend Development

```bash
cd /var/www/build/web
pnpm dev
```

## License

Internal use only - TrafikskolaX

