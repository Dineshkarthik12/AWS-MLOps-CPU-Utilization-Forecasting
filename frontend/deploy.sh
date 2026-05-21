#!/bin/bash
# ═══════════════════════════════════════════════════
# PowerForecast Frontend — EC2 Deployment Script
# ═══════════════════════════════════════════════════
# Run this script on your EC2 instance to deploy the
# frontend with Nginx as a reverse proxy.
#
# Usage:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
# ═══════════════════════════════════════════════════

set -e

echo "══════════════════════════════════════════"
echo "  PowerForecast Frontend Deployment"
echo "══════════════════════════════════════════"

# ── Step 1: Install Nginx ──
echo ""
echo "[1/4] Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y nginx
    echo "  ✓ Nginx installed"
else
    echo "  ✓ Nginx already installed"
fi

# ── Step 2: Copy frontend files ──
echo ""
echo "[2/4] Copying frontend files..."
sudo mkdir -p /var/www/powerforecast
sudo cp index.html style.css script.js /var/www/powerforecast/
sudo chown -R www-data:www-data /var/www/powerforecast
echo "  ✓ Files copied to /var/www/powerforecast"

# ── Step 3: Configure Nginx ──
echo ""
echo "[3/4] Configuring Nginx..."
sudo cp nginx.conf /etc/nginx/sites-available/powerforecast
sudo ln -sf /etc/nginx/sites-available/powerforecast /etc/nginx/sites-enabled/powerforecast
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t
echo "  ✓ Nginx configured"

# ── Step 4: Restart Nginx ──
echo ""
echo "[4/4] Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx
echo "  ✓ Nginx started"

# ── Done ──
echo ""
echo "══════════════════════════════════════════"
echo "  ✓ Deployment Complete!"
echo ""
echo "  Frontend:     http://$(curl -s ifconfig.me)"
echo "  Upload API:   http://$(curl -s ifconfig.me)/api/upload/docs"
echo "  Forecast API: http://$(curl -s ifconfig.me)/api/forecast/docs"
echo "══════════════════════════════════════════"
