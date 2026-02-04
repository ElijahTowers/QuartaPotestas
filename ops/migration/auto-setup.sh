#!/bin/bash

# Complete automated setup - Run this on Mac Mini
# cd ~/QuartaPotestas && bash <(curl -s https://raw.githubusercontent.com/ElijahTowers/QuartaPotestas/main/ops/migration/auto-setup.sh)

set -e

cd ~/QuartaPotestas

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Automated Setup - Quarta Potestas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Python setup
echo "🐍 Setting up Python environment..."
cd backend
if [ ! -d "venv" ]; then
    # Try Python 3.12 first (most compatible), then 3.11, then 3.13, then default
    if command -v python3.12 &> /dev/null; then
        python3.12 -m venv venv
        echo "✅ Virtual environment created with Python 3.12"
    elif command -v python3.11 &> /dev/null; then
        python3.11 -m venv venv
        echo "✅ Virtual environment created with Python 3.11"
    elif command -v python3.13 &> /dev/null; then
        python3.13 -m venv venv
        echo "✅ Virtual environment created with Python 3.13"
    else
        python3 -m venv venv
        echo "✅ Virtual environment created with default Python"
    fi
fi
source venv/bin/activate
pip install --upgrade pip -q
echo "   Installing Python packages (this may take a while)..."
pip install -r requirements.txt -q
echo "✅ Python dependencies installed"
cd ..
echo ""

# Node setup
echo "📦 Setting up Node.js dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "   Installing Node packages (this may take a while)..."
    npm install --silent
    echo "✅ Node.js dependencies installed"
else
    echo "✅ Node.js dependencies already installed"
fi
cd ..
echo ""

# PocketBase
echo "💾 Setting up PocketBase..."
cd backend
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    PB_ARCH="arm64"
else
    PB_ARCH="amd64"
fi

if [ ! -f "pocketbase" ] || [ ! -x "pocketbase" ]; then
    echo "   Downloading PocketBase for macOS ($PB_ARCH)..."
    curl -L -s "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_${PB_ARCH}.zip" -o pocketbase.zip
    unzip -q -o pocketbase.zip
    chmod +x pocketbase
    rm pocketbase.zip
    echo "✅ PocketBase downloaded"
else
    echo "✅ PocketBase already exists"
fi
cd ..
echo ""

# Create PM2 ecosystem if not exists
if [ ! -f "ecosystem.config.js" ]; then
    echo "⚙️  Creating PM2 configuration..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'pocketbase',
      script: './backend/pocketbase',
      args: 'serve',
      cwd: './backend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'backend',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      interpreter: './venv/bin/python',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    }
  ],
};
EOF
    echo "✅ PM2 configuration created"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Edit password:"
echo "   nano backend/.env"
echo "   # Set POCKETBASE_ADMIN_PASSWORD"
echo ""
echo "2. Start services:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "3. Check status:"
echo "   pm2 status"
echo "   pm2 logs"
echo ""

