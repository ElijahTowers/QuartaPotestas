#!/bin/bash

# Complete installation script for Mac Mini
# Run this directly on Mac Mini

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Quarta Potestas - Complete Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="$HOME/Projects/QuartaPotestas"

# Step 1: Clone repository
echo "📥 Cloning repository..."
mkdir -p ~/Projects
cd ~/Projects
if [ -d "QuartaPotestas" ]; then
    echo "   Repository exists, updating..."
    cd QuartaPotestas
    git pull origin main 2>&1 || echo "⚠️  Could not pull (continuing)"
else
    git clone https://github.com/ElijahTowers/QuartaPotestas.git
    cd QuartaPotestas
fi
echo "✅ Repository ready"
echo ""

# Step 2: Run setup script
echo "🔧 Running setup script..."
if [ -f "ops/migration/ONE_COMMAND_SETUP.sh" ]; then
    chmod +x ops/migration/ONE_COMMAND_SETUP.sh
    ./ops/migration/ONE_COMMAND_SETUP.sh
else
    echo "⚠️  Setup script not found, running basic setup..."
    
    # Basic Python setup
    cd backend
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    cd ..
    
    # Basic Node setup
    cd frontend
    npm install --silent
    cd ..
    
    # PocketBase
    cd backend
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        PB_ARCH="arm64"
    else
        PB_ARCH="amd64"
    fi
    if [ ! -f "pocketbase" ]; then
        curl -L -s "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_${PB_ARCH}.zip" -o pocketbase.zip
        unzip -q -o pocketbase.zip
        chmod +x pocketbase
        rm pocketbase.zip
    fi
    cd ..
    
    echo "✅ Basic setup complete"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo "1. Edit password: cd ~/Projects/QuartaPotestas && nano backend/.env"
echo "2. Start services: pm2 start ecosystem.config.js && pm2 save"
echo ""

