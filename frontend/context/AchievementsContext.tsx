"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getAllAchievements, getAchievementsSummary, checkAchievements, type Achievement, type AchievementsSummary } from "@/lib/api";
import toast from "react-hot-toast";

interface AchievementsContextType {
  achievements: Achievement[];
  summary: AchievementsSummary | null;
  isLoading: boolean;
  refreshAchievements: () => Promise<void>;
  checkAndUnlock: (eventType: string, eventData: Record<string, any>) => Promise<void>;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [summary, setSummary] = useState<AchievementsSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAchievements = useCallback(async () => {
    // Only load achievements if user is authenticated and has a token
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      setAchievements([]);
      setSummary(null);
      return;
    }

    // Double-check token exists
    try {
      const { getPocketBase } = await import("@/lib/pocketbase");
      const pb = getPocketBase();
      if (!pb.authStore.token) {
        setIsLoading(false);
        setAchievements([]);
        setSummary(null);
        return;
      }
    } catch (e) {
      // PocketBase not available
      setIsLoading(false);
      setAchievements([]);
      setSummary(null);
      return;
    }

    try {
      setIsLoading(true);
      const [allAchievements, summaryData] = await Promise.all([
        getAllAchievements(),
        getAchievementsSummary(),
      ]);
      setAchievements(allAchievements);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load achievements:", error);
      // Don't show error to user - achievements are non-critical
      // Just set empty state
      setAchievements([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const checkAndUnlock = useCallback(async (eventType: string, eventData: Record<string, any>) => {
    if (!isAuthenticated) return;

    try {
      const result = await checkAchievements(eventType, eventData);
      
      // Show notifications for newly unlocked achievements
      if (result.newly_unlocked && result.newly_unlocked.length > 0) {
        result.newly_unlocked.forEach((achievement) => {
          toast.success(
            `🏆 Achievement Unlocked: ${achievement.name} (+${achievement.points} pts)`,
            {
              duration: 5000,
              icon: "🏆",
              style: {
                background: "#1a0f08",
                color: "#d4af37",
                border: "2px solid #d4af37",
                fontSize: "14px",
              },
            }
          );
        });
        
        // Refresh achievements list
        await refreshAchievements();
      }
    } catch (error) {
      console.error("Failed to check achievements:", error);
      // Don't show error to user - achievements are non-critical
    }
  }, [isAuthenticated, refreshAchievements]);

  // Load achievements on mount and when auth state changes
  useEffect(() => {
    refreshAchievements();
  }, [refreshAchievements]);

  return (
    <AchievementsContext.Provider
      value={{
        achievements,
        summary,
        isLoading,
        refreshAchievements,
        checkAndUnlock,
      }}
    >
      {children}
    </AchievementsContext.Provider>
  );
}

export function useAchievements() {
  const context = useContext(AchievementsContext);
  if (context === undefined) {
    throw new Error("useAchievements must be used within an AchievementsProvider");
  }
  return context;
}

