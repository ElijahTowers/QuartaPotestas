"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameContext";
import GameLayout from "@/components/GameLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ShopModal from "@/components/ShopModal";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";

interface PublishedEdition {
  id: string;
  date: string;
  newspaper_name: string;
  stats: {
    cash: number;
    credibility: number;
    readers: number;
  };
  created: string;
}

export default function ArchivesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setNewspaperName } = useGame();
  const [editions, setEditions] = useState<PublishedEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);

  useEffect(() => {
    const fetchEditions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get token from localStorage or auth context
        let token: string | null = null;
        try {
          const { getPocketBase } = await import("@/lib/pocketbase");
          const pb = getPocketBase();
          token = pb.authStore.token;
        } catch (e) {
          token = localStorage.getItem("token");
        }

        if (!token) {
          throw new Error("Not authenticated");
        }

        // Use the proper API URL based on where we're accessing from
        let apiUrl: string;
        if (typeof window !== "undefined") {
          const hostname = window.location.hostname;
          // Use API proxy for production domain or Cloudflare tunnels
          if (hostname === "quartapotestas.com" || hostname === "www.quartapotestas.com" || hostname.includes("trycloudflare.com")) {
            apiUrl = "/api/proxy/published-editions";
          } else if (hostname === "localhost" || hostname === "127.0.0.1") {
            apiUrl = "http://localhost:8000/api/published-editions";
          } else {
            apiUrl = `http://${hostname}:8000/api/published-editions`;
          }
        } else {
          apiUrl = "http://localhost:8000/api/published-editions";
        }

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          credentials: "omit",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch editions: ${response.statusText}`);
        }

        const data = await response.json();
        setEditions(data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load archives";
        setError(message);
        console.error("Archives error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEditions();
  }, []);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("nl-NL", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ProtectedRoute allowGuest={true}>
      <div className="h-screen flex overflow-hidden bg-[#2a1810]">
        <GameLayout
          viewMode="map"
          onViewModeChange={(mode) => {
            if (mode === "map") router.push("/");
            if (mode === "grid") router.push("/editor");
          }}
          onRefreshScoops={() => {}}
          onOpenShop={() => setIsShopOpen(true)}
          isRefreshing={false}
          refreshError={null}
          refreshProgress=""
          subtitle="Archives"
        >
          <div className="min-h-full bg-[#2c1b12] relative overflow-auto">
            {/* Wood texture background */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='wood'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04 0.8' numOctaves='4'/%3E%3CfeColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.1 0 0 0 0 0.05 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23wood)'/%3E%3C/svg%3E")`,
                backgroundSize: "200px 200px",
              }}
            />

            {/* Vignette overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)",
              }}
            />

            {/* Main Content */}
            <div className="relative z-10 container mx-auto px-6 py-12">
              {/* Page Title */}
              <h1 className="text-4xl font-bold text-[#e8dcc6] font-serif mb-8 text-center">
                ARCHIVES
              </h1>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center min-h-96">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mx-auto mb-4" />
                    <p className="text-[#8b6f47]">Loading your published editions...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-2xl mx-auto bg-red-900/20 border border-red-600 rounded p-6"
                >
                  <p className="text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Empty State */}
              {!loading && !error && editions.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-2xl mx-auto bg-[#f9f6f0] p-12 rounded shadow-2xl border-2 border-[#8b6f47] text-center"
                >
                  <p className="text-[#8b6f47] mb-4">No published editions yet.</p>
                  <button
                    onClick={() => router.push("/editor")}
                    className="px-6 py-2 bg-[#d4af37] text-[#1a0f08] font-bold rounded hover:bg-[#e5c04a] transition-colors"
                  >
                    Create Your First Edition
                  </button>
                </motion.div>
              )}

              {/* Editions Grid */}
              {!loading && !error && editions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
                >
                  {editions.map((edition, index) => (
                    <motion.div
                      key={edition.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative cursor-pointer group"
                      onClick={() => router.push(`/archives/${edition.id}`)}
                    >
                      <div
                        className="bg-[#f9f6f0] p-6 rounded shadow-2xl border-2 border-[#8b6f47] h-full flex flex-col transition-transform group-hover:shadow-3xl group-hover:scale-105"
                        style={{
                          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                        }}
                      >
                        {/* Aged paper texture */}
                        <div
                          className="absolute inset-0 opacity-10 pointer-events-none rounded"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
                          }}
                        />

                        <div className="relative z-10 flex flex-col h-full">
                          {/* Date */}
                          <p className="text-xs text-[#8b6f47] uppercase tracking-wider mb-2">
                            {formatDate(edition.date)}
                          </p>

                          {/* Newspaper Name */}
                          <h3 className="text-2xl font-bold text-[#1a0f08] font-serif mb-4 flex-shrink-0">
                            {edition.newspaper_name}
                          </h3>

                          {/* Stats */}
                          <div className="flex-grow border-t border-[#8b6f47] pt-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-[#8b6f47] mb-1">Revenue</p>
                                <p className="font-bold text-[#1a0f08]">
                                  ${edition.stats.cash.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-[#8b6f47] mb-1">Readers</p>
                                <p className="font-bold text-[#1a0f08]">
                                  {(edition.stats.readers / 1000).toFixed(1)}K
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-[#8b6f47] mb-1">Credibility</p>
                                <p className="font-bold text-[#1a0f08]">
                                  {edition.stats.credibility.toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
        </GameLayout>
      </div>
    </ProtectedRoute>
  );
}

