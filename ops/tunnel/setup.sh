#!/bin/bash

set -e

echo "🚀 Setting up Cloudflare Tunnel for Quarta Potestas"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed."
    echo "   Install it with: brew install cloudflare/cloudflare/cloudflared"
    exit 1
fi

echo "✅ cloudflared is installed"

# Check if already logged in
if [ -f ~/.cloudflared/cert.pem ]; then
    echo "✅ Already logged in to Cloudflare"
else
    echo "🔐 Logging in to Cloudflare..."
    echo "   A browser window will open. Please complete the authentication."
    cloudflared tunnel login
fi

# Check if tunnel already exists
if cloudflared tunnel list 2>/dev/null | grep -q "quartapotestas-local"; then
    echo "✅ Tunnel 'quartapotestas-local' already exists"
    TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "quartapotestas-local" | awk '{print $1}')
    echo "   Tunnel ID: $TUNNEL_ID"
else
    echo "📦 Creating tunnel 'quartapotestas-local'..."
    TUNNEL_OUTPUT=$(cloudflared tunnel create quartapotestas-local 2>&1)
    TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP 'Created tunnel \K[^ ]+' || echo "")
    
    if [ -z "$TUNNEL_ID" ]; then
        # Try to extract from the output differently
        TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "quartapotestas-local" | awk '{print $1}')
    fi
    
    if [ -z "$TUNNEL_ID" ]; then
        echo "❌ Failed to create tunnel. Please check the output above."
        exit 1
    fi
    
    echo "✅ Tunnel created with ID: $TUNNEL_ID"
fi

# Update config.yml with the tunnel ID
CONFIG_FILE="ops/tunnel/config.yml"
if [ -f "$CONFIG_FILE" ]; then
    echo "📝 Updating config.yml with tunnel ID..."
    sed -i.bak "s/\[YOUR-TUNNEL-ID-HERE\]/$TUNNEL_ID/g" "$CONFIG_FILE"
    sed -i.bak "s/\[YOUR-TUNNEL-ID-HERE\]/$TUNNEL_ID/g" "$CONFIG_FILE"  # Update credentials path too
    rm -f "$CONFIG_FILE.bak"
    echo "✅ Config file updated"
else
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

# Route DNS
echo ""
echo "🌐 Setting up DNS routing..."
echo "   This will create CNAME records in your Cloudflare DNS."

read -p "Do you want to route DNS now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Routing quartapotestas.com..."
    cloudflared tunnel route dns quartapotestas-local quartapotestas.com || echo "   ⚠️  Failed to route quartapotestas.com (may already exist)"
    
    echo "   Routing www.quartapotestas.com..."
    cloudflared tunnel route dns quartapotestas-local www.quartapotestas.com || echo "   ⚠️  Failed to route www.quartapotestas.com (may already exist)"
    
    echo "   Routing db.quartapotestas.com..."
    cloudflared tunnel route dns quartapotestas-local db.quartapotestas.com || echo "   ⚠️  Failed to route db.quartapotestas.com (may already exist)"
    
    echo "✅ DNS routing complete"
else
    echo "⏭️  Skipping DNS routing. You can do this later with:"
    echo "   cloudflared tunnel route dns quartapotestas-local quartapotestas.com"
    echo "   cloudflared tunnel route dns quartapotestas-local www.quartapotestas.com"
    echo "   cloudflared tunnel route dns quartapotestas-local db.quartapotestas.com"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the tunnel, run:"
echo "   npm run host:public"
echo ""
echo "Or directly (from project root):"
echo "   cloudflared tunnel --config ops/tunnel/config.yml run"
echo ""

