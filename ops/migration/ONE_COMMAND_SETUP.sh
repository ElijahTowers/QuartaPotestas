#!/bin/bash

# ONE COMMAND SETUP - Run this on Mac Mini
# This does EVERYTHING automatically

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Quarta Potestas - Complete Automated Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="$HOME/Projects/QuartaPotestas"

# Step 1: Clone or update repository
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "📥 Cloning repository..."
    mkdir -p ~/Projects
    cd ~/Projects
    git clone https://github.com/ElijahTowers/QuartaPotestas.git
    echo "✅ Repository cloned"
else
    echo "✅ Repository exists, updating..."
    cd "$PROJECT_ROOT"
    git pull origin main || echo "⚠️  Could not pull (continuing)"
fi

cd "$PROJECT_ROOT"
echo ""

# Step 2: Python setup
echo "🐍 Setting up Python environment..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi
source venv/bin/activate
pip install --upgrade pip -q
if [ -f "requirements.txt" ]; then
    echo "   Installing Python dependencies (this may take a while)..."
    pip install -r requirements.txt -q
    echo "✅ Python dependencies installed"
fi
cd ..
echo ""

# Step 3: Node.js setup
echo "📦 Setting up Node.js dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "   Installing Node.js dependencies (this may take a while)..."
    npm install --silent
    echo "✅ Node.js dependencies installed"
else
    echo "✅ Node.js dependencies already installed"
fi
cd ..
echo ""

# Step 4: PocketBase setup
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

# Step 5: Restore backup if exists
if [ -d "migration-backup" ]; then
    echo "📥 Restoring from backup..."
    
    if [ -d "migration-backup/pb_data" ]; then
        if [ -d "backend/pb_data" ]; then
            mv backend/pb_data "backend/pb_data.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        cp -r migration-backup/pb_data backend/
        echo "✅ PocketBase data restored"
    fi
    
    find migration-backup -name ".env*" -type f 2>/dev/null | while read -r env_file; do
        RELATIVE_PATH=$(echo "$env_file" | sed "s|^migration-backup/||")
        TARGET_PATH="$RELATIVE_PATH"
        if [ -f "$TARGET_PATH" ]; then
            cp "$TARGET_PATH" "$TARGET_PATH.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        mkdir -p "$(dirname "$TARGET_PATH")"
        cp "$env_file" "$TARGET_PATH"
    done
    
    if [ -d "migration-backup/tunnel" ]; then
        if [ -d "ops/tunnel" ]; then
            mv ops/tunnel "ops/tunnel.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        mkdir -p ops
        cp -r migration-backup/tunnel ops/
    fi
    
    if [ -d "migration-backup/cloudflared-credentials" ]; then
        mkdir -p ~/.cloudflared
        cp -r migration-backup/cloudflared-credentials/* ~/.cloudflared/ 2>/dev/null || true
    fi
    
    echo "✅ Backup restored"
    echo ""
fi

# Step 6: Create .env files if missing
echo "📝 Setting up environment files..."
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << 'EOF'
# PocketBase Configuration
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=lowiehartjes@gmail.com
POCKETBASE_ADMIN_PASSWORD=CHANGE_THIS_PASSWORD

# Backend Configuration
BACKEND_URL=http://127.0.0.1:8000
FRONTEND_URL=http://127.0.0.1:3000

# Ollama Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3

# Environment
ENVIRONMENT=production
EOF
    echo "   ⚠️  Created backend/.env - PLEASE EDIT AND SET YOUR PASSWORD!"
fi

if [ ! -f "frontend/.env.local" ]; then
    cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090
EOF
    echo "✅ Frontend .env.local created"
fi
echo ""

# Step 7: Setup Ollama
echo "🤖 Setting up Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is installed"
    
    # Check if ollama is running
    if ! pgrep -x "ollama" > /dev/null; then
        echo "   Starting Ollama service..."
        ollama serve > /dev/null 2>&1 &
        sleep 3
    fi
    
    # Install model if not exists
    if ! ollama list | grep -q "llama3"; then
        echo "✅ llama3 model already installed"
    else
        echo "   Installing llama3 model (this may take 5-10 minutes)..."
        ollama pull llama3 || echo "⚠️  Could not pull model - you may need to start ollama serve manually"
    fi
else
    echo "⚠️  Ollama not found - install with: brew install --cask ollama"
fi
echo ""

# Step 8: Create PM2 ecosystem
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
echo ""

# Step 9: Final instructions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Project: $PROJECT_ROOT"
echo ""
echo "📋 IMPORTANT - Do this now:"
echo ""
echo "1. Edit backend/.env and set your password:"
echo "   nano backend/.env"
echo "   # Change POCKETBASE_ADMIN_PASSWORD"
echo ""
echo "2. Start services:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "3. Enable auto-start (optional):"
echo "   pm2 startup"
echo "   # Follow the instructions shown"
echo ""
echo "4. Check status:"
echo "   pm2 status"
echo "   pm2 logs"
echo ""
echo "🌐 Services will be available at:"
echo "   PocketBase: http://localhost:8090/_/"
echo "   Backend:    http://localhost:8000/docs"
echo "   Frontend:   http://localhost:3000"
echo ""

