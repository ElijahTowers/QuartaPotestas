"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map as MapIcon,
  LayoutGrid,
  RefreshCw,
  ShoppingBag,
  Briefcase,
  LogOut,
  BookOpen,
  Trophy,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTutorial } from "@/context/TutorialContext";

const ADMIN_EMAIL = "lowiehartjes@gmail.com";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshScoops?: () => void;
  onOpenShop?: () => void;
  isRefreshing?: boolean;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  onRefreshScoops,
  onOpenShop,
  isRefreshing = false,
}: MobileDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user, isGuest } = useAuth();
  const { handleTabClick } = useTutorial();

  const isHubActive = pathname === "/hub";
  const isMapActive = pathname === "/";
  const isGridActive = pathname === "/editor";
  const isArchivesActive = pathname === "/archives";
  const isLeaderboardActive = pathname === "/leaderboard";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    await logout();
    onClose();
    router.push("/login");
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  const navItems = [
    {
      id: "hub",
      label: "Executive Desk",
      icon: Briefcase,
      path: "/hub",
      active: isHubActive,
      disabled: isGuest,
      onClick: () => {
        // Handle tutorial tab click
        handleTabClick("hub-tab");
        
        if (!isGuest) {
          handleNavigation("/hub");
        } else {
          handleNavigation("/login");
        }
      },
    },
    {
      id: "map",
      label: "Map View",
      icon: MapIcon,
      path: "/",
      active: isMapActive,
      onClick: () => handleNavigation("/"),
    },
    {
      id: "grid",
      label: "Grid Editor",
      icon: LayoutGrid,
      path: "/editor",
      active: isGridActive,
      onClick: () => {
        // Handle tutorial tab click
        handleTabClick("grid-tab");
        handleNavigation("/editor");
      },
    },
    {
      id: "archives",
      label: "Archives",
      icon: BookOpen,
      path: "/archives",
      active: isArchivesActive,
      disabled: isGuest,
      onClick: () => handleNavigation("/archives"),
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      path: "/leaderboard",
      active: isLeaderboardActive,
      onClick: () => handleNavigation("/leaderboard"),
    },
    {
      id: "shop",
      label: "Shop",
      icon: ShoppingBag,
      path: "#",
      active: false,
      disabled: isGuest,
      onClick: () => {
        if (onOpenShop) {
          onOpenShop();
          onClose();
        }
      },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-[9998]"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-[#1a0f08] border-r border-[#8b6f47] z-[9999] paper-texture overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#1a0f08] border-b border-[#8b6f47] p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-[#e8dcc6] font-serif">
                Navigation
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded hover:bg-[#3a2418] text-[#8b6f47] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="p-4 border-b border-[#8b6f47]">
                <p className="text-sm text-[#8b6f47] mb-1">Logged in as</p>
                <p className="text-base font-semibold text-[#e8dcc6] font-serif">
                  {user.username || user.email}
                </p>
                {isGuest && (
                  <p className="text-xs text-blue-400 mt-1">👁️ Guest Mode</p>
                )}
              </div>
            )}

            {/* Admin Refresh Button */}
            {isAdmin && onRefreshScoops && (
              <div className="p-4 border-b border-[#8b6f47]">
                <button
                  onClick={() => {
                    onRefreshScoops();
                    onClose();
                  }}
                  disabled={isRefreshing}
                  className={`w-full px-4 py-3 rounded transition-colors flex items-center justify-center gap-2 ${
                    isRefreshing
                      ? "bg-[#3a2418] text-[#8b6f47] opacity-60 cursor-not-allowed"
                      : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                  }`}
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-serif">Fetching...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      <span className="font-serif">Fetch New Scoops</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Navigation Items */}
            <nav className="p-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isDisabled = item.disabled;

                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    disabled={isDisabled}
                    className={`w-full px-4 py-3 rounded transition-colors flex items-center gap-3 mb-2 ${
                      item.active
                        ? "bg-[#d4af37] text-[#1a0f08]"
                        : isDisabled
                        ? "bg-[#3a2418] text-[#8b6f47] opacity-50 cursor-not-allowed"
                        : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-serif">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="sticky bottom-0 bg-[#1a0f08] border-t border-[#8b6f47] p-4 mt-auto">
              {/* Pre-Alpha Badge */}
              <button
                onClick={() => {
                  handleNavigation("/updates");
                }}
                className="w-full px-4 py-2 mb-2 bg-orange-900/30 border border-orange-700/50 rounded text-center hover:bg-orange-900/50 hover:border-orange-600 transition-colors"
              >
                <p className="text-xs text-orange-300 font-bold uppercase tracking-wider">
                  Pre-α Alpha
                </p>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 rounded transition-colors flex items-center justify-center gap-2 bg-[#3a2418] text-[#8b6f47] hover:bg-red-900/30 hover:border-red-700/50 border border-transparent"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-serif">{isGuest ? "Exit Guest Mode" : "Logout"}</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

