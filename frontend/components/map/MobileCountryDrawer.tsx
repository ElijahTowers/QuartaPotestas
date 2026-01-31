"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface CountryFeature {
  properties: {
    name?: string;
    [key: string]: any;
  };
  geometry: any;
  id?: string;
}

interface MobileCountryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  country: CountryFeature | null;
  articleCount: number;
}

export default function MobileCountryDrawer({
  isOpen,
  onClose,
  country,
  articleCount,
}: MobileCountryDrawerProps) {
  if (!country) return null;

  const countryName = country.properties?.name || "Unknown Country";

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
            className="fixed inset-0 bg-black/60 z-[50]"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-[#f9f6f0] paper-texture border-t-2 border-[#8b6f47] z-[51] rounded-t-2xl shadow-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-[#8b6f47] rounded-full" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-[#8b6f47] flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#1a0f08] font-serif">
                {countryName}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded hover:bg-[#e6d5ac] text-[#8b6f47] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-4">
                {/* Article Count */}
                <div className="bg-[#f4e4bc] p-4 rounded-lg border border-[#8b6f47]">
                  <p className="text-sm text-[#8b6f47] mb-1 font-serif uppercase tracking-wider">
                    Published Articles
                  </p>
                  <p className="text-3xl font-bold text-[#1a0f08] font-serif">
                    {articleCount}
                  </p>
                  <p className="text-xs text-[#8b6f47] mt-1 italic">
                    {articleCount === 1 ? "article" : "articles"} from this region
                  </p>
                </div>

                {/* Additional Info */}
                {articleCount > 0 && (
                  <div className="text-sm text-[#1a0f08] font-serif">
                    <p className="text-[#8b6f47] mb-2">
                      Your publication has coverage in this region. Tap on the map to explore articles.
                    </p>
                  </div>
                )}

                {articleCount === 0 && (
                  <div className="text-sm text-[#8b6f47] font-serif italic">
                    <p>No articles published from this region yet.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

