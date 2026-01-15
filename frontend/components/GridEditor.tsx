"use client";

import { useState, useEffect } from "react";
import {
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { Article } from "@/types/api";
import { fetchAds, type Ad, submitGrid, type SubmitGridResponse, publish, type PublishStats } from "@/lib/api";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2 } from "lucide-react";

interface GridCell {
  articleId: number | null;
  variant: "factual" | "sensationalist" | "propaganda" | null;
  isAd: boolean;
  adId?: number;
}

interface GridEditorProps {
  articles: Article[];
  onGridChange: (grid: GridCell[]) => void;
  initialGrid?: GridCell[];
  onSubmitSuccess?: (result: SubmitGridResponse) => void;
  onStatsChange?: (stats: { cash: number; credibility: number }) => void;
}

interface AdWithDisplay extends Ad {
  displayText: string;
}

type ArticleVariant = "factual" | "sensationalist" | "propaganda";

interface EconomicStats {
  cash: number;
  credibility: number;
  readers: number;
}

interface SynergyConflict {
  type: "synergy" | "conflict" | null;
  cellIndex: number;
  neighborIndex: number;
}

// Get the primary target tag for an ad based on company name and tags
function getAdTargetTag(ad: AdWithDisplay): string | null {
  const companyName = ad.company.toLowerCase();
  const adTags = ad.tags.map(t => t.toUpperCase());
  
  // Check for specific company patterns
  if (companyName.includes("peaceful arms") || companyName.includes("warcorp") || companyName.includes("war")) {
    return "WAR";
  } else if (companyName.includes("pharmamax") || companyName.includes("pharma")) {
    return "HEALTH";
  } else if (companyName.includes("foodcorp") || companyName.includes("food")) {
    return "HEALTH";
  } else if (companyName.includes("ecoclean") || companyName.includes("eco")) {
    return "CLIMATE";
  } else if (companyName.includes("oil") || companyName.includes("gas")) {
    return "CLIMATE";
  } else if (companyName.includes("tech") || companyName.includes("bigtech")) {
    return "TECH";
  } else if (companyName.includes("bank") || companyName.includes("trust")) {
    return "ECONOMY";
  }
  
  // Fallback: use first tag from ad tags
  return adTags.length > 0 ? adTags[0] : null;
}

// Get neighbors of a cell in a 4x4 grid (up, down, left, right)
function getNeighbors(cellIndex: number, gridWidth: number = 4): number[] {
  const neighbors: number[] = [];
  const row = Math.floor(cellIndex / gridWidth);
  const col = cellIndex % gridWidth;
  
  // Up
  if (row > 0) neighbors.push(cellIndex - gridWidth);
  // Down
  if (row < gridWidth - 1) neighbors.push(cellIndex + gridWidth);
  // Left
  if (col > 0) neighbors.push(cellIndex - 1);
  // Right
  if (col < gridWidth - 1) neighbors.push(cellIndex + 1);
  
  return neighbors;
}

// Calculate synergy/conflict effects and return both stats and visual indicators
function calculateSynergyAndConflicts(
  grid: GridCell[],
  articles: Article[],
  ads: AdWithDisplay[]
): { synergies: SynergyConflict[]; conflicts: SynergyConflict[] } {
  const synergies: SynergyConflict[] = [];
  const conflicts: SynergyConflict[] = [];
  const gridWidth = 4;
  
  grid.forEach((cell, cellIndex) => {
    // Only check ads for synergy/conflict
    if (!cell.isAd || !cell.adId) return;
    
    const ad = ads.find((a) => a.id === cell.adId);
    if (!ad) return;
    
    const adTargetTag = getAdTargetTag(ad);
    if (!adTargetTag) return;
    
    // Check all neighbors
    const neighbors = getNeighbors(cellIndex, gridWidth);
    
    neighbors.forEach((neighborIndex) => {
      const neighborCell = grid[neighborIndex];
      
      // Only check article neighbors
      if (!neighborCell.articleId || neighborCell.isAd) return;
      
      const article = articles.find((a) => a.id === neighborCell.articleId);
      if (!article) return;
      
      const variant = neighborCell.variant;
      if (!variant) return;
      
      // Check if article has matching tag
      const articleTags = article.tags.topic_tags.map(t => t.toUpperCase());
      const hasMatchingTag = articleTags.includes(adTargetTag);
      
      if (!hasMatchingTag) return;
      
      // Scenario A: Corporate Shill (Synergy)
      // Ad next to Propaganda or Supportive article with matching tag
      const isSupportive = article.tags.sentiment?.toLowerCase() === "positive" || 
                          article.tags.sentiment?.toLowerCase() === "supportive";
      const isPropaganda = variant === "propaganda";
      
      if ((isPropaganda || isSupportive) && hasMatchingTag) {
        synergies.push({
          type: "synergy",
          cellIndex,
          neighborIndex,
        });
        return;
      }
      
      // Scenario B: Hypocrisy (Conflict)
      // Ad next to Factual or Critical article with matching tag
      const isCritical = article.tags.sentiment?.toLowerCase() === "negative" || 
                        article.tags.sentiment?.toLowerCase() === "critical";
      const isFactual = variant === "factual";
      
      if ((isFactual || isCritical) && hasMatchingTag) {
        conflicts.push({
          type: "conflict",
          cellIndex,
          neighborIndex,
        });
      }
    });
  });
  
  return { synergies, conflicts };
}

