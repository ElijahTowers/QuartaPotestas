#!/bin/bash

# Quarta Potestas Migration Script
# Automatically migrates everything to Mac Mini via SSH
# Usage: ./migrate-to-mac-mini.sh

set -e

# Configuration
MAC_MINI_USER="lowie"
MAC_MINI_HOST="192.168.1.84"
MAC_MINI_PATH="~/Projects/QuartaPotestas"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Quarta Potestas Migration to Mac Mini"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Target: ${MAC_MINI_USER}@${MAC_MINI_HOST}"
echo "Project Root: $PROJECT_ROOT"
echo ""

# Test SSH connection
echo "🔌 Testing SSH connection..."
echo "   Attempting to connect to ${MAC_MINI_USER}@${MAC_MINI_HOST}..."
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${MAC_MINI_USER}@${MAC_MINI_HOST}" "echo 'Connection successful'" 2>&1; then
    echo ""
    echo "❌ Cannot connect to Mac Mini!"
    echo ""
    echo "Please test manually first:"
    echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST}"
    echo ""
    echo "If that works, you can:"
    echo "  1. Run this script again"
    echo "  2. Or manually follow: ops/migration/README.md"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ SSH connection successful"
fi
echo ""

# Step 1: Create backup on current machine
echo "📦 Step 1: Creating backup..."
BACKUP_DIR="$HOME/quartapotestas-migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cd "$PROJECT_ROOT"

# Backup PocketBase data
if [ -d "backend/pb_data" ]; then
    echo "   Backing up PocketBase data..."
    cp -r backend/pb_data "$BACKUP_DIR/" 2>/dev/null || true
fi

# Backup .env files
echo "   Backing up environment files..."
find . -name ".env*" -type f ! -path "*/node_modules/*" ! -path "*/venv/*" ! -path "*/.git/*" | while read -r env_file; do
    RELATIVE_PATH=$(echo "$env_file" | sed "s|^$PROJECT_ROOT/||")
    mkdir -p "$BACKUP_DIR/$(dirname "$RELATIVE_PATH")"
    cp "$env_file" "$BACKUP_DIR/$RELATIVE_PATH" 2>/dev/null || true
done

# Backup Cloudflare tunnel config
if [ -d "ops/tunnel" ]; then
    echo "   Backing up Cloudflare tunnel config..."
    cp -r ops/tunnel "$BACKUP_DIR/" 2>/dev/null || true
fi

# Backup Cloudflare credentials
if [ -d "$HOME/.cloudflared" ]; then
    echo "   Backing up Cloudflare credentials..."
    cp -r "$HOME/.cloudflared" "$BACKUP_DIR/cloudflared-credentials" 2>/dev/null || true
fi

# List Ollama models
if command -v ollama &> /dev/null; then
    echo "   Listing Ollama models..."
    ollama list > "$BACKUP_DIR/ollama-models-list.txt" 2>&1 || true
fi

echo "✅ Backup created: $BACKUP_DIR"
echo ""

# Step 2: Prepare project for transfer (exclude large files)
echo "📦 Step 2: Preparing project for transfer..."
TEMP_DIR=$(mktemp -d)
PROJECT_COPY="$TEMP_DIR/QuartaPotestas"

# Copy project excluding large directories
rsync -av --progress \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git/objects' \
    --exclude='pb_data' \
    --exclude='*.db-journal' \
    --exclude='.env*' \
    "$PROJECT_ROOT/" "$PROJECT_COPY/"

echo "✅ Project prepared"
echo ""

# Step 3: Transfer to Mac Mini
echo "📤 Step 3: Transferring to Mac Mini..."
echo "   This may take a while..."

# Create directory on Mac Mini
ssh "${MAC_MINI_USER}@${MAC_MINI_HOST}" "mkdir -p ${MAC_MINI_PATH}"

# Transfer project
rsync -avz --progress \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git/objects' \
    --exclude='pb_data' \
    "$PROJECT_ROOT/" "${MAC_MINI_USER}@${MAC_MINI_HOST}:${MAC_MINI_PATH}/"

# Transfer backup
echo "   Transferring backup data..."
rsync -avz --progress "$BACKUP_DIR/" "${MAC_MINI_USER}@${MAC_MINI_HOST}:${MAC_MINI_PATH}/migration-backup/"

echo "✅ Transfer complete"
echo ""

