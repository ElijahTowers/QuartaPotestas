"use client";

import React from "react";

interface NewspaperTradingCardProps {
  headline: string;    // The top "card name"
  effectText: string;  // The bottom description body
  editionTag?: string; // Optional small text like "Vol. 4 - Breaking News"
  imageUrl?: string;   // Optional image for the middle frame
  onClick?: () => void;
}

export default function NewspaperTradingCard({
  headline,
  effectText,
  editionTag,
  imageUrl,
  onClick,
}: NewspaperTradingCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        w-[300px] h-[420px]
        bg-[#f4e4bc]
        border-[6px] border-double border-[#1a0f08]
        shadow-xl
        rounded-[10px]
        flex flex-col
        overflow-hidden
        ${onClick ? "cursor-pointer hover:shadow-2xl transition-shadow" : ""}
        paper-texture
      `}
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {/* Inner frame to mimic ornate printed border */}
      <div className="m-[6px] h-full border-[3px] border-[#1a0f08] rounded-[6px] flex flex-col overflow-hidden bg-[#f4e4bc]">
        {/* Top Section: Headline / Card Name */}
        <div className="border-b-2 border-[#1a0f08] bg-[#f0ddad] px-3 py-2 relative">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-serif font-extrabold tracking-[0.18em] uppercase text-[#1a0f08] leading-tight">
              {headline}
            </h2>
            <div className="flex flex-col items-end gap-1">
              {editionTag && (
                <span className="text-[9px] font-serif text-[#3b2a14]">
                  {editionTag}
                </span>
              )}
              <span className="inline-block border border-[#1a0f08] px-1 py-[1px] text-[8px] font-serif font-bold uppercase tracking-[0.16em] bg-[#e0c98d]">
                Extra Edition
              </span>
            </div>
          </div>
        </div>

        {/* Middle Section: Image Frame / Placeholder */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div
            className={`
              w-full 
              h-[170px]
              bg-stone-800 
              border-[3px] border-[#1a0f08]
              relative 
              overflow-hidden
              shadow-inner
            `}
          >
            {imageUrl ? (
              <>
                {/* Ink / newsprint filter */}
                <img
                  src={imageUrl}
                  alt={headline}
                  className="w-full h-full object-cover grayscale"
                  style={{
                    filter: "contrast(1.25) sepia(0.4) brightness(0.9)",
                  }}
                />
                <div
                  className="absolute inset-0 opacity-30 mix-blend-multiply pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 2px)",
                  }}
                />
              </>
            ) : (
              <>
                {/* Grungy / noisy overlay for empty frame */}
                <div
                  className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 2px)",
                  }}
                />
                <div className="relative w-full h-full flex items-center justify-center">
                  <span className="text-[11px] italic text-[#f5f0e6] tracking-wide">
                    [ Image Pending... ]
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Divider between image and effect text */}
        <div className="border-t border-b border-[#1a0f08] mx-2 my-1" />

        {/* Bottom Section: Effect / Body Text */}
        <div className="px-3 pb-3 pt-2 flex-1 flex flex-col">
          <div className="bg-[#f7e9c3] border border-[#1a0f08] px-2 py-2 flex-1">
            <p
              className={`
                text-[11px] 
                leading-relaxed 
                text-[#1a0f08] 
                font-serif 
                text-justify
              `}
            >
              {effectText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


