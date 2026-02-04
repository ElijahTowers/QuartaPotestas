#!/bin/bash

# Quick health check script for Quarta Potestas services

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 Quarta Potestas Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check PocketBase
echo "📦 PocketBase (Port 8090):"
if lsof -Pi :8090 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PB_HEALTH=$(curl -s http://localhost:8090/api/health 2>&1)
    if echo "$PB_HEALTH" | grep -q "healthy\|200"; then
        echo "   ✅ Running and healthy"
    else
        echo "   ⚠️  Running but health check failed: $PB_HEALTH"
    fi
else
    echo "   ❌ Not running"
fi
echo ""

# Check Backend API
echo "🐍 Backend API (Port 8000):"
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    BACKEND_HEALTH=$(curl -s http://localhost:8000/api/health 2>&1)
    if echo "$BACKEND_HEALTH" | grep -q "healthy\|200"; then
        echo "   ✅ Running and healthy"
    else
        echo "   ⚠️  Running but health check failed: $BACKEND_HEALTH"
    fi
else
    echo "   ❌ Not running"
fi
echo ""

# Check Frontend
echo "⚛️  Frontend (Port 3000):"
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>&1)
    if [ "$FRONTEND_RESPONSE" = "200" ] || [ "$FRONTEND_RESPONSE" = "304" ]; then
        echo "   ✅ Running (HTTP $FRONTEND_RESPONSE)"
    else
        echo "   ⚠️  Running but returned HTTP $FRONTEND_RESPONSE"
    fi
else
    echo "   ❌ Not running"
fi
echo ""

# Check Cloudflare Tunnel
echo "🌐 Cloudflare Tunnel:"
if pgrep -f "cloudflared tunnel" > /dev/null; then
    echo "   ✅ Running"
else
    echo "   ❌ Not running"
fi
echo ""

# Check System User
echo "👤 System User (system@ingestion.local):"
SYSTEM_USER=$(curl -s 'http://localhost:8090/api/collections/users/records?filter=email%20=%20%22system@ingestion.local%22' 2>&1)
if echo "$SYSTEM_USER" | grep -q '"totalItems":0'; then
    echo "   ❌ Not found (will be created on first ingestion)"
else
    echo "   ✅ Exists"
fi
echo ""

# Check Ollama
echo "🤖 Ollama:"
if command -v ollama &> /dev/null; then
    OLLAMA_MODELS=$(ollama list 2>&1 | grep -v "^NAME" | wc -l | tr -d ' ')
    echo "   ✅ Installed ($OLLAMA_MODELS models available)"
else
    echo "   ❌ Not installed"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Health check complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

