#!/bin/bash

# BuildMaster Management Script
# This script can be called from the BuildMaster settings to manage services

set -e

# Colors for output (when run interactively)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SERVICE_NAME="build-dashboard-api"
BUILDMASTER_DIR="/var/www/build"
LOG_FILE="/var/log/buildmaster-management.log"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log actions
log_action() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Function to show help
show_help() {
    echo "BuildMaster Management Script"
    echo "Usage: $0 {command}"
    echo ""
    echo "Commands:"
    echo "  restart-api    - Restart the BuildMaster API service"
    echo "  restart-nginx  - Restart nginx service"
    echo "  restart-all    - Restart both API and nginx"
    echo "  status         - Show service status"
    echo "  logs           - Show recent logs"
    echo "  cert-renew     - Renew all SSL certificates"
    echo "  cert-status    - Show certificate status"
    echo "  health-check   - Perform health check"
    echo ""
    echo "Examples:"
    echo "  $0 restart-api"
    echo "  $0 status"
    echo "  $0 cert-renew"
}

# Function to restart API service
restart_api() {
    echo "Restarting BuildMaster API..."
    log_action "API restart requested"
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
        sleep 2
    fi
    
    systemctl start "$SERVICE_NAME"
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✅ API restarted successfully"
        log_action "API restart successful"
        
        # Test API
        if curl -s http://localhost:8001/health > /dev/null; then
            echo "✅ API health check passed"
        else
            echo "⚠️  API health check failed"
        fi
    else
        echo "❌ Failed to restart API"
        log_action "API restart failed"
        exit 1
    fi
}

# Function to restart nginx
restart_nginx() {
    echo "Restarting nginx..."
    log_action "Nginx restart requested"
    
    if nginx -t; then
        systemctl reload nginx
        echo "✅ Nginx reloaded successfully"
        log_action "Nginx reload successful"
    else
        echo "❌ Nginx configuration error"
        log_action "Nginx reload failed - configuration error"
        exit 1
    fi
}

# Function to restart all services
restart_all() {
    echo "Restarting all BuildMaster services..."
    log_action "Full restart requested"
    
    restart_api
    restart_nginx
    
    echo "✅ All services restarted successfully"
    log_action "Full restart successful"
}

# Function to show status
show_status() {
    echo "BuildMaster Service Status"
    echo "=========================="
    
    # API Status
    echo -n "API Service: "
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "🟢 Active"
        echo "  PID: $(systemctl show -p MainPID --value "$SERVICE_NAME" 2>/dev/null || echo "N/A")"
        echo "  Memory: $(systemctl show -p MemoryCurrent --value "$SERVICE_NAME" 2>/dev/null || echo "N/A") bytes"
    else
        echo "🔴 Inactive"
    fi
    
    # Nginx Status
    echo -n "Nginx: "
    if systemctl is-active --quiet nginx; then
        echo "🟢 Active"
    else
        echo "🔴 Inactive"
    fi
    
    # Disk Usage
    echo "Disk Usage: $(df -h "$BUILDMASTER_DIR" | tail -1 | awk '{print $5}')"
    
    # Certificate Status (basic check)
    if [ -d "/etc/letsencrypt/live" ]; then
        cert_count=$(find /etc/letsencrypt/live -maxdepth 1 -type d -name "*" | wc -l)
        echo "SSL Certificates: $((cert_count - 1)) found"
    else
        echo "SSL Certificates: None found"
    fi
}

# Function to show logs
show_logs() {
    echo "Recent BuildMaster Logs"
    echo "======================"
    
    # API logs
    echo "API Service Logs (last 20 lines):"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    
    echo ""
    echo "Management Logs (last 10 lines):"
    tail -10 "$LOG_FILE" 2>/dev/null || echo "No management logs found"
}

# Function to renew certificates
renew_certificates() {
    echo "Renewing SSL certificates..."
    log_action "Certificate renewal requested"
    
    if command -v certbot &> /dev/null; then
        certbot_output=$(certbot renew --non-interactive 2>&1)
        certbot_exit=$?
        
        if [ $certbot_exit -eq 0 ]; then
            echo "✅ Certificates renewed successfully"
            log_action "Certificate renewal successful"
            
            # Reload nginx
            if nginx -t; then
                systemctl reload nginx
                echo "✅ Nginx reloaded"
            fi
        else
            echo "❌ Certificate renewal failed"
            echo "$certbot_output"
            log_action "Certificate renewal failed"
        fi
    else
        echo "❌ Certbot not installed"
        log_action "Certificate renewal failed - certbot not found"
    fi
}

# Function to show certificate status
show_certificate_status() {
    echo "SSL Certificate Status"
    echo "====================="
    
    if [ -d "/etc/letsencrypt/live" ]; then
        for cert_dir in /etc/letsencrypt/live/*; do
            if [ -d "$cert_dir" ]; then
                domain=$(basename "$cert_dir")
                cert_file="$cert_dir/fullchain.pem"
                
                if [ -f "$cert_file" ]; then
                    echo "Domain: $domain"
                    
                    # Get expiry date
                    if command -v openssl &> /dev/null; then
                        expiry=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d'=' -f2)
                        echo "  Expires: $expiry"
                        
                        # Calculate days until expiry
                        expiry_timestamp=$(date -d "$expiry" +%s 2>/dev/null || echo "0")
                        current_timestamp=$(date +%s)
                        days_until=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                        
                        if [ $days_until -lt 30 ]; then
                            echo "  Status: ⚠️  Expiring in $days_until days"
                        else
                            echo "  Status: ✅ Valid ($days_until days)"
                        fi
                    else
                        echo "  Status: Unable to check (openssl not available)"
                    fi
                    echo ""
                fi
            fi
        done
    else
        echo "No SSL certificates found"
    fi
}

# Function to perform health check
health_check() {
    echo "BuildMaster Health Check"
    echo "======================="
    
    # Check API
    echo -n "API Health: "
    if curl -s http://localhost:8001/health > /dev/null; then
        echo "✅ OK"
    else
        echo "❌ Failed"
    fi
    
    # Check nginx
    echo -n "Nginx Health: "
    if nginx -t > /dev/null 2>&1; then
        echo "✅ OK"
    else
        echo "❌ Configuration error"
    fi
    
    # Check disk space
    disk_usage=$(df "$BUILDMASTER_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    echo -n "Disk Space: "
    if [ "$disk_usage" -lt 80 ]; then
        echo "✅ $disk_usage% used"
    else
        echo "⚠️  $disk_usage% used (high)"
    fi
    
    # Check memory
    if [ -f "/proc/meminfo" ]; then
        available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        used_percent=$(( (total - available) * 100 / total ))
        
        echo -n "Memory: "
        if [ "$used_percent" -lt 80 ]; then
            echo "✅ $used_percent% used"
        else
            echo "⚠️  $used_percent% used (high)"
        fi
    fi
}

# Main command handler
case "$1" in
    "restart-api")
        restart_api
        ;;
    "restart-nginx")
        restart_nginx
        ;;
    "restart-all")
        restart_all
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "cert-renew")
        renew_certificates
        ;;
    "cert-status")
        show_certificate_status
        ;;
    "health-check")
        health_check
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for available commands"
        exit 1
        ;;
esac
