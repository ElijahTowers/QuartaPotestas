#!/bin/bash

# Setup script to run ON the Mac Mini
# This sets up Quarta Potestas after the project has been transferred

set -e

PROJECT_ROOT="$HOME/Projects/QuartaPotestas"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Quarta Potestas Setup on Mac Mini"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if project directory exists
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "❌ Project directory not found: $PROJECT_ROOT"
    echo ""
    echo "Please either:"
    echo "1. Clone from GitHub:"
    echo "   cd ~/Projects && git clone https://github.com/ElijahTowers/QuartaPotestas.git"
    echo ""
    echo "2. Or transfer files manually from your other machine"
    exit 1
fi

cd "$PROJECT_ROOT"

# Check if it's a git repo
if [ ! -d ".git" ]; then
    echo "⚠️  Not a git repository. Initializing..."
    git init
    git remote add origin https://github.com/ElijahTowers/QuartaPotestas.git || true
    git fetch
    git checkout main || git checkout -b main
fi

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main || echo "⚠️  Could not pull (may need to set up git config)"
echo ""

# Setup Python environment
echo "🐍 Setting up Python environment..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

source venv/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo "✅ Python dependencies installed"
else
    echo "⚠️  requirements.txt not found"
fi
cd ..
echo ""

# Setup Node.js dependencies
echo "📦 Setting up Node.js dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
    echo "✅ Node.js dependencies installed"
else
    echo "✅ Node.js dependencies already installed"
fi
cd ..
echo ""

# Download PocketBase for macOS
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
    curl -L "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_${PB_ARCH}.zip" -o pocketbase.zip
    unzip -o pocketbase.zip
    chmod +x pocketbase
    rm pocketbase.zip
    echo "✅ PocketBase downloaded"
else
    echo "✅ PocketBase already exists"
fi
cd ..
echo ""

# Check for migration backup
if [ -d "migration-backup" ]; then
    echo "📥 Restoring from migration backup..."
    
    # Restore PocketBase data
    if [ -d "migration-backup/pb_data" ]; then
        echo "   Restoring PocketBase data..."
        if [ -d "backend/pb_data" ]; then
            mv backend/pb_data "backend/pb_data.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        cp -r migration-backup/pb_data backend/
        echo "✅ PocketBase data restored"
    fi
    
    # Restore .env files
    echo "   Restoring environment files..."
    find migration-backup -name ".env*" -type f | while read -r env_file; do
        RELATIVE_PATH=$(echo "$env_file" | sed "s|^migration-backup/||")
        TARGET_PATH="$RELATIVE_PATH"
        if [ -f "$TARGET_PATH" ]; then
            cp "$TARGET_PATH" "$TARGET_PATH.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        mkdir -p "$(dirname "$TARGET_PATH")"
        cp "$env_file" "$TARGET_PATH"
        echo "   ✅ Restored: $RELATIVE_PATH"
    done
    
    # Restore Cloudflare tunnel config
    if [ -d "migration-backup/tunnel" ]; then
        echo "   Restoring Cloudflare tunnel config..."
        if [ -d "ops/tunnel" ]; then
            mv ops/tunnel "ops/tunnel.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        mkdir -p ops
        cp -r migration-backup/tunnel ops/
        echo "✅ Tunnel config restored"
    fi
    
    # Restore Cloudflare credentials
    if [ -d "migration-backup/cloudflared-credentials" ]; then
        echo "   Restoring Cloudflare credentials..."
        mkdir -p ~/.cloudflared
        cp -r migration-backup/cloudflared-credentials/* ~/.cloudflared/ 2>/dev/null || true
        echo "✅ Cloudflare credentials restored"
    fi
    
    echo ""
fi

# Check Ollama
echo "🤖 Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is installed"
    if [ -f "migration-backup/ollama-models-list.txt" ]; then
        echo "   Models from backup:"
        cat migration-backup/ollama-models-list.txt | grep -v "^NAME" | awk '{print "      - " $1}' || echo "      (none listed)"
        echo ""
        echo "   To install models, run:"
        cat migration-backup/ollama-models-list.txt | grep -v "^NAME" | awk '{print "      ollama pull " $1}' || echo "      (no models listed)"
    fi
else
    echo "⚠️  Ollama not found. Install with: brew install --cask ollama"
fi
echo ""

# Check Cloudflared
echo "🌐 Checking Cloudflared..."
if command -v cloudflared &> /dev/null; then
    echo "✅ Cloudflared is installed"
    echo "   To authenticate: cloudflared tunnel login"
else
    echo "⚠️  Cloudflared not found. Install with: brew install cloudflare/cloudflare/cloudflared"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Project location: $PROJECT_ROOT"
echo ""
echo "Next steps:"
echo "1. Review .env files and update paths if needed:"
echo "   nano backend/.env"
echo ""
echo "2. Setup Ollama (if not done):"
echo "   ollama serve"
echo "   # In another terminal:"
echo "   ollama pull llama3"
echo ""
echo "3. Authenticate Cloudflare (if needed):"
echo "   cloudflared tunnel login"
echo ""
echo "4. Start all services:"
echo "   cd $PROJECT_ROOT"
echo "   ./ops/migration/start-all.sh"
echo ""
echo "Or use PM2 to manage services:"
echo "   cd $PROJECT_ROOT"
echo "   # Create PM2 ecosystem file and start services"
echo ""

