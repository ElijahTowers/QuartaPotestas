"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Assistant from "./Assistant";
import EditableTitle from "./EditableTitle";
import { Loader2, Map as MapIcon, LayoutGrid, RefreshCw, ShoppingBag, Briefcase, LogOut, BookOpen, Trophy, Menu, Activity, Bug } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { useAuth } from "@/context/AuthContext";
import { useTutorial } from "@/context/TutorialContext";
import { useMobile } from "@/lib/hooks/useMobile";
import MobileDrawer from "./MobileDrawer";

// Admin email - only this user can fetch new scoops
const ADMIN_EMAIL = "lowiehartjes@gmail.com";
import { parseDutchDateTime, formatDutchDate } from "@/lib/dateUtils";

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
  const { logout, user, isGuest } = useAuth();
  const { handleTabClick } = useTutorial();
  const isMobile = useMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const displaySubtitle = subtitle || (viewMode === "map" ? "The War Room" : "Front Page Editor");

  // Route-based active states (prevents multiple tabs highlighting on non-map pages like /leaderboard)
  const isHubActive = pathname === "/hub";
  const isMapActive = pathname === "/";
  const isGridActive = pathname === "/editor";
  const isArchivesActive = pathname === "/archives";
  const isLeaderboardActive = pathname === "/leaderboard";
  const isMonitorActive = pathname === "/monitor";
  const isDebugActive = pathname === "/debug";
  
  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex-1 relative flex flex-col h-screen overflow-hidden">
      {/* Mobile Header - Always visible on mobile */}
      {isMobile && (
        <div className="bg-[#1a0f08] bg-opacity-90 border-b border-[#8b6f47] p-3 paper-texture z-[1000] flex items-center justify-between">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded hover:bg-[#3a2418] text-[#8b6f47] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <EditableTitle
              value={newspaperName}
              onChange={setNewspaperName}
              className="text-lg font-bold text-[#e8dcc6] font-serif"
            />
            <p className="text-xs text-[#8b6f47] mt-0.5">{displaySubtitle}</p>
          </div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      )}

      {/* Desktop Header - Only show in grid mode, hide in map mode for more space */}
      {!isMobile && viewMode === "grid" && (
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
                  Edition: {formatDutchDate(parseDutchDateTime(editionInfo.date))} •{" "}
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

      {/* Mobile Drawer */}
      {isMobile && (
        <MobileDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onRefreshScoops={onRefreshScoops}
          onOpenShop={onOpenShop}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Content Area */}
      <div className={`${viewMode === "map" ? "h-full" : "flex-1"} overflow-hidden ${isMobile && viewMode === "map" ? "flex flex-col" : "flex"}`}>
        {/* Main Content - Left Side */}
        <div className={`${isMobile && viewMode === "map" ? "flex-1 flex flex-col min-h-0" : "flex-1 h-full"} ${isMobile ? "overflow-y-auto pb-safe" : "overflow-y-auto"}`}>{children}</div>

        {/* Vertical Toolbar - Right Side (Desktop Only) */}
        {!isMobile && (
          <div className="w-16 bg-[#1a0f08] border-l border-[#8b6f47] flex flex-col items-center gap-4 py-4 paper-texture flex-shrink-0 relative z-[9999]">
          {/* Only show refresh button for admin */}
          {isAdmin && (
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
          )}
          <button
            data-tutorial="hub-tab"
            onClick={() => {
              // Handle tutorial tab click
              handleTabClick("hub-tab");
              
              if (!isGuest) {
                router.push("/hub");
              } else {
                router.push("/login");
              }
            }}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              isHubActive
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            } ${isGuest ? "opacity-50 cursor-not-allowed" : ""}`}
            title={isGuest ? "Executive Desk (Login required)" : "Executive Desk"}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px]">Hub</span>
          </button>
          <button
            onClick={() => {
              if (isMapActive) {
                onViewModeChange("map");
              } else {
                router.push("/");
              }
            }}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              isMapActive
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Map View"
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[10px]">Map</span>
          </button>
          <button
            data-tutorial="grid-tab"
            onClick={() => {
              // Handle tutorial tab click
              handleTabClick("grid-tab");
              
              if (isGridActive) {
                onViewModeChange("grid");
              } else {
                router.push("/editor");
              }
            }}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              isGridActive
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Grid Editor"
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">Grid</span>
          </button>
          {!isGuest && (
            <button
              onClick={() => router.push("/archives")}
              className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
                isArchivesActive
                  ? "bg-[#d4af37] text-[#1a0f08]"
                  : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
              }`}
              title="Archives"
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-[10px]">Archives</span>
            </button>
          )}
          <button
            onClick={() => router.push("/leaderboard")}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              isLeaderboardActive
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Leaderboard"
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px]">Top 5</span>
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => router.push("/monitor")}
                className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
                  isMonitorActive
                    ? "bg-[#d4af37] text-[#1a0f08]"
                    : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                }`}
                title="System monitor"
              >
                <Activity className="w-5 h-5" />
                <span className="text-[10px]">Monitor</span>
              </button>
              <button
                onClick={() => router.push("/debug")}
                className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
                  isDebugActive
                    ? "bg-[#d4af37] text-[#1a0f08]"
                    : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                }`}
                title="Debug: BBC RSS feed"
              >
                <Bug className="w-5 h-5" />
                <span className="text-[10px]">Debug</span>
              </button>
            </>
          )}
          {!isGuest && (
            <button
              data-tutorial="shop-button"
              onClick={onOpenShop}
              className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020] border border-red-600/50 hover:border-red-500"
              title="Shop"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[10px]">Shop</span>
            </button>
          )}
          <div className="flex-1" /> {/* Spacer */}
          
          {/* Pre-Alpha Badge - Clickable */}
          <button
            onClick={() => router.push("/updates")}
            className="px-2 py-1 mb-2 bg-orange-900/30 border border-orange-700/50 rounded text-center hover:bg-orange-900/50 hover:border-orange-600 transition-colors cursor-pointer"
            title="View recent updates"
          >
            <p className="text-[8px] text-orange-300 font-bold uppercase tracking-wider">Pre-α</p>
            <p className="text-[7px] text-orange-400/70 mt-0.5">Alpha</p>
          </button>
          
          {/* Guest Mode Indicator */}
          {isGuest && (
            <div className="px-2 py-1 mb-2 bg-blue-900/30 border border-blue-700/50 rounded text-center">
              <p className="text-[8px] text-blue-300 font-bold uppercase tracking-wider">👁️</p>
              <p className="text-[7px] text-blue-400/70 mt-0.5">Guest</p>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#3a2418] text-[#8b6f47] hover:bg-red-900/30 hover:border-red-700/50 border border-transparent"
            title={isGuest ? "Exit Guest Mode" : "Logout"}
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px]">{isGuest ? "Exit" : "Exit"}</span>
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

