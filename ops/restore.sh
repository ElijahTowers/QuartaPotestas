#!/bin/bash

# Restore script voor Quarta Potestas project
# Gebruik: ./ops/restore.sh <backup-directory>

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: ./ops/restore.sh <backup-directory>"
    echo "   Example: ./ops/restore.sh ~/Desktop/QuartaPotestas-Backups"
    exit 1
fi

BACKUP_DIR="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "📦 Restoring Quarta Potestas from backup..."
echo "Backup location: $BACKUP_DIR"
echo ""

# Find latest backups
POCKETBASE_BACKUP=$(ls -t "$BACKUP_DIR"/pocketbase-*.tar.gz 2>/dev/null | head -1)
ENV_BACKUP=$(ls -t "$BACKUP_DIR"/env-*.tar.gz 2>/dev/null | head -1)
CLOUDFLARE_BACKUP=$(ls -t "$BACKUP_DIR"/cloudflare-tunnel-*.tar.gz 2>/dev/null | head -1)

# 1. Restore PocketBase data
if [ -n "$POCKETBASE_BACKUP" ]; then
    echo "📊 Restoring PocketBase data..."
    if [ -d "$PROJECT_ROOT/backend/pb_data" ]; then
        echo "⚠️  Existing pb_data directory found. Backing up first..."
        mv "$PROJECT_ROOT/backend/pb_data" "$PROJECT_ROOT/backend/pb_data.backup.$(date +%Y%m%d)"
    fi
    tar -xzf "$POCKETBASE_BACKUP" -C "$PROJECT_ROOT/backend"
    echo "✅ PocketBase data restored from: $(basename $POCKETBASE_BACKUP)"
else
    echo "⚠️  No PocketBase backup found"
fi

# 2. Restore environment files
if [ -n "$ENV_BACKUP" ]; then
    echo ""
    echo "🔐 Restoring environment files..."
    tar -xzf "$ENV_BACKUP" -C "$PROJECT_ROOT"
    echo "✅ Environment files restored from: $(basename $ENV_BACKUP)"
else
    echo "⚠️  No environment files backup found"
fi

# 3. Restore Cloudflare Tunnel credentials
if [ -n "$CLOUDFLARE_BACKUP" ]; then
    echo ""
    echo "🌐 Restoring Cloudflare Tunnel credentials..."
    if [ -d "$HOME/.cloudflared" ]; then
        echo "⚠️  Existing .cloudflared directory found. Backing up first..."
        mv "$HOME/.cloudflared" "$HOME/.cloudflared.backup.$(date +%Y%m%d)"
    fi
    tar -xzf "$CLOUDFLARE_BACKUP" -C "$HOME"
    echo "✅ Cloudflare Tunnel credentials restored from: $(basename $CLOUDFLARE_BACKUP)"
else
    echo "⚠️  No Cloudflare Tunnel backup found"
fi

echo ""
echo "✅ Restore complete!"
echo ""
echo "Next steps:"
echo "1. Install dependencies: cd frontend && npm install"
echo "2. Setup Python venv: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
echo "3. Start services and verify everything works"
echo "4. See migration guide: ops/migration-guide.md"

