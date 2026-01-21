"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type Mood = "neutral" | "angry" | "happy";
type ViewMode = "map" | "grid";

interface AssistantProps {
  message?: string;
  mood?: Mood;
  isTalking?: boolean;
  vertical?: boolean;
  viewMode?: ViewMode; // Optional viewMode for context-aware tips
}

// Context-aware tutorial tips
const MAP_TIPS = [
  "Scan the map for hotspots.",
  "News breaks fast, keep up.",
  "Click markers to read the scoop.",
];

const GRID_TIPS = [
  "Drag and drop scoops to build the front page.",
  "Don't forget to include Ads to pay the bills.",
  "Balance credibility with profit, kid.",
];

const SHOP_TIPS = [
  "Spend money to make money.",
  "Buy upgrades to reach more readers.",
  "A faster press means faster news.",
];

// Fallback tips for routes that don't match specific contexts
const DEFAULT_TIPS = [
  "Check the Wire for fresh scoops, kid.",
  "Don't let the public panic.",
  "Buy upgrades in the Shop when you have the cash.",
];

function moodEmoji(mood: Mood): string {
  switch (mood) {
    case "happy":
      return "🤑";
    case "angry":
      return "🤬";
    case "neutral":
    default:
      return "🚬";
  }
}

export default function Assistant({ 
  message: propMessage, 
  mood = "neutral", 
  isTalking = false, 
  vertical = false,
  viewMode
}: AssistantProps) {
  const pathname = usePathname();
  const [currentTip, setCurrentTip] = useState<string>("");
  const [tipIndex, setTipIndex] = useState<number>(0);
  
  // Use provided message or rotate through context-appropriate tips
  useEffect(() => {
    if (propMessage) {
      setCurrentTip(propMessage);
      return;
    }
    
    // Get context-appropriate tips based on route or viewMode
    let tips: string[] = DEFAULT_TIPS;
    
    // Check route first
    if (pathname === "/shop") {
      tips = SHOP_TIPS;
    } else if (pathname === "/grid") {
      tips = GRID_TIPS;
    } else if (pathname === "/" || !pathname || pathname === "") {
      // For home route (/), use viewMode if provided
      if (viewMode === "grid") {
        tips = GRID_TIPS;
      } else {
        // Default to map tips for home route or if viewMode is "map"
        tips = MAP_TIPS;
      }
    }
    
    // Initialize with random tip
    const initialIndex = Math.floor(Math.random() * tips.length);
    setCurrentTip(tips[initialIndex]);
    setTipIndex(initialIndex);
    
    // Rotate tips every 10 seconds
    const interval = setInterval(() => {
      setTipIndex((prev) => {
        const nextIndex = (prev + 1) % tips.length;
        setCurrentTip(tips[nextIndex]);
        return nextIndex;
      });
    }, 10000);
    
    return () => clearInterval(interval);
  }, [propMessage, pathname, viewMode]);
  
  const displayMessage = propMessage || currentTip;
  
  const emoji = moodEmoji(mood);
  const ringClass =
    mood === "happy"
      ? "border-green-500"
      : mood === "angry"
        ? "border-red-600"
        : "border-[#8b6f47]";

  if (vertical) {
    // Vertical layout: Avatar on top, bubble below
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <div
          className={`w-20 h-20 rounded-full border-2 ${ringClass} bg-[#2a1810] flex items-center justify-center shadow-lg`}
          aria-label="Editor in Chief avatar"
        >
          <span className={`text-4xl leading-none ${isTalking ? "shake-talk" : ""}`}>
            {emoji}
          </span>
        </div>

        <div className="relative w-full max-w-[240px]">
          <div className="bg-[#2a1810] border-2 border-[#8b6f47] rounded-lg px-4 py-3 shadow-lg paper-texture">
          <p className="text-sm text-[#e8dcc6] font-mono text-center">{displayMessage}</p>
          </div>
          {/* bubble tail pointing up */}
          <div className="absolute left-1/2 top-[-8px] -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-[#8b6f47]" />
          <div className="absolute left-1/2 top-[-6px] -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[7px] border-b-[#2a1810]" />
        </div>
      </div>
    );
  }

  // Horizontal layout: Avatar on left, bubble on right (original design)
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-20 h-20 rounded-full border-2 ${ringClass} bg-[#2a1810] flex items-center justify-center shadow-lg`}
        aria-label="Editor in Chief avatar"
      >
        <span className={`text-4xl leading-none ${isTalking ? "shake-talk" : ""}`}>
          {emoji}
        </span>
      </div>

      <div className="relative max-w-[520px]">
        <div className="bg-[#2a1810] border-2 border-[#8b6f47] rounded-lg px-4 py-3 shadow-lg paper-texture">
          <p className="text-sm text-[#e8dcc6] font-mono">{displayMessage}</p>
        </div>
        {/* bubble tail pointing left */}
        <div className="absolute left-[-8px] top-6 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-[#8b6f47]" />
        <div className="absolute left-[-6px] top-6 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-r-[7px] border-r-[#2a1810]" />
      </div>
    </div>
  );
}

