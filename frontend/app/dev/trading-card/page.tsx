"use client";

import React from "react";
import NewspaperTradingCard from "@/components/cards/NewspaperTradingCard";

export default function TradingCardDevPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-[#e6d5ac]">
            NewspaperTradingCard Dev Preview
          </h1>
          <p className="text-sm text-[#8b6f47] mt-1">
            Temporary dev page. Remove when done: <code>frontend/app/dev/trading-card/page.tsx</code>
          </p>
        </div>

        <div className="flex flex-wrap gap-8 items-start">
          <NewspaperTradingCard
            headline="GOVERNMENT BLACKOUT ORDERED"
            editionTag="Vol. 4 — Breaking News"
            imageUrl="/images/reporter-card.jpg"
            effectText={
              "**GLOBAL PANIC —** Authorities insist the outage is \"routine maintenance,\" but unconfirmed reports speak of silent streets, dead comms, and patrols moving in the dark. Citizens are urged to remain indoors, though no official explanation has been offered."
            }
            onClick={() => console.log("[TradingCard] clicked: BLACKOUT")}
          />

          <NewspaperTradingCard
            headline="CYBORG STRIKE HALTS FACTORIES"
            editionTag="Late City Edition"
            effectText={
              "**IRON FISTS —** Augmented workers walk off the line after management installs new obedience firmware. Production stalls, markets twitch, and someone, somewhere, is already selling the exclusive rights to the story."
            }
            onClick={() => console.log("[TradingCard] clicked: CYBORG STRIKE")}
          />

          <NewspaperTradingCard
            headline="UNLICENSED BROADCAST JAMMED"
            editionTag="Underground Print"
            effectText={
              "**SILENCED SIGNAL —** A rogue transmission promising \"uncut truth\" vanishes mid-sentence as bands go dead. Officials deny involvement. The Resistance calls it proof they were getting too close."
            }
            onClick={() => console.log("[TradingCard] clicked: BROADCAST JAMMED")}
          />
        </div>
      </div>
    </div>
  );
}


