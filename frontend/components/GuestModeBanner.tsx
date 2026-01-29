"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { LogIn, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Guest Mode Banner
 * Shows a banner when user is in guest mode, encouraging them to sign up
 */
export default function GuestModeBanner() {
  const { isGuest } = useAuth();
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isGuest || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-blue-900/95 via-indigo-900/95 to-blue-900/95 border-b-2 border-blue-600/50 shadow-lg"
        style={{ marginTop: "0px" }} // Adjust if PreAlphaBanner is visible
      >
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                <span className="text-lg">👁️</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                  Browsing as Guest
                </p>
                <p className="text-xs text-blue-100 mt-0.5 font-serif">
                  You're in read-only mode. <button onClick={() => router.push("/login")} className="underline hover:text-blue-50 font-bold">Sign up</button> to publish newspapers, access your hub, and compete on the leaderboard!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/login")}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-serif rounded transition-colors flex items-center gap-1"
              >
                <LogIn className="w-3 h-3" />
                Sign Up
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="flex-shrink-0 p-1 hover:bg-blue-800/50 rounded transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

