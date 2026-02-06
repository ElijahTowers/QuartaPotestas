#!/usr/bin/env bash
# Start Quarta Potestas services (PocketBase, Backend, Frontend) via PM2.
# Run from project root: ./start-services.sh

set -e
cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Quarta Potestas - Start Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Download PocketBase if missing
if [ ! -f "backend/pocketbase" ] || [ ! -x "backend/pocketbase" ]; then
  echo "📦 PocketBase not found. Downloading..."
  ARCH=$(uname -m)
  [ "$ARCH" = "arm64" ] && PB_ARCH="arm64" || PB_ARCH="amd64"
  PB_VERSION="0.36.2"
  URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_darwin_${PB_ARCH}.zip"
  if (cd backend && curl -L -f -s -S "$URL" -o pocketbase.zip && unzip -q -o pocketbase.zip && chmod +x pocketbase && rm -f pocketbase.zip); then
    echo "   ✅ PocketBase downloaded"
  else
    echo "   ❌ Download failed. Run manually:"
    echo "      cd backend && curl -L \"$URL\" -o pocketbase.zip && unzip -o pocketbase.zip && chmod +x pocketbase && rm pocketbase.zip"
    exit 1
  fi
else
  echo "✅ PocketBase found"
fi

# 2. Ensure backend/.env exists
if [ ! -f "backend/.env" ]; then
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "⚠️  Created backend/.env from .env.example — set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD"
  else
    echo "❌ backend/.env missing and no .env.example found. Create backend/.env with POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD"
    exit 1
  fi
else
  echo "✅ backend/.env exists"
fi

# 3. Optional: frontend .env.local
if [ ! -f "frontend/.env.local" ]; then
  echo "ℹ️  frontend/.env.local not set (optional). Frontend defaults to localhost:8000 and localhost:8090."
fi

# 4. Start with PM2
echo ""
echo "🚀 Starting PM2..."
pm2 start ecosystem.config.js
pm2 save 2>/dev/null || true
echo ""
echo "   PocketBase:  http://localhost:8090/_/"
echo "   Backend:     http://localhost:8000/docs"
echo "   Frontend:    http://localhost:3000"
echo ""
echo "   Commands: pm2 status | pm2 logs | pm2 stop all"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
