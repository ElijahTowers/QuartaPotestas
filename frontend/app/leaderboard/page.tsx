"use client";

import { useEffect, useState } from "react";
import { getLeaderboard, LeaderboardEntry } from "@/lib/api";
import GameLayout from "@/components/GameLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ArrowLeft, Loader2, Trophy, Medal, Award, TrendingUp, Users, Star } from "lucide-react";
import toast from "react-hot-toast";
import { formatDutchDate, parseDutchDateTime } from "@/lib/dateUtils";
import { useRouter } from "next/navigation";
import ShopModal from "@/components/ShopModal";

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await getLeaderboard();
        setLeaderboard(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load leaderboard";
        setError(errorMessage);
        console.error("Error loading leaderboard:", err);
        toast.error("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-[#d4af37]" />;
      case 2:
        return <Medal className="w-6 h-6 text-[#c0c0c0]" />;
      case 3:
        return <Award className="w-6 h-6 text-[#cd7f32]" />;
      default:
        return <span className="text-[#8b6f47] font-bold text-lg">#{rank}</span>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <ProtectedRoute allowGuest={true}>
      <GameLayout
        viewMode="map"
        onViewModeChange={() => {}}
        onRefreshScoops={() => {}}
        onOpenShop={() => setIsShopOpen(true)}
      >
        <div className="w-full h-full bg-[#2a1810] paper-texture p-8 overflow-y-auto relative">
          {/* Back button */}
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
            className="fixed top-4 left-4 z-[1000] bg-[#1a0f08] border border-[#8b6f47] text-[#e8dcc6] px-4 py-2 rounded hover:bg-[#2a1810] hover:border-[#d4af37] transition-colors flex items-center gap-2 shadow-lg paper-texture"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-serif">Back</span>
          </button>
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Trophy className="w-10 h-10 text-[#d4af37]" />
                <h1 className="text-4xl font-bold text-[#e8dcc6] font-serif">
                  LEADERBOARD
                </h1>
              </div>
              <p className="text-[#8b6f47] text-lg font-serif">
                Top 5 Newspapers by Profit
              </p>
              {leaderboard.length > 0 && (
                <p className="text-[#8b6f47] text-sm mt-2 font-serif">
                  Latest Edition: {formatDutchDate(parseDutchDateTime(leaderboard[0]?.date))}
                </p>
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
                <p className="ml-4 text-[#e8dcc6] font-serif">Loading leaderboard...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="bg-[#3a2418] border border-red-600/50 rounded-lg p-6 text-center">
                <p className="text-red-400 font-serif">{error}</p>
              </div>
            )}

            {/* Leaderboard Table */}
            {!loading && !error && (
              <div className="space-y-4">
                {leaderboard.length === 0 ? (
                  <div className="bg-[#3a2418] border border-[#8b6f47] rounded-lg p-8 text-center">
                    <p className="text-[#8b6f47] font-serif text-lg">
                      No published editions found yet.
                    </p>
                    <p className="text-[#8b6f47] font-serif text-sm mt-2">
                      Publish your first newspaper to appear on the leaderboard!
                    </p>
                  </div>
                ) : (
                  leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      onClick={() => router.push(`/newspaper?id=${entry.edition_id}&from=leaderboard`)}
                      className={`bg-[#3a2418] border rounded-lg p-6 transition-all ${
                        entry.rank === 1
                          ? "border-[#d4af37] border-2 shadow-lg shadow-[#d4af37]/20"
                          : entry.rank === 2
                          ? "border-[#c0c0c0] border-2"
                          : entry.rank === 3
                          ? "border-[#cd7f32] border-2"
                          : "border-[#8b6f47]"
                      } hover:border-[#d4af37] hover:shadow-lg cursor-pointer`}
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                        {/* Rank */}
                        <div className="flex-shrink-0 w-12 md:w-16 flex items-center justify-center">
                          {getRankIcon(entry.rank)}
                        </div>

                        {/* Newspaper Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl md:text-2xl font-bold text-[#e8dcc6] font-serif mb-1 truncate">
                            {entry.newspaper_name}
                          </h3>
                          <p className="text-[#8b6f47] font-serif text-xs md:text-sm truncate">
                            {entry.user_email}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-6 w-full md:w-auto">
                          {/* Profit */}
                          <div className="text-left md:text-right flex-1 md:flex-none">
                            <div className="flex items-center gap-2 text-[#d4af37]">
                              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="text-lg md:text-2xl font-bold font-serif">
                                {formatCurrency(entry.profit)}
                              </span>
                            </div>
                            <p className="text-[#8b6f47] text-xs font-serif mt-1">Profit</p>
                          </div>

                          {/* Readers */}
                          <div className="text-left md:text-right flex-1 md:flex-none">
                            <div className="flex items-center gap-2 text-[#e8dcc6]">
                              <Users className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="text-base md:text-xl font-bold font-serif">
                                {entry.readers.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[#8b6f47] text-xs font-serif mt-1">Readers</p>
                          </div>

                          {/* Credibility */}
                          <div className="text-left md:text-right flex-1 md:flex-none">
                            <div className="flex items-center gap-2 text-[#e8dcc6]">
                              <Star className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="text-base md:text-xl font-bold font-serif">
                                {entry.credibility.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-[#8b6f47] text-xs font-serif mt-1">Credibility</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
      </GameLayout>
    </ProtectedRoute>
  );
}

