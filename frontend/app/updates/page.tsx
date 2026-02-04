"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitCommit, Calendar, User, Loader2 } from "lucide-react";
import GameLayout from "@/components/GameLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ServiceStatus from "@/components/ServiceStatus";
import { motion } from "framer-motion";

interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export default function UpdatesPage() {
  const router = useRouter();
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCommits();
  }, []);

  const fetchCommits = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/git-commits");
      if (!response.ok) {
        throw new Error("Failed to fetch updates");
      }
      const data = await response.json();
      setCommits(data.commits || []);
    } catch (err: any) {
      console.error("Error fetching commits:", err);
      setError(err.message || "Failed to load updates");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("nl-NL", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <ProtectedRoute allowGuest={true}>
      <GameLayout
        viewMode="map"
        subtitle="Recent Updates"
        onViewModeChange={() => {}}
        onRefreshScoops={() => {}}
        onOpenShop={() => {}}
      >
        <div className="w-full h-full bg-[#2a1810] paper-texture py-8 px-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <button
                onClick={() => router.back()}
                className="mb-4 flex items-center gap-2 text-[#e8dcc6] hover:text-[#d4af37] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </button>

              <div className="bg-[#f9f6f0] p-6 rounded shadow-2xl border-2 border-[#8b6f47] relative">
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none rounded"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
                  }}
                />
                <div className="relative z-10">
                  <h1 className="text-3xl font-bold text-[#1a0f08] font-serif mb-2">
                    📰 Recent Updates
                  </h1>
                  <p className="text-sm text-[#8b6f47] font-serif">
                    Stay up to date with the latest changes and improvements to Quarta Potestas
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Service Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <ServiceStatus />
            </motion.div>

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-700/50 rounded p-4 text-red-200">
                <p>⚠️ {error}</p>
                <button
                  onClick={fetchCommits}
                  className="mt-2 text-sm underline hover:text-red-100"
                >
                  Try again
                </button>
              </div>
            ) : commits.length === 0 ? (
              <div className="bg-[#f9f6f0] p-6 rounded shadow-lg border-2 border-[#8b6f47] text-center">
                <p className="text-[#8b6f47] font-serif">
                  No updates available at this time.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {commits.map((commit, index) => (
                  <motion.div
                    key={commit.hash}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-[#f9f6f0] p-5 rounded shadow-lg border-2 border-[#8b6f47] relative hover:border-[#d4af37] transition-colors"
                  >
                    <div
                      className="absolute inset-0 opacity-5 pointer-events-none rounded"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
                      }}
                    />
                    <div className="relative z-10">
                      <div className="flex items-start gap-3 mb-3">
                        <GitCommit className="w-5 h-5 text-[#8b6f47] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-[#1a0f08] font-serif mb-2">
                            {commit.message}
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-[#8b6f47]">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(commit.date)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{commit.author}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <code className="bg-[#8b6f47]/20 px-2 py-0.5 rounded font-mono text-[10px]">
                                {commit.hash}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 text-center text-sm text-[#8b6f47]"
            >
              <p className="font-serif">
                Updates are fetched from the Git repository. Last checked: {new Date().toLocaleString("nl-NL")}
              </p>
            </motion.div>
          </div>
        </div>
      </GameLayout>
    </ProtectedRoute>
  );
}

