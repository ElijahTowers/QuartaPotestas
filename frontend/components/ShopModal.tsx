"use client";

import { X, ShoppingCart, DollarSign } from "lucide-react";
import { useGame } from "@/context/GameContext";

interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: string;
}

const shopItems: ShopItem[] = [
  {
    id: "interns",
    name: "Interns",
    description: "Hire underpaid journalism students to do the heavy lifting",
    cost: 500,
    effect: "+10% Daily Readers",
  },
  {
    id: "slander_license",
    name: "Slander License",
    description: "Legal protection for questionable reporting practices",
    cost: 1000,
    effect: "-20% Fake News penalties",
  },
  {
    id: "coffee_machine",
    name: "Coffee Machine",
    description: "Essential equipment for late-night deadline crunches",
    cost: 200,
    effect: "Caffeinated badge",
  },
];

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShopModal({ isOpen, onClose }: ShopModalProps) {
  const { treasury, purchasedUpgrades, buyUpgrade } = useGame();

  if (!isOpen) return null;

  const handlePurchase = (item: ShopItem) => {
    const success = buyUpgrade(item.cost, item.id);
    if (success) {
      // You could add a toast notification here
      console.log(`Purchased: ${item.name}`);
    }
  };

  const getPurchaseCount = (upgradeId: string) => {
    return purchasedUpgrades.filter((id) => id === upgradeId).length;
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Dark overlay with glitch effect */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" />
      
      {/* Modal container */}
      <div
        className="relative w-full max-w-2xl mx-4 bg-[#0a0503] border-2 border-red-600/50 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with dark web aesthetic */}
        <div className="bg-gradient-to-r from-red-900/50 via-black to-red-900/50 border-b-2 border-red-600/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-red-500 animate-pulse" />
              <h2 className="text-2xl font-bold text-red-500 font-mono tracking-wider">
                DARK MARKET
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-red-500 hover:text-red-400 transition-colors p-2 hover:bg-red-900/30 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Treasury display */}
          <div className="mt-4 flex items-center gap-2 text-yellow-400">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-mono">TREASURY:</span>
            <span className="text-xl font-bold font-mono">
              ${treasury.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Items grid */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {shopItems.map((item) => {
            const purchaseCount = getPurchaseCount(item.id);
            const canAfford = treasury >= item.cost;
            
            return (
              <div
                key={item.id}
                className={`border-2 rounded-lg p-4 transition-all ${
                  canAfford
                    ? "border-red-600/50 bg-[#1a0f08] hover:border-red-500 hover:bg-[#2a1810]"
                    : "border-gray-800 bg-[#0f0805] opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-red-400 font-mono">
                        {item.name}
                      </h3>
                      {purchaseCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs font-mono rounded">
                          x{purchaseCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">EFFECT:</span>
                      <span className="text-xs text-yellow-400 font-mono">
                        {item.effect}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <div className="text-xs text-gray-500 font-mono mb-1">COST</div>
                      <div
                        className={`text-xl font-bold font-mono ${
                          canAfford ? "text-yellow-400" : "text-gray-600"
                        }`}
                      >
                        ${item.cost.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={!canAfford}
                      className={`px-4 py-2 rounded font-mono text-sm font-bold transition-all ${
                        canAfford
                          ? "bg-red-600 hover:bg-red-500 text-white border-2 border-red-700 hover:border-red-500"
                          : "bg-gray-800 text-gray-600 cursor-not-allowed border-2 border-gray-700"
                      }`}
                    >
                      {canAfford ? "PURCHASE" : "INSUFFICIENT FUNDS"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with dark web warning */}
        <div className="bg-black/50 border-t-2 border-red-600/30 p-3">
          <p className="text-xs text-gray-600 text-center font-mono">
            ⚠ ALL SALES FINAL. NO REFUNDS. USE AT YOUR OWN RISK. ⚠
          </p>
        </div>
      </div>
    </div>
  );
}

