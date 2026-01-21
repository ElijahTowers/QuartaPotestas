"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/context/GameContext";
import GameLayout from "@/components/GameLayout";
import ShopModal from "@/components/ShopModal";
import { motion } from "framer-motion";

export default function HubPage() {
  const router = useRouter();
  const { treasury } = useGame();
  const [isShopOpen, setIsShopOpen] = useState(false);
  
  // TODO: Connect these to actual game state when available
  const [readers, setReaders] = useState(12500);
  const [credibility, setCredibility] = useState(65);
  
  // Mock recent transactions
  const recentTransactions = [
    { date: "Today", description: "Ad Revenue", amount: 1200, type: "income" },
    { date: "Today", description: "Print Costs", amount: -500, type: "expense" },
    { date: "Yesterday", description: "Subscription Revenue", amount: 800, type: "income" },
    { date: "Yesterday", description: "Paper Stock", amount: -300, type: "expense" },
  ];

  const getMoodStatus = (cred: number): string => {
    if (cred >= 70) return "STABLE";
    if (cred >= 40) return "UNREST";
    return "RIOT";
  };

  const getCredibilityStatus = (cred: number): { text: string; color: string } => {
    if (cred >= 70) return { text: "VERIFIED", color: "green" };
    if (cred <= 30) return { text: "PROBATION", color: "red" };
    return { text: "MONITORED", color: "yellow" };
  };

  const status = getCredibilityStatus(credibility);

  return (
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
        subtitle="Executive Desk"
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
            <h1 className="text-4xl font-bold text-[#e8dcc6] font-serif mb-12 text-center">
              EXECUTIVE DESK
            </h1>

        {/* Desk Objects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Object A: The Ledger */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div
              className="bg-[#f4e4bc] p-6 rounded shadow-2xl border-2 border-[#8b6f47] relative"
              style={{
                transform: "rotate(-2deg)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              {/* Lined paper effect */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, #8b6f47 31px, #8b6f47 32px)",
                  backgroundPosition: "0 40px",
                }}
              />
              
              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-[#1a0f08] mb-4 font-serif" style={{ fontFamily: "Georgia, serif" }}>
                  TREASURY LOG
                </h2>
                
                {/* Current Funds */}
                <div className="mb-6">
                  <p className="text-sm text-[#8b6f47] mb-1">Current Funds</p>
                  <p className={`text-4xl font-bold ${treasury >= 0 ? "text-green-700" : "text-red-700"}`}>
                    ${treasury.toLocaleString()}
                  </p>
                </div>

                {/* Recent Activity */}
                <div className="border-t-2 border-[#8b6f47] pt-4">
                  <p className="text-sm font-bold text-[#1a0f08] mb-3">Recent Activity</p>
                  <div className="space-y-2">
                    {recentTransactions.map((tx, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div>
                          <p className="text-[#1a0f08]">{tx.description}</p>
                          <p className="text-xs text-[#8b6f47]">{tx.date}</p>
                        </div>
                        <p className={`font-bold ${tx.type === "income" ? "text-green-700" : "text-red-700"}`}>
                          {tx.amount > 0 ? "+" : ""}${tx.amount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Object B: The Circulation Report */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div
              className="bg-[#f9f6f0] p-6 rounded shadow-2xl border border-[#8b6f47] relative"
              style={{
                transform: "rotate(1.5deg)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              }}
            >
              {/* Paperclip */}
              <div className="absolute -top-2 right-8 w-6 h-8 bg-[#8b6f47] rounded-full" style={{ clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" }} />
              
              {/* Aged paper texture */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none rounded"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
                }}
              />

              <div className="relative z-10">
                <h2 className="text-2xl font-bold text-[#1a0f08] mb-4 font-mono tracking-wider">
                  DAILY CIRCULATION
                </h2>
                
                {/* Total Readers */}
                <div className="mb-6">
                  <p className="text-sm text-[#8b6f47] mb-1">Total Readers</p>
                  <p className="text-4xl font-bold text-[#1a0f08] font-mono">
                    {readers.toLocaleString()}
                  </p>
                </div>

                {/* Public Mood */}
                <div className="border-t border-[#8b6f47] pt-4">
                  <p className="text-sm text-[#8b6f47] mb-1">Public Mood</p>
                  <p className="text-2xl font-bold text-[#1a0f08] font-mono">
                    {getMoodStatus(credibility)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Object C: The Press License */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div
              className="bg-gradient-to-br from-gray-100 to-gray-200 p-6 rounded shadow-2xl border-4 border-[#8b6f47] relative"
              style={{
                boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.1)",
              }}
            >
              {/* Metallic/laminated texture */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none rounded"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.1) 100%)",
                }}
              />

              <div className="relative z-10">
                <h2 className="text-xl font-bold text-[#1a0f08] mb-4 font-mono tracking-wider text-center">
                  PRESS LICENSE
                </h2>
                
                {/* Photo placeholder */}
                <div className="w-24 h-24 mx-auto mb-4 bg-[#1a0f08] rounded border-2 border-[#8b6f47] flex items-center justify-center">
                  <div className="w-16 h-16 bg-[#3a2418] rounded-full" />
                </div>

                {/* Trust Score */}
                <div className="mb-4 text-center">
                  <p className="text-sm text-[#8b6f47] mb-1">Trust Score</p>
                  <p className="text-3xl font-bold text-[#1a0f08] font-mono">
                    {credibility}%
                  </p>
                </div>

                {/* Status Stamp */}
                <div className="text-center">
                  <div
                    className={`inline-block px-4 py-2 rounded border-2 font-bold text-sm font-mono ${
                      status.color === "green"
                        ? "bg-green-100 text-green-800 border-green-600"
                        : status.color === "red"
                        ? "bg-red-100 text-red-800 border-red-600"
                        : "bg-yellow-100 text-yellow-800 border-yellow-600"
                    }`}
                    style={{
                      transform: "rotate(-5deg)",
                      boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    {status.text}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

          </div>
        </div>
      </GameLayout>
      
      {/* Shop Modal */}
      <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
    </div>
  );
}

