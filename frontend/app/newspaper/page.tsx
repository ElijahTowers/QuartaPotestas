"use client";

import { Suspense, useEffect, useRef } from "react";
import NewspaperLayout from "@/components/NewspaperLayout";

function NewspaperPageContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  
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

