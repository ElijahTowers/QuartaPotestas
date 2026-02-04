#!/bin/bash

# Stop all Quarta Potestas services

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Stopping Quarta Potestas Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Stop services on specific ports
stop_port() {
    PORT=$1
    NAME=$2
    PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "🛑 Stopping $NAME (port $PORT)..."
        kill $PIDS 2>/dev/null || true
        sleep 1
        # Force kill if still running
        PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            kill -9 $PIDS 2>/dev/null || true
        fi
        echo "   ✅ $NAME stopped"
    else
        echo "   ℹ️  $NAME not running (port $PORT)"
    fi
}

# Stop PocketBase
stop_port 8090 "PocketBase"

# Stop Backend API
stop_port 8000 "Backend API"

# Stop Frontend
stop_port 3000 "Frontend"

# Stop Cloudflare Tunnel (may be on different port, but check for cloudflared processes)
echo "🛑 Stopping Cloudflare Tunnel..."
CLOUDFLARED_PIDS=$(pgrep -f "cloudflared tunnel" 2>/dev/null || true)
if [ -n "$CLOUDFLARED_PIDS" ]; then
    kill $CLOUDFLARED_PIDS 2>/dev/null || true
    sleep 1
    CLOUDFLARED_PIDS=$(pgrep -f "cloudflared tunnel" 2>/dev/null || true)
    if [ -n "$CLOUDFLARED_PIDS" ]; then
        kill -9 $CLOUDFLARED_PIDS 2>/dev/null || true
    fi
    echo "   ✅ Cloudflare Tunnel stopped"
else
    echo "   ℹ️  Cloudflare Tunnel not running"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services stopped!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

