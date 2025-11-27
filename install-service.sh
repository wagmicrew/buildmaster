#!/bin/bash
# Install Build Dashboard API as systemd service

echo "=== Installing Build Dashboard API Service ==="

# 1. Stop any running uvicorn processes
echo "1. Stopping existing uvicorn processes..."
pkill -9 -f "uvicorn main:app" || true
sleep 1

# 2. Install service file
echo "2. Installing service file..."
cp /tmp/build-dashboard-api.service /etc/systemd/system/
chmod 644 /etc/systemd/system/build-dashboard-api.service

# 3. Reload systemd
echo "3. Reloading systemd daemon..."
systemctl daemon-reload

# 4. Enable service
echo "4. Enabling service..."
systemctl enable build-dashboard-api

# 5. Start service
echo "5. Starting service..."
systemctl start build-dashboard-api

# 6. Wait a moment
sleep 3

# 7. Check status
echo "6. Checking service status..."
systemctl status build-dashboard-api --no-pager

# 8. Test API
echo ""
echo "7. Testing API endpoint..."
curl -s http://localhost:8001/health

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Service management commands:"
echo "  - Restart:  systemctl restart build-dashboard-api"
echo "  - Stop:     systemctl stop build-dashboard-api"
echo "  - Status:   systemctl status build-dashboard-api"
echo "  - Logs:     journalctl -u build-dashboard-api -f"