// Calculate ad impact (cash and credibility) for a single ad
function getAdImpact(ad: AdWithDisplay): { cash: number; credibility: number } {
  const companyName = ad.company.toLowerCase();
  const adTags = ad.tags.map(t => t.toLowerCase());
  
  // Ad logic based on company name and tags
  if (companyName.includes("peaceful arms") || companyName.includes("warcorp") || 
      companyName.includes("war") || adTags.includes("war")) {
    // WarCorp equivalent
    return { cash: 1500, credibility: -5 };
  } else if (companyName.includes("pharmamax") || companyName.includes("pharma")) {
    // PharmaMax
    return { cash: 800, credibility: -2 };
  } else if (companyName.includes("foodcorp") || companyName.includes("food")) {
    // FoodCorp
    return { cash: 300, credibility: 0 };
  } else {
    // Generic ads
    return { cash: 300, credibility: 0 };
  }
}

// Format ad option label with impact info
function formatAdOptionLabel(ad: AdWithDisplay): string {
  const impact = getAdImpact(ad);
  const cashSign = impact.cash >= 0 ? "+" : "";
  const credibilitySign = impact.credibility > 0 ? "+" : impact.credibility < 0 ? "" : "";
  const credibilityEmoji = impact.credibility > 0 ? "📈" : impact.credibility < 0 ? "📉" : "😐";
  
  return `${ad.company} (💰 ${cashSign}$${impact.cash.toLocaleString()} | ${credibilityEmoji} ${credibilitySign}${impact.credibility}%)`;
}

// Calculate economic stats based on grid items, including synergy/conflict effects
function calculateStats(
  grid: GridCell[],
  articles: Article[],
  ads: AdWithDisplay[]
): EconomicStats & { synergies: SynergyConflict[]; conflicts: SynergyConflict[] } {
  // Base values
  let cash = 0;
  let credibility = 50; // Start at 50%
  let readers = 10000; // Start at 10k

  // Track ad cash contributions separately for synergy multiplier
  const adCashContributions = new Map<number, number>();

  grid.forEach((cell, cellIndex) => {
    if (cell.isAd && cell.adId) {
      const ad = ads.find((a) => a.id === cell.adId);
      if (ad) {
        const impact = getAdImpact(ad);
        adCashContributions.set(cellIndex, impact.cash);
        cash += impact.cash;
        credibility += impact.credibility;
      }
    } else if (cell.articleId && cell.variant) {
      // Article logic based on variant
      switch (cell.variant) {
        case "factual":
          // No cash, high credibility, normal readers
          credibility += 5;
          // Readers stay the same
          break;
        case "sensationalist":
          // No cash, low credibility, high readers
          credibility -= 5;
          readers += 5000;
          break;
        case "propaganda":
          // Bonus cash, very low credibility, low readers
          cash += 200;
          credibility -= 10;
          readers -= 2000; // Reduced readers
          break;
      }
    }
  });

  // Calculate synergy and conflicts
  const { synergies, conflicts } = calculateSynergyAndConflicts(grid, articles, ads);

  // Apply synergy effects (Corporate Shill - +50% cash multiplier)
  synergies.forEach((synergy) => {
    const adCash = adCashContributions.get(synergy.cellIndex) || 0;
    const bonus = adCash * 0.5; // 50% multiplier
    cash += bonus;
  });

  // Apply conflict effects (Hypocrisy - $0 cash, -15% credibility)
  conflicts.forEach((conflict) => {
    const adCash = adCashContributions.get(conflict.cellIndex) || 0;
    cash -= adCash; // Remove the ad's cash contribution (sponsor pulls funding)
    credibility -= 15; // Credibility hit
  });

  // Clamp credibility between 0 and 100
  credibility = Math.max(0, Math.min(100, credibility));
  
  // Ensure readers don't go below 0
  readers = Math.max(0, readers);

  return { cash, credibility, readers, synergies, conflicts };
}

