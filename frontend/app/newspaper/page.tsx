"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NewspaperLayout from "@/components/NewspaperLayout";
import { ArrowLeft } from "lucide-react";

function NewspaperPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const from = searchParams.get("from");
  
  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const element = containerRef.current;
        // Remove class first
        element.classList.remove('animate-spin-slam');
        // Force reflow
        void element.offsetWidth;
        // Add class to trigger animation
        element.classList.add('animate-spin-slam');
      }
    }, 50); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="bg-black h-screen overflow-y-auto relative">
      {/* Back button */}
      <button
        onClick={() => {
          if (from === "leaderboard") {
            router.push("/leaderboard");
          } else {
            router.push("/");
          }
        }}
        className="fixed top-4 left-4 z-[1000] bg-[#1a0f08] border border-[#8b6f47] text-[#e8dcc6] px-4 py-2 rounded hover:bg-[#2a1810] hover:border-[#d4af37] transition-colors flex items-center gap-2 shadow-lg paper-texture"
        title={from === "leaderboard" ? "Back to Leaderboard" : "Back to Map"}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-serif">Back</span>
      </button>
      
      <div 
        ref={containerRef} 
        className="w-full animate-spin-slam"
      >
        <NewspaperLayout />
      </div>
    </div>
  );
}

export default function NewspaperPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f1ea] flex items-center justify-center">
        <p className="text-xl text-[#1a1a1a] font-serif">Loading...</p>
      </div>
    }>
      <NewspaperPageContent />
    </Suspense>
  );
}

