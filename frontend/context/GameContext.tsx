"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getNewspaperName, updateNewspaperName, getGameState, updateGameState } from "@/lib/api";
import toast from "react-hot-toast";

interface GameContextType {
  newspaperName: string;
  setNewspaperName: (name: string) => void;
  treasury: number;
  setTreasury: (amount: number | ((prev: number) => number)) => void;
  purchasedUpgrades: string[];
  buyUpgrade: (cost: number, upgradeId: string) => boolean;
  readers: number;
  credibility: number;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [newspaperName, setNewspaperNameState] = useState<string>("THE DAILY DYSTOPIA");
  const [treasury, setTreasuryState] = useState<number>(0);
  const [purchasedUpgrades, setPurchasedUpgradesState] = useState<string[]>([]);
  const [readers, setReadersState] = useState<number>(0);
  const [credibility, setCredibilityState] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Load newspaper name and game state from database when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
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
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Failed to load game state:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);
  
  // Wrapper function to save to database when newspaper name changes
  // Re-throws errors so components can handle them (e.g., show validation errors)
  const setNewspaperName = useCallback(async (name: string) => {
    // Save to database if authenticated
    if (isAuthenticated) {
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
  }, [isAuthenticated]);
  
  // Wrapper function to save treasury to database when it changes
  const setTreasury = useCallback(async (amount: number | ((prev: number) => number)) => {
    const newAmount = typeof amount === "function" ? amount(treasury) : amount;
    setTreasuryState(newAmount);
    
    // Save to database if authenticated
    if (isAuthenticated && !isLoading) {
      try {
        await updateGameState({ treasury: newAmount });
      } catch (error) {
        console.error("Failed to save treasury:", error);
        // Continue even if save fails - user can try again
      }
    }
  }, [isAuthenticated, treasury, isLoading]);
  
  // Save purchased upgrades to database when they change
  useEffect(() => {
    if (isAuthenticated && !isLoading && purchasedUpgrades.length >= 0) {
      updateGameState({ purchased_upgrades: purchasedUpgrades })
        .catch((error) => {
          console.error("Failed to save purchased upgrades:", error);
        });
    }
  }, [purchasedUpgrades, isAuthenticated, isLoading]);

  const buyUpgrade = useCallback((cost: number, upgradeId: string): boolean => {
    if (treasury >= cost) {
      const newTreasury = treasury - cost;
      const newUpgrades = [...purchasedUpgrades, upgradeId];
      
      setTreasuryState(newTreasury);
      setPurchasedUpgradesState(newUpgrades);
      
      // Save to database if authenticated
      if (isAuthenticated && !isLoading) {
        updateGameState({ 
          treasury: newTreasury, 
          purchased_upgrades: newUpgrades 
        }).then(() => {
          toast.success("Upgrade purchased!", { duration: 2000 });
        }).catch((error) => {
          console.error("Failed to save upgrade purchase:", error);
          toast.error("Failed to save upgrade purchase", { duration: 3000 });
        });
      }
      
      return true;
    }
    return false;
  }, [treasury, purchasedUpgrades, isAuthenticated, isLoading]);

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

