# Update DNS to New Tunnel (one-time)

The tunnel on this Mac mini uses a **new** tunnel ID. Existing DNS records still point to the old tunnel. Update them once:

## In Cloudflare Dashboard

1. Go to **https://dash.cloudflare.com** → select **quartapotestas.com**
2. Open **DNS** → **Records**
3. For each of these names, **edit** the CNAME record and set the target to:
   **`38c6c8b1-f17d-4131-b1d6-b7ab7b4d0249.cfargotunnel.com`**

   | Type | Name | Target (update to) |
   |------|------|--------------------|
   | CNAME | @ (or quartapotestas.com) | 38c6c8b1-f17d-4131-b1d6-b7ab7b4d0249.cfargotunnel.com |
   | CNAME | www | 38c6c8b1-f17d-4131-b1d6-b7ab7b4d0249.cfargotunnel.com |
   | CNAME | db | 38c6c8b1-f17d-4131-b1d6-b7ab7b4d0249.cfargotunnel.com |

4. Save. After a short delay, https://quartapotestas.com/ will use this Mac mini’s tunnel.

## Or via API

If you use the Cloudflare API, update the CNAME records for the zone so the target is `38c6c8b1-f17d-4131-b1d6-b7ab7b4d0249.cfargotunnel.com`.