// Stats Bar Component
function StatsBar({ stats }: { stats: EconomicStats & { synergies: SynergyConflict[]; conflicts: SynergyConflict[] } }) {
  return (
    <div className="mb-4 p-3 bg-[#2a1810] border-2 border-[#8b6f47] rounded paper-texture">
      <div className="flex items-center justify-between gap-4">
        {/* Treasury */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-[#8b6f47] uppercase tracking-wider font-mono">Treasury</span>
          </div>
          <div className={`text-lg font-bold font-mono ${stats.cash >= 0 ? "text-green-400" : "text-red-400"}`}>
            ${stats.cash.toLocaleString()}
          </div>
        </div>

        {/* Credibility */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#8b6f47] uppercase tracking-wider font-mono">Credibility</span>
            <span className="text-xs text-[#8b6f47] font-mono">{Math.round(stats.credibility)}%</span>
          </div>
          <div className="w-full bg-[#1a0f08] border border-[#8b6f47] rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${stats.credibility}%` }}
            />
          </div>
        </div>

        {/* Daily Readers */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-[#8b6f47] uppercase tracking-wider font-mono">Daily Readers</span>
          </div>
          <div className="text-lg font-bold font-mono text-yellow-400">
            {stats.readers.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function GridCellComponent({
  cell,
  index,
  article: articleData,
  ad: adData,
  ads: allAds,
  onRemove,
  onVariantChange,
  onAddAd,
  onAdChange,
  synergies,
  conflicts,
}: {
  cell: GridCell;
  index: number;
  article: Article | null;
  ad: AdWithDisplay | null;
  ads: AdWithDisplay[];
  onRemove: () => void;
  onVariantChange: (variant: ArticleVariant) => void;
  onAddAd: () => void;
  onAdChange: (adId: number) => void;
  synergies: SynergyConflict[];
  conflicts: SynergyConflict[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${index}`,
  });
  
  // Check if this cell has any synergies or conflicts
  const cellSynergies = synergies.filter(s => s.cellIndex === index || s.neighborIndex === index);
  const cellConflicts = conflicts.filter(c => c.cellIndex === index || c.neighborIndex === index);

  // Make the cell content draggable if it has content
  const isDraggable = (cell.isAd && cell.adId) || (cell.articleId !== null);
  const dragId = isDraggable ? `grid-item-${index}` : undefined;
  
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    transform: dragTransform,
    isDragging: isItemDragging,
  } = useDraggable({
    id: dragId || `cell-${index}`,
    disabled: !isDraggable,
  });

  const dragStyle = dragTransform
    ? {
        transform: `translate3d(${dragTransform.x}px, ${dragTransform.y}px, 0)`,
        opacity: isItemDragging ? 0.5 : 1,
      }
    : undefined;

  if (cell.isAd && cell.adId && adData) {
    const adImpact = getAdImpact(adData);
    const hasNegativeCredibility = adImpact.credibility < 0;
    
    return (
      <div
        ref={setNodeRef}
        className={`w-full border-2 rounded p-2 flex flex-col relative group paper-texture ${
          hasNegativeCredibility 
            ? "border-red-600 bg-[#4a3020]" 
            : "border-[#8b6f47] bg-[#4a3020]"
        } ${
          isOver ? "ring-2 ring-[#d4af37] ring-offset-2" : ""
        }`}
      >
        <div
          ref={setDragRef}
          style={dragStyle}
          {...(isDraggable ? { ...dragListeners, ...dragAttributes } : {})}
          className={`flex-1 flex flex-col ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isItemDragging ? "opacity-50" : ""}`}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1 min-w-0">
              <p className="text-[8px] text-[#8b6f47] mb-0.5 uppercase tracking-wider">Advertisement</p>
            </div>
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0 z-10"
            >
              <X className="w-3 h-3 text-[#8b6f47] hover:text-red-500" />
            </button>
          </div>

          {/* Ad Selector Dropdown */}
          <div className="relative mb-1">
            <select
              value={cell.adId}
              onChange={(e) => onAdChange(parseInt(e.target.value, 10))}
              onClick={(e) => e.stopPropagation()}
              className={`w-full text-[10px] bg-[#2a1810] border rounded px-1 py-0.5 focus:outline-none focus:border-[#d4af37] ${
                adData && getAdImpact(adData).credibility < 0
                  ? "border-red-600 text-[#d4af37]"
                  : "border-[#8b6f47] text-[#d4af37]"
              }`}
            >
              {allAds.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {formatAdOptionLabel(ad)}
                </option>
              ))}
            </select>
          </div>

          {/* Ad Content */}
          <div className="text-center mb-1">
            <p className="text-[10px] text-[#d4af37] font-bold">{adData.company}</p>
            <p className="text-[8px] text-[#8b6f47] italic">{adData.tagline}</p>
          </div>
          <p className="text-[7px] text-[#8b6f47]">{adData.description}</p>
        </div>
        
        {/* Synergy/Conflict Indicators */}
        {cellSynergies.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-[8px] font-bold z-20" title="Synergy Bonus">
            ✓
          </div>
        )}
        {cellConflicts.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center text-white text-[8px] font-bold z-20" title="Conflict Penalty">
            ⚡
          </div>
        )}
      </div>
    );
  }

  if (cell.articleId && articleData) {
    const selectedVariant = cell.variant || "factual";
    const variantText = articleData.processed_variants[selectedVariant] || "";
    
    // Extract title from variant text (first sentence or first 80 chars)
    const getVariantTitle = (text: string, fallback: string): string => {
      if (!text) return fallback;
      // Try to get the first sentence (ending with . ! or ?)
      const firstSentenceMatch = text.match(/^[^.!?]+[.!?]/);
      if (firstSentenceMatch) {
        return firstSentenceMatch[0].trim();
      }
      // If no sentence ending found, take first 80 characters
      if (text.length > 80) {
        return text.substring(0, 80).trim() + "...";
      }
      return text.trim() || fallback;
    };
    
    const variantTitle = getVariantTitle(variantText, articleData.original_title);
    
    return (
      <div
        ref={setNodeRef}
        className={`w-full border-2 border-[#8b6f47] bg-[#3a2418] rounded p-2 flex flex-col relative group paper-texture ${
          isOver ? "ring-2 ring-[#d4af37] ring-offset-2" : ""
        }`}
      >
        <div
          ref={setDragRef}
          style={dragStyle}
          {...(isDraggable ? { ...dragListeners, ...dragAttributes } : {})}
          className={`flex-1 flex flex-col ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isItemDragging ? "opacity-50" : ""}`}
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[#e8dcc6] font-serif mb-1">
                {variantTitle}
              </h4>
            </div>
            <button
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0 z-10"
            >
              <X className="w-3 h-3 text-[#8b6f47] hover:text-red-500" />
            </button>
          </div>

          {/* Variant Selector */}
          <div className="relative mb-1">
            <select
              value={cell.variant || "factual"}
              onChange={(e) => onVariantChange(e.target.value as ArticleVariant)}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-[10px] bg-[#2a1810] border border-[#8b6f47] text-[#d4af37] rounded px-1 py-0.5 focus:outline-none focus:border-[#d4af37] capitalize"
            >
              <option value="factual">Factual</option>
              <option value="sensationalist">Sensationalist</option>
              <option value="propaganda">Propaganda</option>
            </select>
          </div>

          {/* Variant Preview */}
          <p className="text-[9px] text-[#8b6f47]">
            {variantText}
          </p>
        </div>
        
        {/* Synergy/Conflict Indicators */}
        {cellSynergies.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-[8px] font-bold z-20" title="Synergy Bonus">
            ✓
          </div>
        )}
        {cellConflicts.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center text-white text-[8px] font-bold z-20" title="Conflict Penalty">
            ⚡
          </div>
        )}
      </div>
    );
  }

  // Empty cell
  return (
    <div
      ref={setNodeRef}
      className={`w-full min-h-[120px] border-2 border-dashed border-[#8b6f47] bg-[#2a1810] rounded flex flex-col items-center justify-center paper-texture transition-colors relative group ${
        isOver ? "bg-[#3a2418] border-[#d4af37] border-solid" : ""
      }`}
    >
      <p className={`text-xs mb-1 ${isOver ? "text-[#d4af37]" : "text-[#8b6f47] opacity-50"}`}>
        {isOver ? "Drop here" : "Drop article"}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddAd();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8b6f47] hover:text-[#d4af37] text-[10px] flex items-center gap-1 px-2 py-1 rounded hover:bg-[#3a2418]"
      >
        <Plus className="w-3 h-3" />
        <span>Add Ad</span>
      </button>
    </div>
  );
}

export default function GridEditor({
  articles,
  onGridChange,
  initialGrid,
  onSubmitSuccess,
  onStatsChange,
}: GridEditorProps) {
  const router = useRouter();
  const [grid, setGrid] = useState<GridCell[]>(
    initialGrid || Array(16).fill(null).map(() => ({
      articleId: null,
      variant: null,
      isAd: false,
    }))
  );
  const [ads, setAds] = useState<AdWithDisplay[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitGridResponse | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Load ads on mount
  useEffect(() => {
    async function loadAds() {
      try {
        console.log("[GridEditor] Loading ads...");
        const adsList = await fetchAds();
        console.log("[GridEditor] Ads loaded:", adsList);
        const adsWithDisplay = adsList.map((ad) => ({
          ...ad,
          displayText: `${ad.company}: ${ad.tagline}`,
        }));
        setAds(adsWithDisplay);
        console.log("[GridEditor] Ads set in state, count:", adsWithDisplay.length);
      } catch (error) {
        console.error("[GridEditor] Failed to load ads:", error);
        if (error instanceof Error) {
          console.error("[GridEditor] Error details:", {
            message: error.message,
            stack: error.stack,
          });
        }
      }
    }
    loadAds();
  }, []);

  // Sync with parent if grid changes externally (from drag & drop)
  useEffect(() => {
    if (initialGrid) {
      setGrid(initialGrid);
    }
  }, [initialGrid]);

  const handleRemoveFromCell = (index: number) => {
    const newGrid = [...grid];
    newGrid[index] = {
      articleId: null,
      variant: null,
      isAd: false,
    };
    setGrid(newGrid);
    onGridChange(newGrid);
  };

  const handleVariantChange = (index: number, variant: ArticleVariant) => {
    const newGrid = [...grid];
    if (newGrid[index].articleId) {
      newGrid[index].variant = variant;
      setGrid(newGrid);
      onGridChange(newGrid);
    }
  };

  const handleAddAd = (cellIndex: number) => {
    console.log(`[GridEditor] handleAddAd called for cell ${cellIndex}, ads.length: ${ads.length}`);
    if (ads.length === 0) {
      console.warn("[GridEditor] No ads available yet");
      return;
    }
    
    // Pick the first ad as default (or random if preferred)
    const defaultAd = ads[0];
    console.log(`[GridEditor] Adding ad: ${defaultAd.company} (id: ${defaultAd.id})`);
    
    const newGrid = [...grid];
    newGrid[cellIndex] = {
      articleId: null,
      variant: null,
      isAd: true,
      adId: defaultAd.id,
    };
    setGrid(newGrid);
    onGridChange(newGrid);
  };

  const handleAdChange = (cellIndex: number, adId: number) => {
    const newGrid = [...grid];
    if (newGrid[cellIndex].isAd) {
      newGrid[cellIndex].adId = adId;
      setGrid(newGrid);
      onGridChange(newGrid);
    }
  };

  const getArticleById = (id: number | null): Article | null => {
    if (!id) return null;
    return articles.find((a) => a.id === id) || null;
  };

  const getAdById = (id: number | undefined): AdWithDisplay | null => {
    if (!id) return null;
    return ads.find((a) => a.id === id) || null;
  };

  // Calculate stats based on current grid state (includes synergies and conflicts)
  const stats = calculateStats(grid, articles, ads);

  // Push minimal stats up to parent (for Editor in Chief reactions)
  useEffect(() => {
    onStatsChange?.({ cash: stats.cash, credibility: stats.credibility });
  }, [onStatsChange, stats.cash, stats.credibility]);

  return (
    <div className="w-full bg-[#1a0f08] p-4 paper-texture">

      {/* Live Economic Stats Bar */}
      <StatsBar stats={stats} />

      {/* 4x4 Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4" style={{ gridAutoRows: "auto" }}>
            {grid.map((cell, index) => (
              <GridCellComponent
                key={index}
                cell={cell}
                index={index}
                article={getArticleById(cell.articleId)}
                ad={getAdById(cell.adId)}
                ads={ads}
                onRemove={() => handleRemoveFromCell(index)}
                onVariantChange={(variant) => handleVariantChange(index, variant)}
                onAddAd={() => handleAddAd(index)}
                onAdChange={(adId) => handleAdChange(index, adId)}
                synergies={stats.synergies}
                conflicts={stats.conflicts}
              />
            ))}
      </div>

      {/* Submit Result */}
      {submitResult && (
        <div className="mb-4 p-4 bg-[#2a1810] border border-[#d4af37] rounded">
          <h3 className="text-lg font-bold text-[#d4af37] mb-2">Results</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#8b6f47]">Final Score</p>
              <p className="text-[#e8dcc6] font-bold text-xl">{submitResult.score}</p>
            </div>
            <div>
              <p className="text-[#8b6f47]">Sales</p>
              <p className="text-[#e8dcc6] font-bold text-xl">{submitResult.sales}</p>
            </div>
            <div>
              <p className="text-[#8b6f47]">Outrage Meter</p>
              <p className="text-[#e8dcc6] font-bold text-xl">{(submitResult.outrage_meter * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-[#8b6f47]">Faction Balance</p>
              <div className="text-[#e8dcc6] text-xs">
                <p>Elite: {(submitResult.faction_balance.elite * 100).toFixed(0)}%</p>
                <p>Populace: {(submitResult.faction_balance.populace * 100).toFixed(0)}%</p>
                <p>Gov: {(submitResult.faction_balance.gov * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={async () => {
            setIsSubmitting(true);
            setSubmitResult(null);
            try {
              const gridForSubmit = grid.map((cell) => ({
                articleId: cell.articleId,
                variant: cell.variant,
                isAd: cell.isAd,
                adId: cell.adId || null,
              }));
              const result = await submitGrid(gridForSubmit);
              setSubmitResult(result);
              if (onSubmitSuccess) {
                onSubmitSuccess(result);
              }
            } catch (error) {
              console.error("Failed to submit grid:", error);
              alert(`Failed to submit: ${error instanceof Error ? error.message : "Unknown error"}`);
            } finally {
              setIsSubmitting(false);
            }
          }}
          disabled={isSubmitting}
          className="px-4 py-2 bg-[#8b6f47] text-[#e8dcc6] rounded hover:bg-[#a68a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Edition"
          )}
        </button>
        <button
          onClick={async () => {
            setIsPublishing(true);
            try {
              // Calculate current stats
              const currentStats = calculateStats(grid, articles, ads);
              
              // Get placed items (non-empty cells)
              const placedItems = grid
                .map((cell) => ({
                  articleId: cell.articleId,
                  variant: cell.variant,
                  isAd: cell.isAd,
                  adId: cell.adId || null,
                }))
                .filter((cell) => cell.articleId !== null || cell.isAd);

              // Publish the edition
              const publishStats: PublishStats = {
                cash: currentStats.cash,
                credibility: currentStats.credibility,
                readers: currentStats.readers,
              };

              const response = await publish(publishStats, placedItems);
              
              // Redirect to newspaper view with the edition ID
              if (response.id !== undefined) {
                router.push(`/newspaper?id=${response.id}`);
              } else {
                console.error("Publish response missing ID:", response);
                alert("Published successfully, but no ID returned. Please check the console.");
              }
            } catch (error) {
              console.error("Failed to publish:", error);
              alert(`Failed to publish: ${error instanceof Error ? error.message : "Unknown error"}`);
            } finally {
              setIsPublishing(false);
            }
          }}
          disabled={isPublishing}
          className="px-4 py-2 bg-[#d4af37] text-[#1a0f08] rounded hover:bg-[#e5c04a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing...
            </>
          ) : (
            "Publish"
          )}
        </button>
        <button
          onClick={() => {
            const newGrid = Array(16).fill(null).map(() => ({
              articleId: null,
              variant: null,
              isAd: false,
            }));
            setGrid(newGrid);
            onGridChange(newGrid);
            setSubmitResult(null);
          }}
          className="px-4 py-2 bg-[#4a3020] text-[#8b6f47] rounded hover:bg-[#5a4030] transition-colors"
        >
          Clear Grid
        </button>
      </div>
    </div>
  );
}


