# Cloudflare Tunnel Setup for Quarta Potestas

This directory contains the configuration for exposing your local game instance to the internet via Cloudflare Tunnel.

## Prerequisites

1. **Install Cloudflared:**
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared

   # Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. **Login to Cloudflare:**
   ```bash
   cloudflared tunnel login
   ```
   This will open a browser window to authenticate with your Cloudflare account.

## Initial Setup

### Step 1: Create the Tunnel

```bash
cloudflared tunnel create quartapotestas-local
```

This will:
- Create a tunnel named `quartapotestas-local`
- Generate a UUID (the tunnel ID)
- Save credentials to `~/.cloudflared/[TUNNEL-ID].json`

### Step 2: Update Configuration

1. Open `ops/tunnel/config.yml`
2. Replace `[YOUR-TUNNEL-ID-HERE]` with the actual tunnel ID from Step 1
3. Update the `credentials-file` path if needed (default is usually correct)

### Step 3: Route DNS Records

Route your domain DNS through the tunnel:

```bash
# Main domain
cloudflared tunnel route dns quartapotestas-local quartapotestas.com

# WWW subdomain (optional, but recommended)
cloudflared tunnel route dns quartapotestas-local www.quartapotestas.com

# Database subdomain
cloudflared tunnel route dns quartapotestas-local db.quartapotestas.com
```

**Note:** These commands will create CNAME records in your Cloudflare DNS dashboard pointing to the tunnel.

### Step 4: Verify DNS

Check that the DNS records were created:
- Go to your Cloudflare dashboard
- Navigate to DNS settings for `quartapotestas.com`
- You should see CNAME records pointing to `[TUNNEL-ID].cfargotunnel.com`

## Running the Tunnel

### Option 1: Using npm script (Recommended)

```bash
npm run host:public
```

### Option 2: Direct command

```bash
# From project root (--config must come before "run" in cloudflared 2026+)
cloudflared tunnel --config ops/tunnel/config.yml run
```

### Option 3: Run as a service (Background)

```bash
# macOS (using launchd)
cloudflared tunnel --config ops/tunnel/config.yml run &

# Or install as a system service
cloudflared service install
```

## What Gets Exposed

- **`quartapotestas.com`** → Your Next.js frontend (`http://localhost:3000`)
- **`www.quartapotestas.com`** → Your Next.js frontend (`http://localhost:3000`)
- **`db.quartapotestas.com`** → Your PocketBase instance (`http://localhost:8090`)
- **Everything else** → HTTP 404

## SSL/TLS Security Setup

To ensure your site is fully secure:

1. **Enable "Always Use HTTPS" in Cloudflare Dashboard:**
   - Go to: https://dash.cloudflare.com
   - Select your domain → **SSL/TLS** → **Edge Certificates**
   - Enable **"Always Use HTTPS"** toggle
   - This automatically redirects HTTP to HTTPS

2. **Set SSL/TLS Encryption Mode:**
   - In **SSL/TLS** → **Overview**
   - Set to **"Full"** (Cloudflare Tunnel handles certificates automatically)

3. **Additional Security Headers:**
   - The Next.js middleware (`frontend/middleware.ts`) adds security headers automatically
   - Includes HSTS, X-Frame-Options, and more

See `ops/tunnel/ssl-setup.md` for detailed instructions.

## Important Notes

⚠️ **Security Considerations:**
- The tunnel exposes your local services to the internet
- Ensure your local services (especially PocketBase) have proper authentication
- Consider using Cloudflare Access for additional security layers
- Keep your tunnel credentials (`~/.cloudflared/*.json`) secure and never commit them

⚠️ **Performance:**
- Cloudflare Tunnel adds some latency (typically 20-50ms)
- Your local machine must be running for the tunnel to work
- If your machine goes to sleep, the tunnel will disconnect

⚠️ **Development vs Production:**
- This setup is ideal for development/testing
- For production, consider deploying to a proper hosting service (Vercel, Railway, etc.)

## Troubleshooting

### Tunnel won't start
- Check that the tunnel ID in `config.yml` matches the actual tunnel ID
- Verify credentials file exists at the specified path
- Ensure you're logged in: `cloudflared tunnel login`
- **PM2 "credentials file doesn't exist":** If the tunnel fails when run via PM2, cloudflared may not expand `~`. In `config.yml`, set `credentials-file` to the full path, e.g. `/Users/yourusername/.cloudflared/3f830e84-45e8-43af-bc98-8f44bd61d085.json`

### DNS not resolving
- Wait a few minutes for DNS propagation
- Check Cloudflare dashboard for CNAME records
- Verify domain is using Cloudflare nameservers

### Connection refused
- Ensure your local services are running:
  - Next.js: `npm run dev` (port 3000)
  - PocketBase: `./backend/start_pocketbase.sh` (port 8090)
- Check firewall settings

### View tunnel logs
```bash
cloudflared tunnel info quartapotestas-local
```

## Stopping the Tunnel

Press `Ctrl+C` in the terminal where the tunnel is running, or:

```bash
# If running as a service
cloudflared service uninstall
```

