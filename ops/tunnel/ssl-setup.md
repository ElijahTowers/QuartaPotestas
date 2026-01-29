# SSL/TLS Security Setup for Quarta Potestas

## Cloudflare Dashboard Configuration

To ensure your site is fully secure, configure the following in your Cloudflare dashboard:

### 1. Enable "Always Use HTTPS"

1. Go to your Cloudflare dashboard: https://dash.cloudflare.com
2. Select your domain: `quartapotestas.com`
3. Navigate to **SSL/TLS** → **Edge Certificates**
4. Enable **"Always Use HTTPS"** toggle
   - This automatically redirects all HTTP traffic to HTTPS

### 2. Set SSL/TLS Encryption Mode

1. In **SSL/TLS** → **Overview**
2. Set **SSL/TLS encryption mode** to **"Full"** or **"Full (strict)"**
   - **Full**: Encrypts end-to-end, allows self-signed certificates
   - **Full (strict)**: Encrypts end-to-end, requires valid certificates (recommended)
   - Since Cloudflare Tunnel handles certificates automatically, **"Full"** is sufficient

### 3. Enable Automatic HTTPS Rewrites

1. In **SSL/TLS** → **Edge Certificates**
2. Enable **"Automatic HTTPS Rewrites"**
   - This rewrites HTTP links in your HTML to HTTPS

### 4. Enable HSTS (HTTP Strict Transport Security)

1. In **SSL/TLS** → **Edge Certificates**
2. Enable **"Always Use HTTPS"** (already done above)
3. Optionally enable **"HSTS"** for additional security
   - This tells browsers to always use HTTPS for your domain

### 5. Configure Page Rules (Optional)

If you want more control, create Page Rules:

1. Go to **Rules** → **Page Rules**
2. Create a rule:
   - **URL**: `http://*quartapotestas.com/*`
   - **Setting**: Forwarding URL
   - **Status Code**: 301 (Permanent Redirect)
   - **Destination URL**: `https://$1quartapotestas.com/$2`

## Verification

After configuring, verify:

```bash
# Should redirect to HTTPS
curl -I http://quartapotestas.com

# Should return HTTPS
curl -I https://quartapotestas.com
```

## Current Status

- ✅ HTTPS is working (certificates provided by Cloudflare)
- ⚠️ HTTP redirects need to be enabled in Cloudflare dashboard
- ⚠️ SSL/TLS mode should be set to "Full"

