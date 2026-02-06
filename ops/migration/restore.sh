#!/bin/bash

# Quarta Potestas Restore Script
# Run this on Mac Mini after transferring backup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 Quarta Potestas Restore Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Find backup directory
BACKUP_DIR=""
if [ -d "$HOME/Downloads/quartapotestas-backup"* ]; then
    BACKUP_DIR=$(ls -td "$HOME/Downloads/quartapotestas-backup"* | head -1)
elif [ -d "$HOME/quartapotestas-backup"* ]; then
    BACKUP_DIR=$(ls -td "$HOME/quartapotestas-backup"* | head -1)
else
    echo "❌ Backup directory not found!"
    echo ""
    echo "Please specify the backup directory path:"
    read -r BACKUP_DIR
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "❌ Directory not found: $BACKUP_DIR"
        exit 1
    fi
fi

echo "📁 Using backup directory: $BACKUP_DIR"
echo ""

# Verify backup
if [ ! -f "$BACKUP_DIR/manifest.txt" ]; then
    echo "⚠️  Warning: Manifest not found. Backup may be incomplete."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

cd "$PROJECT_ROOT"

# 1. Restore PocketBase data
echo "🗄️  Restoring PocketBase data..."
if [ -d "$BACKUP_DIR/pb_data" ]; then
    if [ -d "backend/pb_data" ]; then
        echo "   ⚠️  Existing pb_data found. Backing up first..."
        mv backend/pb_data "backend/pb_data.backup.$(date +%Y%m%d-%H%M%S)"
    fi
    cp -r "$BACKUP_DIR/pb_data" backend/
    echo "   ✅ PocketBase data restored"
else
    echo "   ⚠️  PocketBase data not found in backup"
fi
echo ""

# 2. Download PocketBase for macOS
echo "💾 Downloading PocketBase for macOS..."
cd backend
if [ ! -f "pocketbase" ] || [ ! -x "pocketbase" ]; then
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        PB_ARCH="arm64"
    else
        PB_ARCH="amd64"
    fi
    
    echo "   Downloading for $PB_ARCH..."
    curl -L "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_${PB_ARCH}.zip" -o pocketbase.zip
    unzip -o pocketbase.zip
    chmod +x pocketbase
    rm pocketbase.zip
    echo "   ✅ PocketBase downloaded"
else
    echo "   ✅ PocketBase already exists"
fi
cd ..
echo ""

# 3. Restore environment variables
echo "🔐 Restoring environment variables..."
ENV_COUNT=0
find "$BACKUP_DIR" -name ".env*" -type f | while read -r env_file; do
    RELATIVE_PATH=$(echo "$env_file" | sed "s|^$BACKUP_DIR/||")
    TARGET_PATH="$PROJECT_ROOT/$RELATIVE_PATH"
    
    if [ -f "$TARGET_PATH" ]; then
        echo "   ⚠️  $RELATIVE_PATH already exists. Backing up..."
        cp "$TARGET_PATH" "$TARGET_PATH.backup.$(date +%Y%m%d-%H%M%S)"
    fi
    
    mkdir -p "$(dirname "$TARGET_PATH")"
    cp "$env_file" "$TARGET_PATH"
    ENV_COUNT=$((ENV_COUNT + 1))
    echo "   ✅ Restored: $RELATIVE_PATH"
done
echo "   📊 Total .env files restored: $ENV_COUNT"
echo "   ⚠️  Please review and update paths in .env files if needed"
echo ""

# 4. Restore Cloudflare tunnel config
echo "🌐 Restoring Cloudflare tunnel configuration..."
if [ -d "$BACKUP_DIR/tunnel" ]; then
    if [ -d "ops/tunnel" ]; then
        echo "   ⚠️  Existing tunnel config found. Backing up..."
        mv ops/tunnel "ops/tunnel.backup.$(date +%Y%m%d-%H%M%S)"
    fi
    mkdir -p ops
    cp -r "$BACKUP_DIR/tunnel" ops/
    echo "   ✅ Tunnel config restored"
    echo "   ⚠️  You may need to re-authenticate: cloudflared tunnel login"
else
    echo "   ⚠️  Tunnel config not found in backup"
fi
echo ""

# 5. Restore Cloudflare credentials (if available)
echo "🔑 Restoring Cloudflare credentials..."
if [ -d "$BACKUP_DIR/cloudflared-credentials" ]; then
    mkdir -p "$HOME/.cloudflared"
    cp -r "$BACKUP_DIR/cloudflared-credentials"/* "$HOME/.cloudflared/" 2>/dev/null || true
    echo "   ✅ Cloudflare credentials restored"
    echo "   ⚠️  You may still need to re-authenticate: cloudflared tunnel login"
else
    echo "   ⚠️  Cloudflare credentials not found (will need to re-authenticate)"
fi
echo ""

# 6. Display Ollama models info
echo "🤖 Ollama models information..."
if [ -f "$BACKUP_DIR/ollama-models-list.txt" ]; then
    echo "   📋 Models from backup:"
    cat "$BACKUP_DIR/ollama-models-list.txt" | grep -v "^NAME" | awk '{print "      - " $1}' || echo "      (none listed)"
    echo ""
    echo "   To restore models, run:"
    cat "$BACKUP_DIR/ollama-models-list.txt" | grep -v "^NAME" | awk '{print "      ollama pull " $1}' || echo "      (no models to restore)"
else
    echo "   ⚠️  Ollama models list not found"
fi
echo ""

# 7. Display project info
if [ -f "$BACKUP_DIR/project-info.txt" ]; then
    echo "📝 Original system information:"
    cat "$BACKUP_DIR/project-info.txt"
    echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Restore Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Review and update .env files if needed"
echo "2. Install Python dependencies: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
echo "3. Install Node.js dependencies: cd frontend && npm install"
echo "4. Setup Ollama: ollama serve & ollama pull llama3"
echo "5. Re-authenticate Cloudflare: cloudflared tunnel login"
echo "6. Start services and verify everything works"
echo ""

