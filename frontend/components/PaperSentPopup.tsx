"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, X } from "lucide-react";

interface PaperSentPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaperSentPopup({ isOpen, onClose }: PaperSentPopupProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[6000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Popup */}
          <motion.div
            className="fixed inset-0 z-[6001] flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div
              className="bg-[#1a0f08] border-2 border-[#d4af37] rounded-lg shadow-2xl p-8 max-w-md w-full pointer-events-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-[#8b6f47] hover:text-[#e8dcc6] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className="flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 bg-[#d4af37]/20 rounded-full flex items-center justify-center"
                >
                  <Printer className="w-10 h-10 text-[#d4af37]" />
                </motion.div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-serif font-bold text-[#e8dcc6] text-center mb-4">
                Paper Sent to Press
              </h2>

              {/* Message */}
              <p className="text-[#e8dcc6] text-center mb-6 leading-relaxed">
                Your newspaper has been sent to the printing press. Tomorrow morning, your published paper will be available along with your scores.
              </p>

              {/* Button */}
              <div className="flex justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-[#d4af37] text-[#1a0f08] font-bold rounded border border-[#8b6f47] hover:bg-[#e5c04a] transition-colors"
                >
                  Understood
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

