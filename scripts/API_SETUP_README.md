# BuildMaster API Service Setup

This directory contains scripts to set up and manage the BuildMaster API service on Unix/Linux systems.

## Files

- `setup-api-service.sh` - Full setup script (first time only)
- `api-manager.sh` - Easy management script for daily use

## Quick Start

### 1. First Time Setup

```bash
# Run the setup script (requires sudo)
sudo bash scripts/setup-api-service.sh
```

This will:
- Install Python dependencies
- Create systemd service
- Set proper permissions
- Start the service

### 2. Daily Management

```bash
# Make the management script executable
chmod +x scripts/api-manager.sh

# Restart the API service
./scripts/api-manager.sh restart

# Check service status
./scripts/api-manager.sh status

# View logs
./scripts/api-manager.sh logs

# Stop the service
./scripts/api-manager.sh stop

# Start the service
./scripts/api-manager.sh start
```

## Manual Commands

If you prefer to use systemctl directly:

```bash
# Restart service
sudo systemctl restart build-dashboard-api

# Check status
sudo systemctl status build-dashboard-api

# View logs
sudo journalctl -u build-dashboard-api -f

# Stop service
sudo systemctl stop build-dashboard-api

# Start service
sudo systemctl start build-dashboard-api
```

## Service Configuration

The service is configured with:
- **Name**: `build-dashboard-api`
- **User**: `www-data`
- **Port**: `8000`
- **Auto-restart**: Enabled
- **Logging**: systemd journald

## API Endpoints

Once running, the API will be available at:
- **Health**: `http://localhost:8000/health`
- **SSL Certificates**: `http://localhost:8000/api/nginx/ssl-certificates`
- **Certificate Renewal**: `http://localhost:8000/api/nginx/ssl-renew`
- **Certificate Details**: `http://localhost:8000/api/nginx/ssl-details`

## Troubleshooting

### Service Not Starting

```bash
# Check service status
sudo systemctl status build-dashboard-api

# View error logs
sudo journalctl -u build-dashboard-api -n 50

# Check if port is in use
sudo netstat -tlnp | grep :8000
```

### Permission Issues

```bash
# Fix permissions
sudo chown -R www-data:www-data /var/www/build
sudo chmod 755 /var/www/build/api
```

### Python Dependencies

```bash
# Reinstall dependencies
cd /var/www/build/api
sudo python3 -m pip install -r requirements.txt
```

### Firewall Issues

```bash
# Allow port 8000 through firewall
sudo ufw allow 8000
# or
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
```

## Nginx Configuration

Make sure your nginx configuration proxies requests to the API:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Certificate Management

After setting up the service, you can access the certificate management features:

1. Navigate to the BuildMaster dashboard
2. Go to Settings → Nginx tab
3. Look for "SSL Certificate Management" section
4. Use the renewal buttons to manage certificates

## Notes

- The service automatically restarts if it crashes
- Logs are managed by systemd journald
- The service runs as the `www-data` user for security
- Port 8000 must be open in your firewall
- Make sure `/var/www/build` exists and contains the API code
