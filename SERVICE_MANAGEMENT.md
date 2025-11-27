# Build Dashboard Service Management

## Overview
The Build Dashboard API runs as a systemd service (`build-dashboard-api`) for reliable background operation, automatic restarts, and easy management.

## Service Details
- **Service Name**: `build-dashboard-api`
- **Port**: 8001
- **Host**: 0.0.0.0 (all interfaces)
- **Auto-start**: Enabled (starts on boot)
- **Auto-restart**: Yes (5 second delay on failure)
- **Working Directory**: `/var/www/build/api`

## Installation

### Initial Setup
The service is installed using the provided installation script:

```bash
# From local machine, copy files and install
scp -i "C:\Users\johs\.ssh\trafikskolaxv2_key" \
    build-dashboard-api.service \
    install-service.sh \
    root@dintrafikskolahlm.se:/tmp/

ssh -i "C:\Users\johs\.ssh\trafikskolaxv2_key" root@dintrafikskolahlm.se \
    "chmod +x /tmp/install-service.sh && /tmp/install-service.sh"
```

### Manual Installation Steps
If you need to install manually:

```bash
# 1. Stop any existing processes
pkill -9 -f "uvicorn main:app"

# 2. Copy service file
cp build-dashboard-api.service /etc/systemd/system/

# 3. Reload systemd
systemctl daemon-reload

# 4. Enable and start
systemctl enable build-dashboard-api
systemctl start build-dashboard-api

# 5. Verify
systemctl status build-dashboard-api
curl http://localhost:8001/health
```

## Daily Operations

### Basic Commands

```bash
# Start the service
systemctl start build-dashboard-api

# Stop the service
systemctl stop build-dashboard-api

# Restart the service (most common)
systemctl restart build-dashboard-api

# Check status
systemctl status build-dashboard-api

# Enable auto-start on boot
systemctl enable build-dashboard-api

# Disable auto-start
systemctl disable build-dashboard-api
```

### View Logs

```bash
# Follow logs in real-time (Ctrl+C to exit)
journalctl -u build-dashboard-api -f

# View last 50 lines
journalctl -u build-dashboard-api -n 50

# View logs since last hour
journalctl -u build-dashboard-api --since "1 hour ago"

# View logs for specific time range
journalctl -u build-dashboard-api --since "2025-11-27 09:00:00" --until "2025-11-27 10:00:00"
```

### Remote Commands (from local machine)

```bash
# Restart remotely
ssh -i "C:\Users\johs\.ssh\trafikskolaxv2_key" root@dintrafikskolahlm.se \
    "systemctl restart build-dashboard-api"

# Check status remotely
ssh -i "C:\Users\johs\.ssh\trafikskolaxv2_key" root@dintrafikskolahlm.se \
    "systemctl status build-dashboard-api"

# View logs remotely
ssh -i "C:\Users\johs\.ssh\trafikskolaxv2_key" root@dintrafikskolahlm.se \
    "journalctl -u build-dashboard-api -n 50"
```

## Git Pull Auto-Update Integration

When you perform a git pull that includes changes to the Build Dashboard:

1. **Detection**: `git_ops.py` detects files changed in `Documentation_new/build-dashboard/`
2. **User Prompt**: A dialog appears asking if you want to update
3. **Installation**: If you accept, `build_dashboard_ops.py` runs:
   - Backs up current installation
   - Copies API files
   - Builds frontend
   - Copies build output
   - **Restarts service**: `systemctl restart build-dashboard-api`
4. **Verification**: Checks service is active
5. **Redirect**: Logs you out and redirects to login

### Key Benefit
The systemd service ensures:
- ✅ Clean restart with proper shutdown
- ✅ Automatic recovery if something goes wrong
- ✅ Centralized logging
- ✅ No orphaned processes
- ✅ Consistent state management

## Troubleshooting

### Service Won't Start

```bash
# Check detailed error messages
systemctl status build-dashboard-api -l

# View recent logs
journalctl -u build-dashboard-api -n 100

# Check if port is already in use
lsof -i :8001

# Verify service file syntax
systemd-analyze verify /etc/systemd/system/build-dashboard-api.service
```

### Service Keeps Restarting

```bash
# Check restart counter
systemctl status build-dashboard-api | grep "restart counter"

# View crash logs
journalctl -u build-dashboard-api --since "10 minutes ago"

# Temporarily disable auto-restart for debugging
systemctl stop build-dashboard-api
# Then run manually to see errors:
cd /var/www/build/api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Update Service Configuration

After modifying `/etc/systemd/system/build-dashboard-api.service`:

```bash
# Reload systemd configuration
systemctl daemon-reload

# Restart service with new config
systemctl restart build-dashboard-api

# Verify changes
systemctl cat build-dashboard-api
```

## Health Check

```bash
# Local check
curl http://localhost:8001/health

# From external IP
curl http://dintrafikskolahlm.se:8001/health

# Expected response
{"status":"healthy"}
```

## Security Notes

- Service runs as `root` user (required for system operations)
- Listens on all interfaces (0.0.0.0) - ensure firewall rules are appropriate
- Logs contain sensitive information - restrict access to journal files
- Use HTTPS in production (see nginx-ssl-config.conf)

## Files

- **Service File**: `/etc/systemd/system/build-dashboard-api.service`
- **Working Directory**: `/var/www/build/api`
- **Log Location**: Systemd journal (use `journalctl`)
- **Install Script**: `install-service.sh`
- **Auto-Update Handler**: `api/build_dashboard_ops.py`

## Best Practices

1. **Always use systemctl commands** - Never use `pkill` or manual process management
2. **Check logs after restart** - Ensure service started correctly
3. **Test health endpoint** - Verify API is responding
4. **Monitor restart counter** - High restart count indicates issues
5. **Use systemd's auto-restart** - Don't implement your own restart logic

## Quick Reference Card

| Task | Command |
|------|---------|
| Restart | `systemctl restart build-dashboard-api` |
| Status | `systemctl status build-dashboard-api` |
| Logs | `journalctl -u build-dashboard-api -f` |
| Health | `curl localhost:8001/health` |
| Stop | `systemctl stop build-dashboard-api` |
| Start | `systemctl start build-dashboard-api` |

---

**Last Updated**: 2025-11-27
**Service Version**: 1.0
**Python Version**: Python 3.x
**Framework**: FastAPI + Uvicorn
