"use client";

import { Suspense } from "react";
import NewspaperLayout from "@/components/NewspaperLayout";
import { useGame } from "@/context/GameContext";

function NewspaperPageContent() {
  const { newspaperName } = useGame();
  
  return (
    <div className="bg-[#f4f1ea] h-screen overflow-y-auto">
      <NewspaperLayout newspaperName={newspaperName} />
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

