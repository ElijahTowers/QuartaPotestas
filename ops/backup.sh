#!/bin/bash

# Backup script voor Quarta Potestas project
# Gebruik: ./ops/backup.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$HOME/Desktop/QuartaPotestas-Backups"
DATE=$(date +%Y%m%d-%H%M%S)

echo "📦 Creating backup for Quarta Potestas..."
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# 1. Backup PocketBase data
if [ -d "$PROJECT_ROOT/backend/pb_data" ]; then
    echo "📊 Backing up PocketBase data..."
    tar -czf "$BACKUP_DIR/pocketbase-$DATE.tar.gz" -C "$PROJECT_ROOT/backend" pb_data/
    echo "✅ PocketBase backup created: pocketbase-$DATE.tar.gz"
else
    echo "⚠️  PocketBase data directory not found"
fi

# 2. Backup environment files
echo ""
echo "🔐 Backing up environment files..."
ENV_FILES=()
[ -f "$PROJECT_ROOT/frontend/.env.local" ] && ENV_FILES+=("frontend/.env.local")
[ -f "$PROJECT_ROOT/backend/.env" ] && ENV_FILES+=("backend/.env")

if [ ${#ENV_FILES[@]} -gt 0 ]; then
    tar -czf "$BACKUP_DIR/env-$DATE.tar.gz" -C "$PROJECT_ROOT" "${ENV_FILES[@]}"
    echo "✅ Environment files backup created: env-$DATE.tar.gz"
else
    echo "⚠️  No environment files found"
fi

# 3. Backup Cloudflare Tunnel credentials
if [ -d "$HOME/.cloudflared" ]; then
    echo ""
    echo "🌐 Backing up Cloudflare Tunnel credentials..."
    tar -czf "$BACKUP_DIR/cloudflare-tunnel-$DATE.tar.gz" -C "$HOME" .cloudflared/
    echo "✅ Cloudflare Tunnel backup created: cloudflare-tunnel-$DATE.tar.gz"
else
    echo "⚠️  Cloudflare Tunnel credentials not found"
fi

# 4. Create a manifest file
echo ""
echo "📝 Creating backup manifest..."
cat > "$BACKUP_DIR/manifest-$DATE.txt" << EOF
Quarta Potestas Backup Manifest
Created: $(date)
Project Root: $PROJECT_ROOT

Backups:
- pocketbase-$DATE.tar.gz
- env-$DATE.tar.gz
- cloudflare-tunnel-$DATE.tar.gz

To restore:
1. Extract backups to appropriate locations
2. Follow migration guide: ops/migration-guide.md
EOF

echo "✅ Manifest created: manifest-$DATE.txt"

echo ""
echo "✅ Backup complete!"
echo "📁 Backup location: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Copy backups to Mac mini (USB, AirDrop, iCloud, etc.)"
echo "2. Follow migration guide: ops/migration-guide.md"

