# Deploy Frontend to Ubuntu Server (PowerShell)
# Run this on your Windows machine to copy files to Ubuntu

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "root"
)

Write-Host "🚀 Copying Frontend Files to Ubuntu Server" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue

# Check if frontend is built
if (-not (Test-Path ".\web\dist")) {
    Write-Host "❌ Frontend not built. Please run 'npm run build' first:" -ForegroundColor Red
    Write-Host "   cd web && npm run build" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Frontend build found" -ForegroundColor Green
Write-Host "📋 Copying to ${Username}@${ServerIP}:/var/www/build/web/dist" -ForegroundColor Blue

# Check if scp is available
try {
    $null = Get-Command scp -ErrorAction Stop
} catch {
    Write-Host "❌ scp command not found. Please install OpenSSH or Git Bash" -ForegroundColor Red
    Write-Host "   - Install Git for Windows (includes scp)" -ForegroundColor Yellow
    Write-Host "   - Or use Windows OpenSSH client" -ForegroundColor Yellow
    exit 1
}

# Create temporary directory on server
Write-Host "📁 Creating temporary directory on server..." -ForegroundColor Yellow
ssh "${Username}@${ServerIP}" "mkdir -p /tmp/web/dist" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create directory on server. Check SSH connection." -ForegroundColor Red
    exit 1
}

# Copy frontend files
Write-Host "📋 Copying frontend files..." -ForegroundColor Yellow
scp -r ".\web\dist\*" "${Username}@${ServerIP}:/tmp/web/dist/" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to copy files to server" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Files copied to server" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Now run this on your Ubuntu server:" -ForegroundColor Blue
Write-Host "   sudo bash /tmp/deploy-frontend-updates.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Or copy and run this command:" -ForegroundColor Blue
Write-Host "   ssh ${Username}@${ServerIP} 'sudo bash /tmp/deploy-frontend-updates.sh'" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Ready to deploy!" -ForegroundColor Green
