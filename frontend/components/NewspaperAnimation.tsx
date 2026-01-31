"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface NewspaperAnimationProps {
  editionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAnimationComplete: () => void;
}

export default function NewspaperAnimation({
  editionId,
  isOpen,
  onClose,
  onAnimationComplete,
}: NewspaperAnimationProps) {
  const router = useRouter();
  const [showContent, setShowContent] = React.useState(false);
  const [animationKey, setAnimationKey] = React.useState(0);

  React.useEffect(() => {
    if (isOpen) {
      // Reset states when opening and force re-mount of animation
      setShowContent(false);
      setAnimationKey(prev => prev + 1); // Force re-mount to trigger animation
      console.log("📰 Newspaper Animation: Starting animation for edition", editionId);
    } else {
      // Reset when closing to ensure clean state for next open
      setShowContent(false);
      // Don't reset animationKey here - let it increment on next open
    }
  }, [isOpen, editionId]);

  if (!isOpen || !editionId) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[6000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Newspaper Animation Container - Full Screen */}
          <div className="fixed inset-0 z-[6001] pointer-events-none">
            <motion.div
              key={`newspaper-${animationKey}`}
              className="w-full h-full pointer-events-auto relative"
              initial={{ scale: 0.3, opacity: 0, y: 100, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -50, rotate: 5 }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 15,
                duration: 1.2,
              }}
              onAnimationStart={() => {
                console.log("📰 Newspaper Animation: Entrance animation started");
              }}
              onAnimationComplete={() => {
                console.log("📰 Newspaper Animation: Entrance animation completed");
                // After entrance animation, wait a bit then show content
                setTimeout(() => {
                  setShowContent(true);
                  console.log("📰 Newspaper Animation: Content displayed - waiting for user to click 'Proceed'");
                }, 300);
              }}
            >
              {/* Newspaper Content - No Frame - Full Screen */}
              <AnimatePresence>
                {showContent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="w-full h-full bg-white"
                  >
                    <iframe
                      src={`/newspaper?id=${editionId}`}
                      className="w-full h-full border-0"
                      title="Published Newspaper"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Proceed to Morning Report Button - Only shown after animation */}
              <AnimatePresence>
                {showContent && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="absolute top-8 right-8 z-20"
                  >
                    <button
                      onClick={() => {
                        console.log("📰 Newspaper Animation: 'Proceed' button clicked - proceeding to Morning Report");
                        onClose();
                        onAnimationComplete();
                      }}
                      className="px-8 py-4 bg-[#d4af37] text-[#1a0f08] font-bold text-lg rounded-lg border-2 border-[#8b6f47] hover:bg-[#e5c04a] transition-colors shadow-xl"
                    >
                      Proceed
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

