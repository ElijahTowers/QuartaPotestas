"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getActualApiUrl, getIngestionJobStatus } from "@/lib/api";
import { getPocketBase } from "@/lib/pocketbase";
import {
  Activity,
  Server,
  Database,
  Cloud,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Rss,
  Clock,
  FileText,
  Play,
} from "lucide-react";

const ALLOWED_EMAIL = "lowiehartjes@gmail.com".toLowerCase();

interface Pm2Process {
  name?: string;
  pid?: number;
  pm_id?: number;
  monit?: { memory?: number; cpu?: number };
  pm2_env?: { status?: string; restart_time?: number };
  status?: string;
}

interface MonitorData {
  pm2: Pm2Process[];
  services: {
    backend: { ok: boolean; ms?: number };
    pocketbase: { ok: boolean; ms?: number };
  };
  at: string;
}

interface RssRunHistoryEntry {
  started_at: string;
  finished_at: string;
  success: boolean;
  articles_processed?: number;
  status?: string;
  duration_seconds?: number;
  error?: string;
}

interface RssPollStatus {
  enabled: boolean;
  interval_minutes: number;
  next_run_at: string | null;
  scheduled_runs?: string[];
  run_history?: RssRunHistoryEntry[];
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_run_result: Record<string, unknown> | null;
  last_run_error: string | null;
  last_run_log: string[];
  error?: string;
  backend_unreachable?: boolean;
}