# Step 4: Setup on Mac Mini
echo "🔧 Step 4: Setting up on Mac Mini..."
ssh "${MAC_MINI_USER}@${MAC_MINI_HOST}" << 'ENDSSH'
    set -e
    cd ~/QuartaPotestas
    
    echo "   Installing dependencies..."
    
    # Install Python dependencies
    if [ ! -d "backend/venv" ]; then
        echo "   Creating Python virtual environment..."
        cd backend
        python3 -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        cd ..
    fi
    
    # Install Node.js dependencies
    if [ ! -d "frontend/node_modules" ]; then
        echo "   Installing Node.js dependencies..."
        cd frontend
        npm install
        cd ..
    fi
    
    # Download PocketBase for macOS
    echo "   Downloading PocketBase for macOS..."
    cd backend
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        PB_ARCH="arm64"
    else
        PB_ARCH="amd64"
    fi
    
    if [ ! -f "pocketbase" ] || [ ! -x "pocketbase" ]; then
        curl -L "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_darwin_${PB_ARCH}.zip" -o pocketbase.zip
        unzip -o pocketbase.zip
        chmod +x pocketbase
        rm pocketbase.zip
    fi
    cd ..
    
    # Restore PocketBase data
    if [ -d "migration-backup/pb_data" ]; then
        echo "   Restoring PocketBase data..."
        if [ -d "backend/pb_data" ]; then
            mv backend/pb_data "backend/pb_data.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        cp -r migration-backup/pb_data backend/
    fi
    
    # Restore .env files
    echo "   Restoring environment files..."
    if [ -d "migration-backup" ]; then
        find migration-backup -name ".env*" -type f | while read -r env_file; do
            RELATIVE_PATH=$(echo "$env_file" | sed "s|^migration-backup/||")
            TARGET_PATH="$RELATIVE_PATH"
            if [ -f "$TARGET_PATH" ]; then
                cp "$TARGET_PATH" "$TARGET_PATH.backup.$(date +%Y%m%d-%H%M%S)"
            fi
            mkdir -p "$(dirname "$TARGET_PATH")"
            cp "$env_file" "$TARGET_PATH"
        done
    fi
    
    # Restore Cloudflare tunnel config
    if [ -d "migration-backup/tunnel" ]; then
        echo "   Restoring Cloudflare tunnel config..."
        if [ -d "ops/tunnel" ]; then
            mv ops/tunnel "ops/tunnel.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        mkdir -p ops
        cp -r migration-backup/tunnel ops/
    fi
    
    # Restore Cloudflare credentials
    if [ -d "migration-backup/cloudflared-credentials" ]; then
        echo "   Restoring Cloudflare credentials..."
        mkdir -p ~/.cloudflared
        cp -r migration-backup/cloudflared-credentials/* ~/.cloudflared/ 2>/dev/null || true
    fi
    
    echo "   ✅ Setup complete on Mac Mini"
ENDSSH

echo "✅ Setup complete"
echo ""

# Step 5: Install Ollama models (if needed)
echo "🤖 Step 5: Ollama models..."
ssh "${MAC_MINI_USER}@${MAC_MINI_HOST}" << 'ENDSSH'
    if [ -f "migration-backup/ollama-models-list.txt" ]; then
        echo "   Models from backup:"
        cat migration-backup/ollama-models-list.txt | grep -v "^NAME" | awk '{print "      - " $1}' || echo "      (none listed)"
        echo ""
        echo "   To install models, run on Mac Mini:"
        cat migration-backup/ollama-models-list.txt | grep -v "^NAME" | awk '{print "      ollama pull " $1}' || echo "      (no models listed)"
    fi
ENDSSH

echo ""

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"
echo "✅ Cleanup complete"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Migration Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Project location on Mac Mini: ${MAC_MINI_PATH}"
echo ""
echo "Next steps on Mac Mini:"
echo "1. SSH to Mac Mini: ssh ${MAC_MINI_USER}@${MAC_MINI_HOST}"
echo "2. Review .env files and update paths if needed"
echo "3. Setup Ollama: ollama serve & ollama pull llama3"
echo "4. Re-authenticate Cloudflare: cloudflared tunnel login"
echo "5. Start services: cd ~/QuartaPotestas && ./ops/migration/start-all.sh"
echo ""
echo "To start services remotely:"
echo "  ssh ${MAC_MINI_USER}@${MAC_MINI_HOST} 'cd ~/QuartaPotestas && ./ops/migration/start-all.sh'"
echo ""

