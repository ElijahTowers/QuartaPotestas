"use client";

import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AudienceScores } from "@/types/api";

interface AudienceRadarProps {
  audienceScores: AudienceScores;
  size?: "small" | "medium" | "large";
}

// Faction display names (more readable)
const FACTION_NAMES: Record<keyof AudienceScores, string> = {
  elite: "Elite",
  working_class: "Working Class",
  patriots: "Patriots",
  syndicate: "Syndicate",
  technocrats: "Technocrats",
  faithful: "Faithful",
  resistance: "Resistance",
  doomers: "Doomers",
};

// Color mapping for each faction
const FACTION_COLORS: Record<keyof AudienceScores, string> = {
  elite: "#d4af37", // Gold
  working_class: "#8b6f47", // Brown
  patriots: "#a44a3f", // Red
  syndicate: "#2f2f2f", // Dark gray/black
  technocrats: "#4a90e2", // Blue
  faithful: "#6b8e23", // Olive green
  resistance: "#ff6b6b", // Light red
  doomers: "#8b4513", // Saddle brown
};

export default function AudienceRadar({
  audienceScores,
  size = "medium",
}: AudienceRadarProps) {
  // Convert audience_scores object to array format for Recharts
  const data = Object.entries(audienceScores).map(([key, value]) => ({
    faction: FACTION_NAMES[key as keyof AudienceScores],
    score: value,
    fullMark: 10,
  }));

  // Size configurations
  const sizeConfig = {
    small: { width: 300, height: 300 },
    medium: { width: 400, height: 400 },
    large: { width: 500, height: 500 },
  };

  const dimensions = sizeConfig[size];

  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-sm font-bold text-[#d4af37] mb-2 font-serif">
        Faction Impact
      </h3>
      <ResponsiveContainer width="100%" height={dimensions.height}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid
            stroke="#8b6f47"
            strokeWidth={1}
            strokeOpacity={0.3}
          />
          <PolarAngleAxis
            dataKey="faction"
            tick={{
              fill: "#e6d5ac",
              fontSize: 11,
              fontFamily: "Georgia, serif",
            }}
            tickLine={{ stroke: "#8b6f47", strokeWidth: 1 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[-10, 10]}
            tick={{
              fill: "#8b6f47",
              fontSize: 10,
              fontFamily: "Georgia, serif",
            }}
            tickCount={5}
            tickLine={{ stroke: "#8b6f47", strokeWidth: 1 }}
          />
          <Radar
            name="Impact"
            dataKey="score"
            stroke="#d4af37"
            fill="#d4af37"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={{ fill: "#d4af37", r: 3 }}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      {/* Legend with color coding */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {Object.entries(FACTION_NAMES).map(([key, name]) => {
          const score = audienceScores[key as keyof AudienceScores];
          const color = FACTION_COLORS[key as keyof AudienceScores];
          const isPositive = score > 0;
          const isNegative = score < 0;
          
          return (
            <div
              key={key}
              className="flex items-center gap-2"
              style={{ color: "#e6d5ac" }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-serif">{name}:</span>
              <span
                className={`font-bold ${
                  isPositive
                    ? "text-green-400"
                    : isNegative
                    ? "text-red-400"
                    : "text-[#8b6f47]"
                }`}
              >
                {score > 0 ? "+" : ""}
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

