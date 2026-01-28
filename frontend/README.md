This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

**From the root directory:**
```bash
npm run dev
```

**Or from the frontend directory:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 🚀 Sharing the Game (Public URL)

You can easily expose your local game to the internet using Cloudflare Quick Tunnels, perfect for testing on mobile devices or sharing with friends.

### Prerequisites

First, install **cloudflared** on your Mac:

```bash
brew install cloudflared
```

### Running the Public Tunnel

You'll need **two terminal windows** open:

**Terminal 1** - Start the development server:
```bash
npm run dev
```

**Terminal 2** - Start the Cloudflare tunnel for the frontend:
```bash
npm run broadcast
```
Copy the `.trycloudflare.com` URL that appears (e.g., `https://autumn-shared-jackets-edgar.trycloudflare.com`)

**Note:** Cloudflare quick tunnels can expire or disconnect. If the public URL stops working, simply restart the tunnel (Ctrl+C and run `npm run broadcast` again) to get a new URL.

**Terminal 3** - Start the Cloudflare tunnel for PocketBase (required for authentication):
```bash
npm run broadcast:pb
```
Copy the `.trycloudflare.com` URL that appears (e.g., `https://pocketbase-xyz.trycloudflare.com`)

**Terminal 4** - Configure the PocketBase URL:
Create a `.env.local` file in the `frontend/` directory with the PocketBase tunnel URL:

```bash
cd frontend
echo "NEXT_PUBLIC_POCKETBASE_URL=https://pocketbase-xyz.trycloudflare.com" > .env.local
```

Replace `pocketbase-xyz.trycloudflare.com` with the actual URL from Terminal 3.

**Important:** After creating `.env.local`, you must restart the frontend server (Terminal 1) for the changes to take effect.

**Example:**
- Frontend URL: `https://autumn-shared-jackets-edgar.trycloudflare.com` (share this)
- PocketBase URL: `https://pocketbase-xyz.trycloudflare.com` (set in `.env.local`)

**Example output:**
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://random-name-1234.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Simply share this URL with anyone you want to test the game with!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
