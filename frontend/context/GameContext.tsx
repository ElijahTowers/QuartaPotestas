"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getNewspaperName, updateNewspaperName, getGameState, updateGameState } from "@/lib/api";
import toast from "react-hot-toast";

// Import achievements context (will be available if AchievementsProvider is mounted)
let achievementsContext: any = null;
try {
  const { useAchievements } = require("@/context/AchievementsContext");
  achievementsContext = useAchievements;
} catch (e) {
  // Achievements context not available, will be null
}

interface GameContextType {
  newspaperName: string;
  setNewspaperName: (name: string) => void;
  treasury: number;
  setTreasury: (amount: number | ((prev: number) => number)) => void;
  purchasedUpgrades: string[];
  buyUpgrade: (cost: number, upgradeId: string) => boolean;
  readers: number;
  credibility: number;
  publishStreak: number;
  lastPublishDate: string | null;
  refreshGameState: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isGuest } = useAuth();
  const [newspaperName, setNewspaperNameState] = useState<string>("THE DAILY DYSTOPIA");
  const [treasury, setTreasuryState] = useState<number>(0);
  const [purchasedUpgrades, setPurchasedUpgradesState] = useState<string[]>([]);
  const [readers, setReadersState] = useState<number>(0);
  const [credibility, setCredibilityState] = useState<number>(0);
  const [publishStreak, setPublishStreakState] = useState<number>(0);
  const [lastPublishDate, setLastPublishDateState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Load newspaper name and game state from database when user is authenticated (not guest)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      setIsLoading(true);
      
      // Load newspaper name
      getNewspaperName()
        .then((name) => {
          setNewspaperNameState(name);
        })
        .catch((error) => {
          console.error("Failed to load newspaper name:", error);
        });
      
      // Load game state
      getGameState()
        .then((state) => {
          setTreasuryState(state.treasury);
          setPurchasedUpgradesState(state.purchased_upgrades);
          setReadersState(state.readers);
          setCredibilityState(state.credibility);
          setPublishStreakState(state.publish_streak ?? 0);
          setLastPublishDateState(state.last_publish_date ?? null);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to load game state:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, isGuest]);

  const handleGameStateError = useCallback((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("404") || msg.includes("user record not found")) {
      // Backend kan user record niet vinden – waarschijnlijk setup/veld-configuratie. Niet uitloggen.
      console.warn("[GameContext] Game state kon niet opgeslagen worden (user record niet gevonden). Controleer PocketBase users-collectie.");
    }
  }, []);
  
  // Wrapper function to save to database when newspaper name changes
  // Re-throws errors so components can handle them (e.g., show validation errors)
  const setNewspaperName = useCallback(async (name: string) => {
    // Save to database if authenticated (not guest)
    if (isAuthenticated && !isGuest) {
      try {
        await updateNewspaperName(name);
        // Only update local state if save succeeded
        setNewspaperNameState(name);
      } catch (error) {
        console.error("Failed to save newspaper name:", error);
        // Re-throw to let the calling component handle the error
        throw error;
      }
    } else {
      // Not authenticated, just update local state
      setNewspaperNameState(name);
    }
  }, [isAuthenticated, isGuest]);
  
  // Wrapper function to save treasury to database when it changes
  const setTreasury = useCallback(async (amount: number | ((prev: number) => number)) => {
    const newAmount = typeof amount === "function" ? amount(treasury) : amount;
    setTreasuryState(newAmount);
    
    // Save to database if authenticated (not guest)
    if (isAuthenticated && !isGuest && !isLoading) {
      try {
        await updateGameState({ treasury: newAmount });
      } catch (error) {
        console.error("Failed to save treasury:", error);
        handleGameStateError(error);
      }
    }
  }, [isAuthenticated, isGuest, treasury, isLoading, handleGameStateError]);
  
  // Save purchased upgrades to database when they change
  useEffect(() => {
    if (isAuthenticated && !isGuest && !isLoading && purchasedUpgrades.length >= 0) {
      updateGameState({ purchased_upgrades: purchasedUpgrades })
        .catch((error) => {
          console.error("Failed to save purchased upgrades:", error);
          handleGameStateError(error);
        });
    }
  }, [purchasedUpgrades, isAuthenticated, isGuest, isLoading, handleGameStateError]);

  const buyUpgrade = useCallback((cost: number, upgradeId: string): boolean => {
    if (treasury >= cost) {
      const newTreasury = treasury - cost;
      const newUpgrades = [...purchasedUpgrades, upgradeId];
      
      setTreasuryState(newTreasury);
      setPurchasedUpgradesState(newUpgrades);
      
      // Save to database if authenticated (not guest)
      if (isAuthenticated && !isGuest && !isLoading) {
        updateGameState({ 
          treasury: newTreasury, 
          purchased_upgrades: newUpgrades 
        }).then(async () => {
          toast.success("Upgrade purchased!", { duration: 2000 });
          
          // Check achievements after purchase
          try {
            if (achievementsContext) {
              const { checkAndUnlock } = achievementsContext();
              await checkAndUnlock("shop_purchase", {
                upgrade_id: upgradeId,
                cost: cost,
                total_upgrades: newUpgrades.length,
              });
            }
          } catch (error) {
            console.error("Failed to check achievements:", error);
            // Don't block purchase flow if achievements fail
          }
        }).catch((error) => {
          console.error("Failed to save upgrade purchase:", error);
          handleGameStateError(error);
          toast.error("Kon upgrade niet opslaan. Log opnieuw in.", { duration: 4000 });
        });
      }
      
      return true;
    }
    return false;
  }, [treasury, purchasedUpgrades, isAuthenticated, isGuest, isLoading, handleGameStateError]);

  // Function to refresh game state from database
  const refreshGameState = useCallback(async () => {
    if (!isAuthenticated || isGuest) return;
    
    try {
      const state = await getGameState();
      setTreasuryState(state.treasury);
      setPurchasedUpgradesState(state.purchased_upgrades);
      setReadersState(state.readers);
      setCredibilityState(state.credibility);
      setPublishStreakState(state.publish_streak ?? 0);
      setLastPublishDateState(state.last_publish_date ?? null);
    } catch (error) {
      console.error("Failed to refresh game state:", error);
      handleGameStateError(error);
    }
  }, [isAuthenticated, isGuest, handleGameStateError]);

  return (
    <GameContext.Provider
      value={{
        newspaperName,
        setNewspaperName,
        treasury,
        setTreasury,
        purchasedUpgrades,
        buyUpgrade,
        readers,
        credibility,
        publishStreak,
        lastPublishDate,
        refreshGameState,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

