"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import GameLayout from "@/components/GameLayout";
import { getActualApiUrl } from "@/lib/api";
import { getPocketBase } from "@/lib/pocketbase";
import { Loader2, Rss, ExternalLink, RefreshCw } from "lucide-react";

const ALLOWED_EMAIL = "lowiehartjes@gmail.com".toLowerCase();
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

interface BbcItem {
  title: string;
  link: string;
  summary: string;
  published: string;
  published_at: string;
  source: string;
}

export default function DebugPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BbcItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [, setTick] = useState(0); // Force re-render every minute for countdown

  const isAdmin = isAuthenticated && (user?.email?.toLowerCase() === ALLOWED_EMAIL);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?redirect=/debug");
      return;
    }
    if (!authLoading && isAuthenticated && !isAdmin) {
      router.replace("/");
      return;
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchBbcRss = async () => {
      try {
        setLoading(true);
        setError(null);
        const pb = getPocketBase();
        const token = pb.authStore.token;
        if (!token) {
          setError("Not authenticated");
          return;
        }

        const res = await fetch(getActualApiUrl("/api/debug/bbc-rss"), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch: ${res.status} ${text.slice(0, 100)}`);
        }

        const data = await res.json();
        setItems(data.items || []);
        setNextRefreshAt(new Date(Date.now() + REFRESH_INTERVAL_MS));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load feed");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBbcRss();
    const interval = setInterval(fetchBbcRss, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Update countdown every minute
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!isAdmin) {
    return null;
  }

  return (
    <GameLayout
      viewMode="grid"
      onViewModeChange={() => {}}
      onRefreshScoops={() => {}}
      onOpenShop={() => {}}
      subtitle="Debug: BBC World RSS"
    >
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex flex-col gap-2 mb-6 pb-4 border-b border-[#8b6f47]">
          <div className="flex items-center gap-2">
            <Rss className="w-6 h-6 text-[#d4af37]" />
            <h1 className="text-xl font-bold text-[#e8dcc6] font-serif">
              BBC World RSS Feed
            </h1>
          </div>
          {nextRefreshAt && !loading && (
            <p className="text-sm text-[#8b6f47] flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Volgende refresh om {nextRefreshAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
              {" "}(over {Math.max(0, Math.ceil((nextRefreshAt.getTime() - Date.now()) / 60_000))} min)
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700/50 rounded text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-[#8b6f47]">No items in feed.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="space-y-4">
            {items.map((item, i) => (
              <li
                key={i}
                className="bg-[#2a1810] border border-[#8b6f47] rounded-lg p-4 hover:border-[#d4af37] transition-colors"
              >
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <h2 className="font-bold text-[#e8dcc6] font-serif group-hover:text-[#d4af37] transition-colors flex items-start gap-2">
                    {item.title}
                    <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#8b6f47] group-hover:text-[#d4af37]" />
                  </h2>
                </a>
                {item.published && (
                  <p className="text-xs text-[#8b6f47] mt-1">{item.published}</p>
                )}
                {item.summary && (
                  <p className="text-sm text-[#e8dcc6]/80 mt-2 line-clamp-3">
                    {item.summary.replace(/<[^>]*>/g, "")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </GameLayout>
  );
}
