#!/bin/bash
# -----------------------------------------------------------------------------
# AWS EC2 Free Tier Deployment Script (Amazon Linux 2023)
# Run this on your fresh EC2 instance as ec2-user.
# Usage: bash deploy.sh
# -----------------------------------------------------------------------------
set -e

APP_DIR="$HOME/hardware-ERP/hardware-erp"
FRONTEND_DIST="/var/www/hardware-erp/frontend/dist"
REPO_URL="https://github.com/amankeshri7542/hardware-ERP.git"

echo "=========================================="
echo " Hardware Store ERP — EC2 Deployment"
echo "=========================================="

# 1. System packages
echo "[1/10] Updating system & installing packages..."
sudo dnf update -y
sudo dnf install -y git nginx curl

# 2. Install & enable Redis (for BullMQ)
echo "[2/10] Setting up Redis..."
sudo dnf install -y redis6 || sudo dnf install -y redis
sudo systemctl start redis
sudo systemctl enable redis

# 3. Node.js 18 LTS
echo "[3/10] Installing Node.js 18..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
  sudo dnf install -y nodejs
fi
echo "Node $(node -v) / npm $(npm -v)"

# 4. Chromium for Puppeteer PDF generation
echo "[4/10] Installing Chromium..."
sudo dnf install -y chromium || sudo amazon-linux-extras install -y chromium

# 5. PM2 process manager
echo "[5/10] Installing PM2..."
sudo npm install -g pm2

# 6. Clone / pull code
echo "[6/10] Fetching code..."
if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$HOME/hardware-ERP"
else
  cd "$APP_DIR" && git pull origin main
fi

# 7. Backend setup
echo "[7/10] Setting up backend..."
cd "$APP_DIR/backend"
npm install --omit=dev

if [ ! -f .env ]; then
  echo ""
  echo "  WARNING: backend/.env not found!"
  echo "  Copy .env.example and fill in your RDS/Redis/JWT/AWS values."
  echo "  Then re-run this script or run: pm2 restart all"
  echo ""
fi

# 8. Frontend build
echo "[8/10] Building frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build
sudo mkdir -p "$FRONTEND_DIST"
sudo rm -rf "$FRONTEND_DIST"/*
sudo cp -r dist/* "$FRONTEND_DIST/"

# 9. Nginx
echo "[9/10] Configuring Nginx..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/conf.d/hardware-erp.conf
# Remove default server block if it conflicts
sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 10. PM2 — start API server + PDF worker
echo "[10/10] Starting application..."
cd "$APP_DIR/backend"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# Setup PM2 to start on reboot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

echo ""
echo "=========================================="
echo " Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Create backend/.env with your RDS/Redis/AWS credentials"
echo "  2. Run: pm2 restart all"
echo "  3. Open http://<your-ec2-public-ip> in browser"
echo "  4. Check logs: pm2 logs"
echo ""
