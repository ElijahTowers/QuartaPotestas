"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import Assistant from "./Assistant";
import EditableTitle from "./EditableTitle";
import { Loader2, Map as MapIcon, LayoutGrid, RefreshCw, ShoppingBag, Briefcase } from "lucide-react";
import { useGame } from "@/context/GameContext";

type ViewMode = "map" | "grid";

interface GameLayoutProps {
  children: React.ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onRefreshScoops: () => void;
  onOpenShop: () => void;
  isRefreshing?: boolean;
  refreshError?: string | null;
  refreshProgress?: string;
  subtitle?: string;
  editionInfo?: {
    date: string;
    articleCount: number;
    globalMood?: string;
  };
}

export default function GameLayout({
  children,
  viewMode,
  onViewModeChange,
  onRefreshScoops,
  onOpenShop,
  isRefreshing = false,
  refreshError = null,
  refreshProgress = "",
  subtitle,
  editionInfo,
}: GameLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { newspaperName, setNewspaperName } = useGame();

  const displaySubtitle = subtitle || (viewMode === "map" ? "The War Room" : "Front Page Editor");

  return (
    <div className="flex-1 relative flex flex-col h-screen overflow-hidden">
      {/* Header - Only show in grid mode, hide in map mode for more space */}
      {viewMode === "grid" && (
        <div className="bg-[#1a0f08] bg-opacity-90 border-b border-[#8b6f47] p-4 paper-texture z-[1000]">
          <div className="flex items-center justify-between">
            <div>
              <EditableTitle
                value={newspaperName}
                onChange={setNewspaperName}
                className="text-2xl font-bold text-[#e8dcc6] font-serif"
              />
              <p className="text-sm text-[#8b6f47] mt-1">{displaySubtitle}</p>
              {editionInfo && (
                <p className="text-sm text-[#8b6f47] mt-1">
                  Edition: {new Date(editionInfo.date).toLocaleDateString()} •{" "}
                  {editionInfo.articleCount} scoop{editionInfo.articleCount !== 1 ? "s" : ""} • Mood:{" "}
                  {editionInfo.globalMood || "Unknown"}
                </p>
              )}
            </div>

            {/* Editor Assistant - Tutorial Tips */}
            <div className="flex-shrink-0">
              <Assistant mood="neutral" viewMode={viewMode} />
            </div>
          </div>
          {refreshError && (
            <p className="text-xs text-red-400 mt-2">{refreshError}</p>
          )}
          {refreshProgress && (
            <div className="mt-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-[#d4af37] animate-spin" />
              <p className="text-xs text-[#d4af37] font-serif">{refreshProgress}</p>
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className={`${viewMode === "map" ? "h-full" : "flex-1"} overflow-hidden flex`}>
        {/* Main Content - Left Side */}
        <div className="flex-1 h-full overflow-y-auto">{children}</div>

        {/* Vertical Toolbar - Right Side */}
        <div className="w-16 bg-[#1a0f08] border-l border-[#8b6f47] flex flex-col items-center gap-4 py-4 paper-texture flex-shrink-0">
          <button
            onClick={onRefreshScoops}
            disabled={isRefreshing}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              isRefreshing
                ? "bg-[#3a2418] text-[#8b6f47] opacity-60 cursor-not-allowed"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Fetch new scoops"
          >
            {isRefreshing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            <span className="text-[10px]">{isRefreshing ? "..." : "Fetch"}</span>
          </button>
          <button
            onClick={() => router.push("/hub")}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              pathname === "/hub"
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Executive Desk"
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px]">Hub</span>
          </button>
          <button
            onClick={() => onViewModeChange("map")}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              viewMode === "map" && pathname !== "/hub"
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Map View"
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[10px]">Map</span>
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              viewMode === "grid" && pathname !== "/hub"
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Grid Editor"
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">Grid</span>
          </button>
          <button
            onClick={onOpenShop}
            className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020] border border-red-600/50 hover:border-red-500"
            title="Shop"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">Shop</span>
          </button>
        </div>
      </div>
    </div>
  );
}

