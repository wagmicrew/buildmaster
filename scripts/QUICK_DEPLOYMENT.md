# Quick Manual Deployment Guide

## 🚀 Deploy Updated Frontend to Ubuntu Server

### Step 1: On Your Windows Machine

1. **Build the frontend** (if not already built):
```powershell
cd web
npm run build
cd ..
```

2. **Copy files to Ubuntu server** (run in PowerShell):
```powershell
# Replace YOUR_SERVER_IP with your actual server IP
.\scripts\copy-to-ubuntu.ps1 -ServerIP "YOUR_SERVER_IP"
```

### Step 2: On Your Ubuntu Server

1. **Deploy the files**:
```bash
sudo bash /tmp/deploy-frontend-updates.sh
```

### Alternative: Manual Copy

If PowerShell script doesn't work, use manual commands:

**On Windows (in Git Bash or WSL):**
```bash
scp -r web/dist/* root@YOUR_SERVER_IP:/tmp/web/dist/
```

**On Ubuntu server:**
```bash
sudo bash /tmp/deploy-frontend-updates.sh
```

### Step 3: Access New Features

1. **Clear browser cache** (Ctrl+F5)
2. **Navigate to Settings → Certificates tab**
3. **Look for the Shield icon** in the sidebar

## 🎯 New Features You'll See

✅ **Dedicated "Certificates" tab** with Shield icon  
✅ **Enhanced certificate management interface**  
✅ **Individual certificate renewal**  
✅ **Certificate details modal**  
✅ **Expiry warnings**  
✅ **Status indicators**  

## 🔧 If Something Goes Wrong

### Frontend files not found error:
- Make sure you ran `npm run build` in the `web` directory
- Check that `web/dist/index.html` exists

### SSH/SCP issues:
- Ensure SSH key authentication is set up
- Verify server IP is correct
- Check firewall settings

### API not responding:
```bash
sudo systemctl restart build-dashboard-api
sudo systemctl status build-dashboard-api
```

### Rollback if needed:
```bash
# Find backup directory
ls /var/www/build/backup/

# Restore (replace with actual backup name)
sudo cp -r /var/www/build/backup/20260105_082321/* /var/www/build/web/dist/
sudo systemctl reload nginx
```

## 📋 Verification Commands

After deployment, run these to verify:

```bash
# Check API status
sudo systemctl status build-dashboard-api

# Test certificate endpoint
curl http://localhost:8001/api/nginx/ssl-certificates

# Check nginx
sudo nginx -t && sudo systemctl reload nginx
```
