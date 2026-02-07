"use client";

import React, { useState } from "react";
import { useAchievements } from "@/context/AchievementsContext";
import { X, Trophy, Star, Award, Zap, Crown, Filter, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AchievementsProps {
  isOpen: boolean;
  onClose: () => void;
}

const rarityColors: Record<string, { bg: string; border: string; bgClass: string; borderClass: string; icon: any }> = {
  common: { bg: "#6b7280", border: "#9ca3af", bgClass: "bg-gray-500", borderClass: "border-gray-400", icon: Star },
  uncommon: { bg: "#10b981", border: "#34d399", bgClass: "bg-green-500", borderClass: "border-green-400", icon: Award },
  rare: { bg: "#3b82f6", border: "#60a5fa", bgClass: "bg-blue-500", borderClass: "border-blue-400", icon: Zap },
  epic: { bg: "#a855f7", border: "#c084fc", bgClass: "bg-purple-500", borderClass: "border-purple-400", icon: Trophy },
  legendary: { bg: "#f59e0b", border: "#fbbf24", bgClass: "bg-amber-500", borderClass: "border-amber-400", icon: Crown },
};

const categoryLabels: Record<string, string> = {
  publishing: "Publishing",
  financial: "Financial",
  readers: "Readers",
  credibility: "Credibility",
  factions: "Factions",
  shop: "Shop",
  streaks: "Streaks",
  special: "Special",
  general: "General",
};

export default function Achievements({ isOpen, onClose }: AchievementsProps) {
  const { achievements, summary, isLoading } = useAchievements();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  if (!isOpen) return null;

  // Filter achievements
  const filteredAchievements = achievements.filter((achievement) => {
    if (selectedCategory && achievement.category !== selectedCategory) return false;
    if (selectedRarity && achievement.rarity !== selectedRarity) return false;
    if (showUnlockedOnly && !achievement.unlocked) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (
        !achievement.name.toLowerCase().includes(searchLower) &&
        !achievement.description.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    return true;
  });

  // Group by category
  const byCategory = filteredAchievements.reduce((acc, achievement) => {
    const cat = achievement.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(achievement);
    return acc;
  }, {} as Record<string, typeof achievements>);

  const categories = Object.keys(byCategory).sort();

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = summary?.completion_percentage || 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" onClick={onClose}>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" />

      {/* Modal container */}
      <div
        className="relative w-full max-w-6xl mx-4 max-h-[90vh] bg-[#1a0f08] border-2 border-[#8b6f47] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2a1810] via-[#1a0f08] to-[#2a1810] border-b-2 border-[#8b6f47] p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-[#d4af37]" />
              <h2 className="text-3xl font-bold text-[#e8dcc6] font-serif">Achievements</h2>
            </div>
            <button
              onClick={onClose}
              className="text-[#8b6f47] hover:text-[#d4af37] transition-colors p-2 hover:bg-[#2a1810] rounded"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-[#2a1810] border border-[#8b6f47] rounded p-3">
                <div className="text-xs text-[#8b6f47] mb-1">Unlocked</div>
                <div className="text-2xl font-bold text-[#d4af37]">
                  {unlockedCount} / {totalCount}
                </div>
              </div>
              <div className="bg-[#2a1810] border border-[#8b6f47] rounded p-3">
                <div className="text-xs text-[#8b6f47] mb-1">Total Points</div>
                <div className="text-2xl font-bold text-[#d4af37]">{summary.total_points}</div>
              </div>
              <div className="bg-[#2a1810] border border-[#8b6f47] rounded p-3">
                <div className="text-xs text-[#8b6f47] mb-1">Completion</div>
                <div className="text-2xl font-bold text-[#d4af37]">{completionPercentage.toFixed(1)}%</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b6f47]" />
              <input
                type="text"
                placeholder="Search achievements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder:text-[#8b6f47] text-sm focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-3 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] text-sm focus:outline-none focus:border-[#d4af37]"
            >
              <option value="">All Categories</option>
              {Object.keys(categoryLabels).map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabels[cat]}
                </option>
              ))}
            </select>

            {/* Rarity filter */}
            <select
              value={selectedRarity || ""}
              onChange={(e) => setSelectedRarity(e.target.value || null)}
              className="px-3 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] text-sm focus:outline-none focus:border-[#d4af37]"
            >
              <option value="">All Rarities</option>
              {Object.keys(rarityColors).map((rarity) => (
                <option key={rarity} value={rarity}>
                  {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                </option>
              ))}
            </select>

            {/* Unlocked only toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnlockedOnly}
                onChange={(e) => setShowUnlockedOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#e8dcc6]">Unlocked only</span>
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-12 text-[#8b6f47]">Loading achievements...</div>
          ) : filteredAchievements.length === 0 ? (
            <div className="text-center py-12 text-[#8b6f47]">No achievements found</div>
          ) : (
            <div className="space-y-8">
              {categories.map((category) => (
                <div key={category}>
                  <h3 className="text-xl font-bold text-[#d4af37] font-serif mb-4 border-b border-[#8b6f47] pb-2">
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {byCategory[category].map((achievement) => {
                      const rarity = rarityColors[achievement.rarity];
                      const Icon = rarity.icon;
                      const isUnlocked = achievement.unlocked;

                      return (
                        <motion.div
                          key={achievement.achievement_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`border-2 rounded-lg p-4 transition-all ${
                            isUnlocked
                              ? `${rarity.borderClass} bg-[#2a1810]`
                              : "border-[#4a4a4a] bg-[#1a0f08] opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded ${
                                isUnlocked ? rarity.bgClass : "bg-[#4a4a4a]"
                              }`}
                            >
                              <Icon
                                className={`w-6 h-6 ${
                                  isUnlocked ? "text-white" : "text-[#6b6b6b]"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4
                                  className={`font-bold font-serif ${
                                    isUnlocked ? "text-[#e8dcc6]" : "text-[#6b6b6b]"
                                  }`}
                                >
                                  {achievement.name}
                                </h4>
                                {isUnlocked && (
                                  <span className="text-xs text-[#d4af37] font-bold whitespace-nowrap">
                                    +{achievement.points}
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-sm ${
                                  isUnlocked ? "text-[#c4b89a]" : "text-[#6b6b6b]"
                                }`}
                              >
                                {achievement.description}
                              </p>
                              {!isUnlocked && achievement.progress != null && achievement.progress > 0 && (
                                <div className="mt-2">
                                  <div className="h-1.5 bg-[#2a1810] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#8b6f47] rounded-full transition-all"
                                      style={{ width: `${Math.min(100, achievement.progress * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[#8b6f47] mt-1 block">
                                    {Math.round(achievement.progress * 100)}%
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    isUnlocked
                                      ? `${rarity.bgClass}/20 ${rarity.borderClass}`
                                      : "bg-[#4a4a4a] text-[#6b6b6b]"
                                  }`}
                                >
                                  {achievement.rarity}
                                </span>
                                {isUnlocked && achievement.unlocked_at && (
                                  <span className="text-xs text-[#8b6f47]">
                                    {new Date(achievement.unlocked_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

