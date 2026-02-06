/**
 * Monitor API: PM2 status + service health. Only for lowiehartjes@gmail.com.
 * Request must include: Authorization: Bearer <PocketBase token>
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

const ALLOWED_EMAIL = "lowiehartjes@gmail.com".toLowerCase();
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

type ValidateResult = { allowed: true } | { allowed: false; reason: string };

async function validateAdmin(req: NextRequest): Promise<ValidateResult> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    console.warn("[api/monitor] Access denied: no Authorization Bearer token in request");
    return { allowed: false, reason: "no_token" };
  }
  console.log("[api/monitor] Validating admin via backend /api/auth/me, token length:", token.length);
  try {
    // Use backend /api/auth/me (same as AuthContext) – backend knows how to talk to PocketBase
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn("[api/monitor] Access denied: backend /api/auth/me returned", res.status, "body:", body.slice(0, 200));
      return { allowed: false, reason: `backend_error_${res.status}` };
    }
    const user = await res.json();
    const email = (user?.email as string)?.toLowerCase();
    if (email !== ALLOWED_EMAIL) {
      console.warn("[api/monitor] Access denied: email not allowed, got:", email ?? "(no email)");
      return { allowed: false, reason: "not_admin" };
    }
    console.log("[api/monitor] Admin validated:", email);
    return { allowed: true };
  } catch (e) {
    console.warn("[api/monitor] Access denied: fetch to backend failed", e);
    return { allowed: false, reason: "fetch_failed" };
  }
}

async function getPm2List(): Promise<unknown> {
  try {
    const out = execSync("pm2 jlist", { encoding: "utf-8", timeout: 5000 });
    return JSON.parse(out || "[]");
  } catch {
    return [];
  }
}

async function getServiceHealth(): Promise<{
  backend: { ok: boolean; ms?: number };
  pocketbase: { ok: boolean; ms?: number };
}> {
  const start = Date.now();
  let backend = { ok: false, ms: 0 };
  let pocketbase = { ok: false, ms: 0 };
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const pbUrl = process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

  try {
    const [backendRes, pbRes] = await Promise.all([
      fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${pbUrl}/api/health`, { signal: AbortSignal.timeout(3000) }).catch(() => fetch(`${pbUrl}/`, { signal: AbortSignal.timeout(3000) })),
    ]);
    backend = { ok: backendRes.ok, ms: Date.now() - start };
    pocketbase = { ok: pbRes.ok || pbRes.status === 404, ms: Date.now() - start };
  } catch {
    // leave ok: false
  }
  return { backend, pocketbase };
}

export async function GET(req: NextRequest) {
  const result = await validateAdmin(req);
  if (!result.allowed) {
    console.warn("[api/monitor] GET returning 403 Forbidden, reason:", result.reason);
    return NextResponse.json(
      { error: "Forbidden", reason: result.reason },
      { status: 403 }
    );
  }

  try {
    const [pm2List, services] = await Promise.all([getPm2List(), getServiceHealth()]);
    return NextResponse.json({
      pm2: Array.isArray(pm2List) ? pm2List : [],
      services,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Monitor API error:", e);
    return NextResponse.json({ error: "Monitor failed" }, { status: 500 });
  }
}
