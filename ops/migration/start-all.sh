#!/bin/bash

# Start all Quarta Potestas services
# Run this from the project root

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting Quarta Potestas Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if services are already running
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Start PocketBase
echo "📦 Starting PocketBase..."
if check_port 8090; then
    echo "   ⚠️  Port 8090 already in use (PocketBase may already be running)"
else
    cd backend
    if [ -f "./start_pocketbase.sh" ]; then
        ./start_pocketbase.sh &
        echo "   ✅ PocketBase starting..."
        sleep 2
    else
        echo "   ❌ start_pocketbase.sh not found"
    fi
    cd ..
fi
echo ""

# Start Backend API
echo "🐍 Starting Backend API..."
if check_port 8000; then
    echo "   ⚠️  Port 8000 already in use (Backend may already be running)"
else
    cd backend
    if [ -d "venv" ]; then
        source venv/bin/activate
        uvicorn app.main:app --reload > /tmp/quartapotestas-backend.log 2>&1 &
        echo "   ✅ Backend API starting..."
        echo "   📋 Logs: tail -f /tmp/quartapotestas-backend.log"
        sleep 2
    else
        echo "   ❌ Python venv not found. Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    fi
    cd ..
fi
echo ""

# Start Frontend
echo "⚛️  Starting Frontend..."
if check_port 3000; then
    echo "   ⚠️  Port 3000 already in use (Frontend may already be running)"
else
    cd frontend
    if [ -d "node_modules" ]; then
        npm run dev > /tmp/quartapotestas-frontend.log 2>&1 &
        echo "   ✅ Frontend starting..."
        echo "   📋 Logs: tail -f /tmp/quartapotestas-frontend.log"
        sleep 2
    else
        echo "   ❌ node_modules not found. Run: npm install"
    fi
    cd ..
fi
echo ""

# Start Cloudflare Tunnel (optional)
echo "🌐 Cloudflare Tunnel..."
read -p "   Start Cloudflare Tunnel? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "ops/tunnel/config.yml" ]; then
        npm run host:public > /tmp/quartapotestas-tunnel.log 2>&1 &
        echo "   ✅ Cloudflare Tunnel starting..."
        echo "   📋 Logs: tail -f /tmp/quartapotestas-tunnel.log"
    else
        echo "   ❌ Tunnel config not found"
    fi
else
    echo "   ⏭️  Skipping Cloudflare Tunnel"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Services Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Service URLs:"
echo "   PocketBase:  http://localhost:8090/_/"
echo "   Backend API: http://localhost:8000/docs"
echo "   Frontend:    http://localhost:3000"
echo ""
echo "📋 To view logs:"
echo "   Backend:  tail -f /tmp/quartapotestas-backend.log"
echo "   Frontend: tail -f /tmp/quartapotestas-frontend.log"
echo "   Tunnel:   tail -f /tmp/quartapotestas-tunnel.log"
echo ""
echo "🛑 To stop all services: ./ops/migration/stop-all.sh"
echo ""

