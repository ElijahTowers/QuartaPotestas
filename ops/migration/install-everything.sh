#!/bin/bash

# Complete installation script - Download and run this on Mac Mini
# curl -fsSL https://raw.githubusercontent.com/ElijahTowers/QuartaPotestas/main/ops/migration/install-everything.sh | bash

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
    git pull origin main || echo "⚠️  Could not pull"
else
    git clone https://github.com/ElijahTowers/QuartaPotestas.git
    cd QuartaPotestas
fi
echo "✅ Repository ready"
echo ""

# Step 2: Run setup script
echo "🔧 Running setup script..."
chmod +x ops/migration/ONE_COMMAND_SETUP.sh
./ops/migration/ONE_COMMAND_SETUP.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo "1. Edit password: nano backend/.env"
echo "2. Start services: pm2 start ecosystem.config.js && pm2 save"
echo ""

