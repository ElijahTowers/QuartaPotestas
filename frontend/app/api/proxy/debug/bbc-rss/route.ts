/**
 * Debug: BBC World RSS feed. Admin only (lowiehartjes@gmail.com).
 * Fetches RSS directly to avoid backend dependency.
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EMAIL = "lowiehartjes@gmail.com".toLowerCase();
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const BBC_RSS_URL = "https://feeds.bbci.co.uk/news/world/rss.xml";

type ValidateResult = { allowed: true } | { allowed: false; reason: string };

async function validateAdmin(req: NextRequest): Promise<ValidateResult> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return { allowed: false, reason: "no_token" };
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { allowed: false, reason: `auth_${res.status}` };
    const user = await res.json();
    const email = (user?.email as string)?.toLowerCase();
    if (email !== ALLOWED_EMAIL) return { allowed: false, reason: "not_admin" };
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "auth_failed" };
  }
}

interface RssItem {
  title: string;
  link: string;
  summary: string;
  published: string;
  published_at: string;
  source: string;
}

function parseRssXml(xml: string, limit: number): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1]
      ?? block.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
    const link = block.match(/<link>([^<]*)<\/link>/i)?.[1] ?? "";
    const desc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1]
      ?? block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const pub = block.match(/<pubDate>([^<]*)<\/pubDate>/i)?.[1] ?? "";
    items.push({
      title: (title || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      link: (link || "").trim(),
      summary: (desc || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&"),
      published: (pub || "").trim(),
      published_at: pub || "",
      source: "BBC News World",
    });
  }
  // Sort newest first by GMT pubDate
  items.sort((a, b) => {
    const tA = a.published_at ? Date.parse(a.published_at) : 0;
    const tB = b.published_at ? Date.parse(b.published_at) : 0;
    return tB - tA;
  });
  return items.slice(0, limit);
}

export async function GET(req: NextRequest) {
  const result = await validateAdmin(req);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Forbidden", reason: result.reason },
      { status: 403 }
    );
  }

  try {
    const res = await fetch(BBC_RSS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "QuartaPotestas-Debug/1.0" },
    });
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
    const xml = await res.text();
    const items = parseRssXml(xml, 50);
    return NextResponse.json({ items, source: BBC_RSS_URL });
  } catch (e) {
    console.error("[api/proxy/debug/bbc-rss]", e);
    return NextResponse.json(
      { error: "Failed to fetch RSS", items: [] },
      { status: 500 }
    );
  }
}
