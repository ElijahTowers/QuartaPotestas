/**
 * Proxy to backend RSS poll status. Admin only (same as /api/monitor).
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EMAIL = "lowiehartjes@gmail.com".toLowerCase();
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

type ValidateResult = { allowed: true } | { allowed: false; reason: string };

async function validateAdmin(req: NextRequest): Promise<ValidateResult> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    console.warn("[api/monitor/rss-poll-status] Access denied: no Authorization Bearer token in request");
    return { allowed: false, reason: "no_token" };
  }
  console.log("[api/monitor/rss-poll-status] Validating admin via backend /api/auth/me, token length:", token.length);
  try {
    // Use backend /api/auth/me (same as AuthContext) – backend knows how to talk to PocketBase
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn("[api/monitor/rss-poll-status] Access denied: backend /api/auth/me returned", res.status, "body:", body.slice(0, 200));
      return { allowed: false, reason: `backend_error_${res.status}` };
    }
    const user = await res.json();
    const email = (user?.email as string)?.toLowerCase();
    if (email !== ALLOWED_EMAIL) {
      console.warn("[api/monitor/rss-poll-status] Access denied: email not allowed, got:", email ?? "(no email)");
      return { allowed: false, reason: "not_admin" };
    }
    console.log("[api/monitor/rss-poll-status] Admin validated:", email);
    return { allowed: true };
  } catch (e) {
    console.warn("[api/monitor/rss-poll-status] Access denied: fetch to backend failed", e);
    return { allowed: false, reason: "fetch_failed" };
  }
}

export async function GET(req: NextRequest) {
  const result = await validateAdmin(req);
  if (!result.allowed) {
    console.warn("[api/monitor/rss-poll-status] GET returning 403 Forbidden, reason:", result.reason);
    return NextResponse.json(
      { error: "Forbidden", reason: result.reason },
      { status: 403 }
    );
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/debug/rss-poll-status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ...data, error: data?.detail || data?.error || "Backend error", enabled: false, backend_status: res.status },
        { status: 200 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[api/monitor/rss-poll-status] Backend unreachable:", e);
    // Return 200 with fallback so monitor page can show message instead of breaking
    return NextResponse.json({
      enabled: false,
      error: "Backend niet bereikbaar",
      backend_unreachable: true,
      interval_minutes: 30,
      next_run_at: null,
      scheduled_runs: [],
      run_history: [],
      last_run_started_at: null,
      last_run_finished_at: null,
      last_run_result: null,
      last_run_error: null,
      last_run_log: [],
    });
  }
}
