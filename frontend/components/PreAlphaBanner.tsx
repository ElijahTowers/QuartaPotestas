"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Pre-Alpha Banner Component
 * Displays a warning banner at the top of the page indicating the site is in Pre-Alpha
 */
export default function PreAlphaBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner
    const dismissed = localStorage.getItem("preAlphaBannerDismissed");
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("preAlphaBannerDismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-[10000] bg-gradient-to-r from-red-900/95 via-orange-900/95 to-red-900/95 border-b-2 border-red-600/50 shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider font-serif">
                  ⚠️ Pre-Alpha Build ⚠️
                </p>
                <p className="text-xs text-red-100 mt-1 font-serif">
                  This site is in active development. Features may be incomplete, unstable, or subject to change.
                  Data may be reset during updates. Use at your own risk.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-red-800/50 rounded transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