export default function MonitorPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rssPoll, setRssPoll] = useState<RssPollStatus | null>(null);
  const [rssPollLoading, setRssPollLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [liveJobId, setLiveJobId] = useState<string | null>(null);
  const [liveJobStatus, setLiveJobStatus] = useState<{
    status?: string;
    progress?: string;
    steps?: { ts: string; message: string }[];
    error?: string;
    result?: Record<string, unknown>;
  } | null>(null);

  const isAdmin = isAuthenticated && (user?.email?.toLowerCase() === ALLOWED_EMAIL);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?redirect=/monitor");
      return;
    }
    if (!authLoading && isAuthenticated && !isAdmin) {
      router.replace("/");
      return;
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const fetchMonitor = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const pb = getPocketBase();
      const token = pb.authStore.token;
      if (!token) {
        setError("Not logged in");
        return;
      }
      const res = await fetch("/api/monitor", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        const reason = (body as { reason?: string }).reason;
        setError(reason ? `Access denied: ${reason}` : "Access denied");
        return;
      }
      if (!res.ok) {
        setError(`Error ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const fetchRssPollStatus = async () => {
    if (!isAdmin) return;
    setRssPollLoading(true);
    try {
      const pb = getPocketBase();
      const token = pb.authStore.token;
      if (!token) return;
      // Same path as "Fetch new scoops": client -> proxy -> backend (getActualApiUrl)
      const res = await fetch(getActualApiUrl("/api/debug/rss-poll-status"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setRssPoll(json);
      } else {
        setRssPoll(null);
      }
    } catch {
      setRssPoll(null);
    } finally {
      setRssPollLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchMonitor();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchRssPollStatus();
    const interval = setInterval(fetchRssPollStatus, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // When a scheduled run is in progress, poll rss-poll-status more often for live log
  const scheduledRunInProgress =
    !!rssPoll?.last_run_started_at && !rssPoll?.last_run_finished_at;
  useEffect(() => {
    if (!isAdmin || !scheduledRunInProgress) return;
    const t = setInterval(fetchRssPollStatus, 2_000);
    return () => clearInterval(t);
  }, [isAdmin, scheduledRunInProgress]);

  const triggerIngestNow = async () => {
    if (!isAdmin) return;
    const pb = getPocketBase();
    const token = pb.authStore.token;
    if (!token) {
      setTriggerError("Niet ingelogd");
      return;
    }
    setTriggerLoading(true);
    setTriggerError(null);
    setLiveJobStatus(null);
    try {
      const res = await fetch(getActualApiUrl("/api/debug/trigger-ingest"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        setTriggerError(res.status === 403 ? "Alleen admin" : `Fout ${res.status}: ${text.slice(0, 100)}`);
        return;
      }
      const { job_id } = await res.json();
      if (!job_id) {
        setTriggerError("Geen job_id ontvangen");
        return;
      }
      setLiveJobId(job_id);
      const pollInterval = 2000;
      const maxWait = 10 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        const status = await getIngestionJobStatus(job_id);
        setLiveJobStatus(status);
        if (status.status === "completed") {
          await fetchRssPollStatus();
          return;
        }
        if (status.status === "failed") {
          setTriggerError(status.error ?? "Ingest mislukt");
          await fetchRssPollStatus();
          return;
        }
        await new Promise((r) => setTimeout(r, pollInterval));
      }
      setTriggerError("Timeout na 10 minuten");
      await fetchRssPollStatus();
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "Request mislukt");
    } finally {
      setTriggerLoading(false);
    }
  };

  if (authLoading || (!isAdmin && isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f6f0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8b6f47]" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const formatMem = (bytes?: number) =>
    bytes != null ? `${Math.round(bytes / 1024 / 1024)} MB` : "—";
  const statusColor = (status?: string) =>
    status === "online" ? "text-green-600" : "text-red-600";

  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden bg-[#f9f6f0] p-6 text-[#1a1a1a]">
      <div className="max-w-4xl mx-auto pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="w-6 h-6 text-[#8b6f47]" />
            System monitor
          </h1>
          <button
            onClick={fetchMonitor}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#8b6f47] text-[#f4e4bc] rounded hover:bg-[#a68a5a] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded text-red-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <section className="mb-6 p-4 bg-white rounded-lg shadow border border-[#8b6f47]/20">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                PM2 processes
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#8b6f47]/30">
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">ID</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">CPU</th>
                      <th className="text-left py-2">Memory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pm2 || []).map((proc: Pm2Process, i: number) => (
                      <tr key={i} className="border-b border-[#8b6f47]/10">
                        <td className="py-2 font-medium">{proc.name ?? "—"}</td>
                        <td className="py-2">{proc.pm_id ?? "—"}</td>
                        <td className={`py-2 ${statusColor(proc.pm2_env?.status ?? proc.status)}`}>
                          {proc.pm2_env?.status ?? proc.status ?? "—"}
                        </td>
                        <td className="py-2">{proc.monit?.cpu ?? "—"}%</td>
                        <td className="py-2">{formatMem(proc.monit?.memory)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.at && (
                <p className="text-xs text-gray-500 mt-2">Updated: {new Date(data.at).toLocaleString()}</p>
              )}
            </section>

            <section className="mb-6 p-4 bg-white rounded-lg shadow border border-[#8b6f47]/20">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Rss className="w-5 h-5" />
                RSS poll (ingest)
              </h2>
              {rssPollLoading && !rssPoll && (
                <div className="flex items-center gap-2 text-gray-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              )}
              {rssPoll && (
                <div className="space-y-3 text-sm">
                  {(rssPoll.backend_unreachable || rssPoll.error) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800">
                      <strong>Let op:</strong> {rssPoll.error ?? "Backend niet bereikbaar"}. Controleer of de backend draait (<code className="bg-amber-100 px-1 rounded">pm2 status</code>) en of <code className="bg-amber-100 px-1 rounded">BACKEND_URL</code> in de frontend-omgeving klopt.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className="flex items-center gap-1">
                      <strong>Status:</strong>{" "}
                      {rssPoll.enabled ? (
                        <span className="text-green-600">Aan</span>
                      ) : (
                        <span className="text-gray-500">Uit</span>
                      )}
                    </span>
                    {rssPoll.enabled && (
                      <>
                        <span className="flex items-center gap-1">
                          <strong>Interval:</strong> {rssPoll.interval_minutes} min
                        </span>
                        {rssPoll.next_run_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <strong>Volgende run:</strong>{" "}
                            {new Date(rssPoll.next_run_at).toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={triggerIngestNow}
                      disabled={triggerLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8b6f47] text-[#f4e4bc] rounded text-xs font-medium hover:bg-[#a68a5a] disabled:opacity-50"
                    >
                      {triggerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Nu uitvoeren
                    </button>
                  </div>
                  {triggerError && (
                    <p className="text-red-600 text-xs">{triggerError}</p>
                  )}

                  {/* Live run (Nu uitvoeren): stap-voor-stap tijdens en na de run */}
                  {liveJobId && (
                    <div className="rounded border border-[#8b6f47]/30 bg-[#f9f6f0] p-3">
                      <strong className="block mb-2 flex items-center gap-1">
                        <Loader2
                          className={
                            liveJobStatus?.status === "running" || liveJobStatus?.status === "pending"
                              ? "w-4 h-4 animate-spin"
                              : "w-4 h-4"
                          }
                        />
                        {liveJobStatus?.status === "completed"
                          ? "Laatste run (Nu uitvoeren) — klaar"
                          : liveJobStatus?.status === "failed"
                            ? "Laatste run (Nu uitvoeren) — mislukt"
                            : "Live run (Nu uitvoeren)"}
                      </strong>
                      {liveJobStatus?.steps && liveJobStatus.steps.length > 0 ? (
                        <ul className="text-sm space-y-1 max-h-48 overflow-y-auto font-mono list-none pl-0">
                          {liveJobStatus.steps.map((s, i) => (
                            <li key={i} className="flex gap-2 text-gray-700">
                              <span className="text-gray-400 shrink-0">
                                {s.ts ? new Date(s.ts).toLocaleTimeString("nl-NL") : ""}
                              </span>
                              <span>{s.message}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          {liveJobStatus?.progress ?? "Wachten op stappen…"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Live run (gepland): stap-voor-stap tijdens geplande run */}
                  {scheduledRunInProgress && rssPoll?.last_run_log && rssPoll.last_run_log.length > 0 && (
                    <div className="rounded border border-[#8b6f47]/30 bg-[#f0ebe0] p-3">
                      <strong className="block mb-2 flex items-center gap-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Live run (gepland)
                      </strong>
                      <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto p-0 m-0">
                        {rssPoll.last_run_log.join("\n")}
                      </pre>
                    </div>
                  )}

                  <div>
                    <strong className="block mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Geplande fetch-activiteiten
                    </strong>
                    {!rssPoll.enabled ? (
                      <p className="text-gray-500 text-sm">
                        RSS-poll staat uit. Zet <code className="bg-gray-100 px-1 rounded">RSS_POLL_ENABLED=true</code> in <code className="bg-gray-100 px-1 rounded">backend/.env</code> en herstart de backend om geplande runs te zien.
                      </p>
                    ) : rssPoll.scheduled_runs && rssPoll.scheduled_runs.length > 0 ? (
                      <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                        {rssPoll.scheduled_runs.slice(0, 10).map((at, i) => (
                          <li key={i}>{new Date(at).toLocaleString()}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        Geen geplande runs (scheduler wordt geladen of net gestart). Vernieuw over een paar seconden.
                      </p>
                    )}
                  </div>

                  <div>
                    <strong className="block mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Uitgevoerde runs
                    </strong>
                    {rssPoll.run_history && rssPoll.run_history.length > 0 ? (
                      <div className="overflow-x-auto border border-[#8b6f47]/20 rounded">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[#8b6f47]/30 bg-[#f9f6f0]">
                              <th className="text-left py-1.5 px-2">Gestart</th>
                              <th className="text-left py-1.5 px-2">Klaar</th>
                              <th className="text-left py-1.5 px-2">Duur</th>
                              <th className="text-left py-1.5 px-2">Resultaat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rssPoll.run_history.map((run, i) => (
                              <tr key={i} className="border-b border-[#8b6f47]/10">
                                <td className="py-1.5 px-2">
                                  {new Date(run.started_at).toLocaleString()}
                                </td>
                                <td className="py-1.5 px-2">
                                  {run.finished_at
                                    ? new Date(run.finished_at).toLocaleString()
                                    : "—"}
                                </td>
                                <td className="py-1.5 px-2">
                                  {run.duration_seconds != null
                                    ? `${run.duration_seconds}s`
                                    : "—"}
                                </td>
                                <td className="py-1.5 px-2">
                                  {run.success ? (
                                    <span className="text-green-600">
                                      {run.articles_processed ?? 0} nieuwe artikelen
                                      {run.status ? ` (${run.status})` : ""}
                                    </span>
                                  ) : (
                                    <span className="text-red-600">
                                      Fout: {run.error ?? "—"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        {rssPoll.enabled
                          ? "Nog geen uitgevoerde runs. De eerste run volgt na het ingestelde interval (bijv. 30 min)."
                          : "RSS-poll staat uit. Schakel in om uitgevoerde runs te zien."}
                      </p>
                    )}
                  </div>

                  {(rssPoll.last_run_started_at || rssPoll.last_run_finished_at) && (
                    <div className="flex flex-wrap gap-4 text-gray-600">
                      {rssPoll.last_run_started_at && (
                        <span>
                          Laatste run gestart:{" "}
                          {new Date(rssPoll.last_run_started_at).toLocaleString()}
                        </span>
                      )}
                      {rssPoll.last_run_finished_at && (
                        <span>
                          Laatste run klaar:{" "}
                          {new Date(rssPoll.last_run_finished_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  {rssPoll.last_run_error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">
                      Fout: {rssPoll.last_run_error}
                    </div>
                  )}
                  {rssPoll.last_run_result && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-4 h-4 text-[#8b6f47]" />
                      <span>
                        Resultaat: {String(rssPoll.last_run_result.articles_processed ?? "—")} nieuwe
                        artikelen, status: {String(rssPoll.last_run_result.status ?? "—")}
                      </span>
                      {rssPoll.last_run_result.timing_stats &&
                        typeof rssPoll.last_run_result.timing_stats === "object" &&
                        "total_seconds" in rssPoll.last_run_result.timing_stats && (
                          <span className="text-gray-500">
                            ({String((rssPoll.last_run_result.timing_stats as { total_seconds?: number }).total_seconds)}s)
                          </span>
                        )}
                    </div>
                  )}
                  {rssPoll.last_run_log && rssPoll.last_run_log.length > 0 && (
                    <div>
                      <strong className="block mb-1">Log (laatste run):</strong>
                      <pre className="p-3 bg-gray-50 border border-[#8b6f47]/20 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                        {rssPoll.last_run_log.join("\n")}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="p-4 bg-white rounded-lg shadow border border-[#8b6f47]/20">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Server className="w-5 h-5" />
                Services
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between p-3 rounded border border-[#8b6f47]/20">
                  <span className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#8b6f47]" />
                    PocketBase
                  </span>
                  {data.services.pocketbase.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between p-3 rounded border border-[#8b6f47]/20">
                  <span className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-[#8b6f47]" />
                    FastAPI Backend
                  </span>
                  {data.services.backend.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
