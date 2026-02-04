#!/bin/bash

# Complete setup script for Mac Mini
# Run this ON the Mac Mini after cloning the repository

set -e

PROJECT_ROOT="$HOME/Projects/QuartaPotestas"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Complete Quarta Potestas Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Clone repository if not exists
if [ ! -d "$PROJECT_ROOT" ]; then
    echo "📥 Cloning repository..."
    mkdir -p ~/Projects
    cd ~/Projects
    git clone https://github.com/ElijahTowers/QuartaPotestas.git
    echo "✅ Repository cloned"
else
    echo "✅ Repository already exists"
    cd "$PROJECT_ROOT"
    echo "📥 Pulling latest changes..."
    git pull origin main || echo "⚠️  Could not pull (continuing anyway)"
fi

cd "$PROJECT_ROOT"
echo ""

# Step 2: Run setup script
echo "🔧 Running setup script..."
chmod +x ops/migration/setup-on-mac-mini.sh
./ops/migration/setup-on-mac-mini.sh
echo ""

# Step 3: Create .env files if they don't exist
echo "📝 Checking environment files..."
if [ ! -f "backend/.env" ]; then
    echo "   Creating backend/.env from template..."
    cat > backend/.env << 'EOF'
# PocketBase Configuration
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=your-email@example.com
POCKETBASE_ADMIN_PASSWORD=your-password

# Backend Configuration
BACKEND_URL=http://127.0.0.1:8000
FRONTEND_URL=http://127.0.0.1:3000

# Ollama Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3

# Environment
ENVIRONMENT=production
EOF
    echo "   ⚠️  Please edit backend/.env and set your credentials"
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "   Creating frontend/.env.local..."
    cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090
EOF
    echo "✅ Frontend .env.local created"
fi
echo ""

# Step 4: Setup Ollama
echo "🤖 Setting up Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is installed"
    
    # Check if model exists
    if ollama list | grep -q "llama3"; then
        echo "✅ llama3 model already installed"
    else
        echo "   Installing llama3 model (this may take a while)..."
        ollama pull llama3 || echo "⚠️  Could not pull model (you may need to start ollama serve first)"
    fi
else
    echo "⚠️  Ollama not found. Install with: brew install --cask ollama"
fi
echo ""

# Step 5: Setup Cloudflare Tunnel
echo "🌐 Setting up Cloudflare Tunnel..."
if command -v cloudflared &> /dev/null; then
    echo "✅ Cloudflared is installed"
    if [ -f "ops/tunnel/config.yml" ]; then
        echo "✅ Tunnel config exists"
        if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
            echo "   ⚠️  Not authenticated. Run: cloudflared tunnel login"
        else
            echo "✅ Cloudflare tunnel authenticated"
        fi
    else
        echo "⚠️  Tunnel config not found"
    fi
else
    echo "⚠️  Cloudflared not found. Install with: brew install cloudflare/cloudflare/cloudflared"
fi
echo ""

# Step 6: Create PM2 ecosystem file
echo "⚙️  Creating PM2 ecosystem file..."
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
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'backend',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      interpreter: './venv/bin/python',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    }
  ],
};
EOF
echo "✅ PM2 ecosystem file created"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Project location: $PROJECT_ROOT"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Edit environment files:"
echo "   nano backend/.env"
echo "   # Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD"
echo ""
echo "2. Start Ollama (if not running):"
echo "   ollama serve"
echo ""
echo "3. Authenticate Cloudflare (if needed):"
echo "   cloudflared tunnel login"
echo ""
echo "4. Start all services with PM2:"
echo "   cd $PROJECT_ROOT"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup  # Follow instructions for auto-start"
echo ""
echo "Or start manually:"
echo "   ./ops/migration/start-all.sh"
echo ""
echo "📊 Check service status:"
echo "   pm2 status"
echo "   pm2 logs"
echo ""

