#!/bin/bash

# Quarta Potestas Backup Script
# Run this on your current machine before migration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$HOME/quartapotestas-backup-$(date +%Y%m%d-%H%M%S)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Quarta Potestas Backup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
cd "$PROJECT_ROOT"

echo "📁 Creating backup directory: $BACKUP_DIR"
echo ""

# 1. Backup PocketBase data
echo "🗄️  Backing up PocketBase data..."
if [ -d "backend/pb_data" ]; then
    cp -r backend/pb_data "$BACKUP_DIR/"
    echo "   ✅ PocketBase data backed up"
else
    echo "   ⚠️  PocketBase data directory not found"
fi
echo ""

# 2. Backup PocketBase executable (for reference)
echo "💾 Backing up PocketBase executable..."
if [ -f "backend/pocketbase" ]; then
    cp backend/pocketbase "$BACKUP_DIR/pocketbase-$(uname -m)"
    echo "   ✅ PocketBase executable backed up"
else
    echo "   ⚠️  PocketBase executable not found"
fi
echo ""

# 3. Backup environment variables
echo "🔐 Backing up environment variables..."
ENV_COUNT=0
find . -name ".env*" -type f ! -path "*/node_modules/*" ! -path "*/venv/*" | while read -r env_file; do
    RELATIVE_PATH=$(echo "$env_file" | sed "s|^$PROJECT_ROOT/||")
    mkdir -p "$BACKUP_DIR/$(dirname "$RELATIVE_PATH")"
    cp "$env_file" "$BACKUP_DIR/$RELATIVE_PATH"
    ENV_COUNT=$((ENV_COUNT + 1))
    echo "   ✅ Backed up: $RELATIVE_PATH"
done
echo "   📊 Total .env files: $ENV_COUNT"
echo ""

# 4. Backup Cloudflare tunnel config
echo "🌐 Backing up Cloudflare tunnel configuration..."
if [ -d "ops/tunnel" ]; then
    cp -r ops/tunnel "$BACKUP_DIR/"
    echo "   ✅ Tunnel config backed up"
else
    echo "   ⚠️  Tunnel config not found"
fi
echo ""

# 5. Backup Cloudflare credentials (if accessible)
echo "🔑 Backing up Cloudflare credentials..."
if [ -d "$HOME/.cloudflared" ]; then
    cp -r "$HOME/.cloudflared" "$BACKUP_DIR/cloudflared-credentials"
    echo "   ✅ Cloudflare credentials backed up"
else
    echo "   ⚠️  Cloudflare credentials not found (may need to re-authenticate)"
fi
echo ""

# 6. List Ollama models
echo "🤖 Listing Ollama models..."
if command -v ollama &> /dev/null; then
    ollama list > "$BACKUP_DIR/ollama-models-list.txt" 2>&1 || true
    echo "   ✅ Ollama models list saved"
    echo "   📋 Models:"
    cat "$BACKUP_DIR/ollama-models-list.txt" | grep -v "^NAME" | awk '{print "      - " $1}' || echo "      (none listed)"
else
    echo "   ⚠️  Ollama not found or not in PATH"
fi
echo ""

# 7. Create project info file
echo "📝 Creating project info file..."
cat > "$BACKUP_DIR/project-info.txt" << EOF
Quarta Potestas Backup Information
Generated: $(date)
Machine: $(uname -a)
Python: $(python3 --version 2>&1 || echo "Not found")
Node: $(node --version 2>&1 || echo "Not found")
npm: $(npm --version 2>&1 || echo "Not found")
Ollama: $(ollama --version 2>&1 || echo "Not found")
Cloudflared: $(cloudflared --version 2>&1 || echo "Not found")
Project Root: $PROJECT_ROOT
EOF
echo "   ✅ Project info saved"
echo ""

# 8. Create backup manifest
echo "📋 Creating backup manifest..."
find "$BACKUP_DIR" -type f | sort > "$BACKUP_DIR/manifest.txt"
echo "   ✅ Manifest created ($(wc -l < "$BACKUP_DIR/manifest.txt") files)"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Backup location: $BACKUP_DIR"
echo "📊 Total size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Transfer this directory to your Mac Mini"
echo "2. Run the restore script on Mac Mini"
echo "3. Or manually follow the migration guide"
echo ""
echo "To create a compressed archive:"
echo "  cd ~ && tar -czf quartapotestas-backup.tar.gz $(basename "$BACKUP_DIR")"
echo ""

