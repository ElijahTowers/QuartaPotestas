#!/usr/bin/env bash
# One-time setup and run for Cloudflare tunnel on Mac mini.
# Run from project root: ./ops/tunnel/setup-and-run.sh

set -e
cd "$(dirname "$0")/../.."

CLOUDFLARED_DIR="$HOME/.cloudflared"
CONFIG="ops/tunnel/config.yml"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Cloudflare Tunnel – setup and run"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p "$CLOUDFLARED_DIR"

# 1. Login if needed
if [ ! -f "$CLOUDFLARED_DIR/cert.pem" ]; then
  echo ""
  echo "Step 1: Log in to Cloudflare (one-time)."
  echo "  A URL will open or be printed. Open it in a browser and authorize."
  echo ""
  cloudflared tunnel login
  echo "  Login complete."
else
  echo "  Already logged in (cert.pem present)."
fi

# 2. Create tunnel if no credentials
CREDENTIALS_FILE="$CLOUDFLARED_DIR/3f830e84-45e8-43af-bc98-8f44bd61d085.json"
if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo ""
  echo "Step 2: Creating tunnel 'quartapotestas-local'..."
  CREATE_OUT=$(cloudflared tunnel create quartapotestas-local 2>&1) || true
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep quartapotestas-local | awk '{print $1}' | head -1)
  if [ -z "$TUNNEL_ID" ]; then
    echo "  Could not get tunnel ID. Output: $CREATE_OUT"
    exit 1
  fi
  echo "  Tunnel ID: $TUNNEL_ID"
  CREDENTIALS_FILE="$CLOUDFLARED_DIR/${TUNNEL_ID}.json"
  if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "  Credentials file not found: $CREDENTIALS_FILE"
    exit 1
  fi
  # Update config with new tunnel ID and credentials path
  sed -i.bak "s|tunnel: .*|tunnel: $TUNNEL_ID|" "$CONFIG"
  sed -i.bak "s|credentials-file: .*|credentials-file: $CREDENTIALS_FILE|" "$CONFIG"
  rm -f "$CONFIG.bak"
  echo "  Config updated."
  echo ""
  echo "Step 3: Routing DNS..."
  cloudflared tunnel route dns quartapotestas-local quartapotestas.com || true
  cloudflared tunnel route dns quartapotestas-local www.quartapotestas.com || true
  cloudflared tunnel route dns quartapotestas-local db.quartapotestas.com || true
  echo "  DNS routed."
else
  echo "  Credentials file present: $CREDENTIALS_FILE"
  # Ensure config uses absolute path so PM2 finds it
  if grep -q 'credentials-file: ~' "$CONFIG" 2>/dev/null; then
    sed -i.bak "s|credentials-file: ~/.cloudflared/|credentials-file: $CLOUDFLARED_DIR/|" "$CONFIG"
    rm -f "$CONFIG.bak"
    echo "  Config updated to use absolute path."
  fi
fi

echo ""
echo "Step 4: Starting tunnel via PM2..."
pm2 restart tunnel 2>/dev/null || pm2 start ecosystem.config.js --only tunnel
sleep 5
pm2 status
echo ""
if pm2 jlist 2>/dev/null | grep -q '"name":"tunnel".*"status":"online"'; then
  echo "  Tunnel is running. https://quartapotestas.com/ should be reachable."
else
  echo "  Check: pm2 logs tunnel"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
