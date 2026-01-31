"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, ChevronRight } from "lucide-react";

interface TutorialTooltipProps {
  message: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  hideButtons?: boolean; // Hide skip/next buttons for specific steps
  position?: 'default' | 'top-right'; // Position of the tooltip
}

export default function TutorialTooltip({
  message,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  hideButtons = false,
  position = 'default',
}: TutorialTooltipProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Determine container class based on position
  const containerClass = position === 'top-right' 
    ? "bg-[#f4e4bc] border-2 border-[#8b6f47] rounded-lg shadow-2xl p-6 max-w-sm"
    : "bg-[#f4e4bc] border-2 border-[#8b6f47] rounded-lg shadow-2xl p-6 max-w-sm";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: position === 'top-right' ? 20 : -20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: position === 'top-right' ? 20 : -20 }}
      transition={{ duration: 0.3 }}
      className={containerClass}
      style={{
        boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
        transform: position === 'top-right' ? "rotate(1deg)" : "rotate(-1deg)",
      }}
    >
      {/* Vintage paper texture overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none rounded-lg"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04 0.8' numOctaves='4'/%3E%3CfeColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.1 0 0 0 0 0.05 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#2a1810] font-serif mb-1">
              TUTORIAL
            </h3>
            <p className="text-xs text-[#5a4a3a] font-mono">
              Step {currentStep + 1} of {totalSteps}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-[#5a4a3a] hover:text-[#2a1810] transition-colors p-1"
            aria-label="Skip tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-1.5 bg-[#8b6f47]/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-[#8b6f47]"
            />
          </div>
        </div>

        {/* Message */}
        <p className="text-[#2a1810] mb-6 leading-relaxed font-serif">
          {message}
        </p>

        {/* Actions */}
        {!hideButtons && (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm text-[#5a4a3a] hover:text-[#2a1810] font-mono transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onNext}
              className="px-6 py-2 bg-[#8b6f47] text-[#f4e4bc] rounded hover:bg-[#6b5537] transition-colors font-mono text-sm font-bold flex items-center gap-2 shadow-lg"
              style={{
                boxShadow: "0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              {currentStep + 1 === totalSteps ? "Finish" : "Next"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

