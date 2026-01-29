#!/bin/bash

echo "🔒 Checking SSL/TLS Security for quartapotestas.com"
echo ""

# Check HTTPS
echo "1. HTTPS Connection:"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://quartapotestas.com)
if [ "$HTTPS_STATUS" = "200" ]; then
    echo "   ✅ HTTPS is working (HTTP $HTTPS_STATUS)"
else
    echo "   ❌ HTTPS not working (HTTP $HTTPS_STATUS)"
fi

# Check HTTP redirect
echo ""
echo "2. HTTP to HTTPS Redirect:"
HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" -L http://quartapotestas.com)
if [ "$HTTP_REDIRECT" = "200" ]; then
    echo "   ⚠️  HTTP is still accessible (should redirect to HTTPS)"
    echo "   → Enable 'Always Use HTTPS' in Cloudflare dashboard"
else
    echo "   ✅ HTTP redirects to HTTPS (HTTP $HTTP_REDIRECT)"
fi

# Check SSL certificate
echo ""
echo "3. SSL Certificate:"
SSL_INFO=$(echo | openssl s_client -connect quartapotestas.com:443 -servername quartapotestas.com 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
if [ -n "$SSL_INFO" ]; then
    echo "   ✅ SSL certificate found"
    echo "$SSL_INFO" | sed 's/^/   /'
else
    echo "   ❌ Could not verify SSL certificate"
fi

# Check security headers
echo ""
echo "4. Security Headers:"
HSTS=$(curl -s -I https://quartapotestas.com | grep -i "strict-transport-security" || echo "")
if [ -n "$HSTS" ]; then
    echo "   ✅ HSTS header present"
else
    echo "   ⚠️  HSTS header missing (will be added by Next.js middleware)"
fi

# Check db subdomain
echo ""
echo "5. Database Subdomain (db.quartapotestas.com):"
DB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://db.quartapotestas.com)
if [ "$DB_STATUS" = "404" ] || [ "$DB_STATUS" = "200" ]; then
    echo "   ✅ HTTPS working (HTTP $DB_STATUS)"
else
    echo "   ⚠️  Status: HTTP $DB_STATUS"
fi

echo ""
echo "📋 Next Steps:"
echo "   1. Go to: https://dash.cloudflare.com"
echo "   2. Select domain: quartapotestas.com"
echo "   3. SSL/TLS → Edge Certificates → Enable 'Always Use HTTPS'"
echo "   4. SSL/TLS → Overview → Set mode to 'Full'"
echo ""

