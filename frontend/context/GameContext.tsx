"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface GameContextType {
  newspaperName: string;
  setNewspaperName: (name: string) => void;
  treasury: number;
  setTreasury: (amount: number | ((prev: number) => number)) => void;
  purchasedUpgrades: string[];
  buyUpgrade: (cost: number, upgradeId: string) => boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [newspaperName, setNewspaperName] = useState<string>("THE DAILY DYSTOPIA");
  const [treasury, setTreasury] = useState<number>(0);
  const [purchasedUpgrades, setPurchasedUpgrades] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedTreasury = localStorage.getItem("game_treasury");
    const savedUpgrades = localStorage.getItem("game_upgrades");
    
    if (savedTreasury) {
      setTreasury(parseInt(savedTreasury, 10));
    }
    if (savedUpgrades) {
      try {
        setPurchasedUpgrades(JSON.parse(savedUpgrades));
      } catch (e) {
        console.error("Failed to parse saved upgrades:", e);
      }
    }
  }, []);

  // Save to localStorage whenever treasury or upgrades change
  useEffect(() => {
    localStorage.setItem("game_treasury", treasury.toString());
  }, [treasury]);

  useEffect(() => {
    localStorage.setItem("game_upgrades", JSON.stringify(purchasedUpgrades));
  }, [purchasedUpgrades]);

  const buyUpgrade = (cost: number, upgradeId: string): boolean => {
    if (treasury >= cost) {
      setTreasury((prev) => prev - cost);
      setPurchasedUpgrades((prev) => {
        // Allow stacking (multiple purchases of same upgrade)
        return [...prev, upgradeId];
      });
      return true;
    }
    return false;
  };

  return (
    <GameContext.Provider
      value={{
        newspaperName,
        setNewspaperName,
        treasury,
        setTreasury,
        purchasedUpgrades,
        buyUpgrade,
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

