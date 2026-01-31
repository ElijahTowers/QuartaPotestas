"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { DailyEdition, Article } from "@/types/api";
import { fetchLatestArticles, fetchAds, resetAndIngestWithPolling, publish, type Ad, type PublishStats, hasPublishedToday, getYesterdayEdition, getDayBeforeYesterdayEdition, getRecentTransactions, type PublishedEditionResponse } from "@/lib/api";
import Wire from "@/components/Wire";
import Assistant from "@/components/Assistant";
import ShopModal from "@/components/ShopModal";
import MorningReport from "@/components/MorningReport";
import PaperSentPopup from "@/components/PaperSentPopup";
import NewspaperAnimation from "@/components/NewspaperAnimation";
import ContentSelectionModal from "@/components/ContentSelectionModal";
import MobileDrawer from "@/components/MobileDrawer";
import { useMobile } from "@/lib/hooks/useMobile";
import { Loader2, AlertCircle, X, GripVertical, ChevronDown, Newspaper, Megaphone, Map as MapIcon, LayoutGrid, RefreshCw, ShoppingBag, Briefcase, Trophy, BookOpen, Menu, Printer, Calendar } from "lucide-react";
import { useGame } from "@/context/GameContext";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

// Admin email - only this user can fetch new scoops
const ADMIN_EMAIL = "lowiehartjes@gmail.com";

type ZoneType = "row1" | "row2" | "row3";
type VariantType = "factual" | "sensationalist" | "propaganda";

interface PlacedArticle {
  type: "article";
  articleId: string; // Changed from number to string (PocketBase ID)
  variant: VariantType;
  zoneId: string; // e.g., "row1_0", "row2_0", "row3_1"
}

interface PlacedAd {
  type: "ad";
  adId: string;  // Changed from number to string
  zoneId: string;
}

type PlacedItem = PlacedArticle | PlacedAd;

interface ZoneState {
  row1: PlacedItem[]; // 1 artikel/advertentie (breed)
  row2: PlacedItem[]; // 2 artikelen/advertenties naast elkaar
  row3: PlacedItem[]; // 3 artikelen/advertenties naast elkaar
}

// Sub-Lead Article Component
function SubLeadArticle({
  article,
  variant,
  onDelete,
  onVariantChange,
  dragId,
}: {
  article: Article;
  variant: VariantType;
  onDelete: () => void;
  onVariantChange: (variant: VariantType) => void;
  dragId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const [showControls, setShowControls] = useState(false);
  const [showVariantMenu, setShowVariantMenu] = useState(false);

  const variantText = article.processed_variants[variant] || article.processed_variants.factual;
  const headline = variantText.split(/[.!?]/)[0] || article.original_title;
  const body = variantText;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="relative border-b border-[#1a1a1a] pb-4 group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        setShowControls(false);
        setShowVariantMenu(false);
      }}
    >
      {/* Control Bar */}
      {showControls && (
        <div className="absolute -top-6 right-0 flex items-center gap-2 bg-[#1a0f08] border border-[#8b6f47] rounded px-2 py-1 z-10">
          <button
            {...attributes}
            {...listeners}
            className="text-[#e8dcc6] hover:text-[#d4af37] cursor-grab active:cursor-grabbing"
            title="Drag to move"
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <div className="relative">
            <button
              data-tutorial="variant-selector"
              onClick={() => setShowVariantMenu(!showVariantMenu)}
              className="text-[#e8dcc6] hover:text-[#d4af37] text-xs px-2 py-1 border border-[#8b6f47] rounded flex items-center gap-1"
            >
              {variant}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showVariantMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#2a1810] border border-[#8b6f47] rounded shadow-lg z-20 min-w-[120px]">
                {(["factual", "sensationalist", "propaganda"] as VariantType[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      onVariantChange(v);
                      setShowVariantMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-[#e8dcc6] hover:bg-[#3a2418] ${
                      variant === v ? "bg-[#3a2418]" : ""
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300"
            title="Remove article"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="mb-2">
        {article.location_city && (
          <span className="text-xs uppercase tracking-wider text-[#666]">
            {article.location_city.toUpperCase()}
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-[#666] ml-2">
          • {variant.toUpperCase()}
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-[#1a1a1a] mb-2 leading-tight">
        {headline}
      </h3>
      <p className="text-xs md:text-sm text-[#1a1a1a] leading-relaxed">{body}</p>
    </article>
  );
}

// Sidebar Article Component (smaller version)
function SidebarArticle({
  article,
  variant,
  index,
  onDelete,
  onVariantChange,
  dragId,
}: {
  article: Article;
  variant: VariantType;
  index: number;
  onDelete: () => void;
  onVariantChange: (variant: VariantType) => void;
  dragId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const [showControls, setShowControls] = useState(false);
  const [showVariantMenu, setShowVariantMenu] = useState(false);

  const variantText = article.processed_variants[variant] || article.processed_variants.factual;
  const headline = variantText.split(/[.!?]/)[0] || article.original_title;
  const body = variantText;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="relative border-b border-[#1a1a1a] pb-4 mb-4 group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        setShowControls(false);
        setShowVariantMenu(false);
      }}
    >
      {/* Control Bar */}
      {showControls && (
        <div className="absolute -top-6 right-0 flex items-center gap-2 bg-[#1a0f08] border border-[#8b6f47] rounded px-2 py-1 z-10">
          <button
            {...attributes}
            {...listeners}
            className="text-[#e8dcc6] hover:text-[#d4af37] cursor-grab active:cursor-grabbing"
            title="Drag to move"
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <div className="relative">
            <button
              data-tutorial="variant-selector"
              onClick={() => setShowVariantMenu(!showVariantMenu)}
              className="text-[#e8dcc6] hover:text-[#d4af37] text-xs px-2 py-1 border border-[#8b6f47] rounded flex items-center gap-1"
            >
              {variant}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showVariantMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#2a1810] border border-[#8b6f47] rounded shadow-lg z-20 min-w-[120px]">
                {(["factual", "sensationalist", "propaganda"] as VariantType[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      onVariantChange(v);
                      setShowVariantMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-[#e8dcc6] hover:bg-[#3a2418] ${
                      variant === v ? "bg-[#3a2418]" : ""
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300"
            title="Remove article"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <h3 className="text-base font-bold text-[#1a1a1a] mb-2">
        {headline}
      </h3>
      <p className="text-xs text-[#1a1a1a]">{body}</p>
    </article>
  );
}

// Interactive Newspaper Article Component
function NewspaperArticle({
  article,
  variant,
  onDelete,
  onVariantChange,
  dragId,
}: {
  article: Article;
  variant: VariantType;
  onDelete: () => void;
  onVariantChange: (variant: VariantType) => void;
  dragId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const [showControls, setShowControls] = useState(false);
  const [showVariantMenu, setShowVariantMenu] = useState(false);

  const variantText = article.processed_variants[variant] || article.processed_variants.factual;
  const headline = variantText.split(/[.!?]/)[0] || article.original_title;
  const body = variantText;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="relative border-b-2 border-[#1a1a1a] pb-6 mb-6 group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        setShowControls(false);
        setShowVariantMenu(false);
      }}
    >
      {/* Control Bar */}
      {showControls && (
        <div className="absolute -top-8 right-0 flex items-center gap-2 bg-[#1a0f08] border border-[#8b6f47] rounded px-2 py-1 z-10">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="text-[#e8dcc6] hover:text-[#d4af37] cursor-grab active:cursor-grabbing"
            title="Drag to move"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Variant Selector */}
          <div className="relative">
            <button
              data-tutorial="variant-selector"
              onClick={() => setShowVariantMenu(!showVariantMenu)}
              className="text-[#e8dcc6] hover:text-[#d4af37] text-xs px-2 py-1 border border-[#8b6f47] rounded flex items-center gap-1"
            >
              {variant}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showVariantMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#2a1810] border border-[#8b6f47] rounded shadow-lg z-20 min-w-[120px]">
                {(["factual", "sensationalist", "propaganda"] as VariantType[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      onVariantChange(v);
                      setShowVariantMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-[#e8dcc6] hover:bg-[#3a2418] ${
                      variant === v ? "bg-[#3a2418]" : ""
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300"
            title="Remove article"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Article Content */}
      <div className="mb-2">
        {article.location_city && (
          <span className="text-xs uppercase tracking-wider text-[#666]">
            {article.location_city.toUpperCase()}
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-[#666] ml-2">
          • {variant.toUpperCase()}
        </span>
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-4 leading-tight">
        {headline}
      </h2>
      <div className="text-[#1a1a1a] text-sm md:text-base leading-relaxed">
        <p>{body}</p>
      </div>
    </article>
  );
}

// Draggable Ad Card Component
function DraggableAdCard({ ad, paperSentToday = false }: { ad: Ad; paperSentToday?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ad-${ad.id}`,
    disabled: paperSentToday, // Disable dragging when paper sent today
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 bg-[#3a2418] border border-[#8b6f47] rounded mb-3 cursor-grab active:cursor-grabbing hover:bg-[#4a3020] transition-colors"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <Megaphone className="w-4 h-4 text-[#d4af37] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm mb-1 font-serif text-[#e8dcc6] line-clamp-1">
            {ad.company}
          </h3>
          {ad.tagline && (
            <p className="text-xs text-[#8b6f47] line-clamp-1 mb-1">{ad.tagline}</p>
          )}
          <p className="text-xs text-[#8b6f47] line-clamp-2">{ad.description}</p>
          {ad.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ad.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-[#2a1810] border border-[#8b6f47] rounded text-[10px] text-[#8b6f47]"
                >
                  {tag.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Droppable Zone Component
function DroppableZone({
  zoneId,
  zoneType,
  children,
  className,
  isEmpty,
  onTap,
  isMobile,
}: {
  zoneId: string;
  zoneType: ZoneType;
  children: React.ReactNode;
  className?: string;
  isEmpty?: boolean;
  onTap?: () => void;
  isMobile?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
  });

  const hasContent = React.Children.count(children) > 0;

  return (
    <div
      ref={setNodeRef}
      className={`${className || ""} ${isOver ? "bg-[#f0e6d2] border-2 border-[#d4af37] border-dashed" : ""} min-h-[200px] transition-colors ${isMobile && isEmpty ? "cursor-pointer active:bg-[#f0e6d2]" : ""}`}
      onClick={isMobile && isEmpty && onTap ? onTap : undefined}
    >
      {children}
      {(isEmpty || (!hasContent && isEmpty !== false)) && (
        <div className={`text-center text-[#999] text-sm py-8 italic ${isMobile ? "py-12 text-base" : ""}`}>
          {isMobile ? "Tap to add content" : "Drop article or ad here"}
        </div>
      )}
    </div>
  );
}

// Row Ad Component
function RowAd({
  ad,
  rowIndex,
  adIndex,
  onDelete,
  dragId,
  size = "medium",
  isMobile,
  onReplace,
  zoneId,
}: {
  ad: Ad;
  rowIndex: number;
  adIndex: number;
  onDelete: () => void;
  dragId: string;
  size?: "large" | "medium" | "small";
  isMobile?: boolean;
  onReplace?: (zoneId: string) => void;
  zoneId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const [showControls, setShowControls] = useState(false);

  // Size-based styling
  const headlineSize =
    size === "large"
      ? "text-2xl md:text-3xl"
      : size === "medium"
      ? "text-xl md:text-2xl"
      : "text-lg md:text-xl";
  const bodySize =
    size === "large"
      ? "text-sm md:text-base"
      : size === "medium"
      ? "text-xs md:text-sm"
      : "text-xs";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative border-4 border-[#1a1a1a] p-4 bg-[#f9f9f9] mb-4 group"
      onMouseEnter={() => !isMobile && setShowControls(true)}
      onMouseLeave={() => !isMobile && setShowControls(false)}
      onTouchStart={() => isMobile && setShowControls(true)}
    >
      {/* Control Bar */}
      {(showControls || isMobile) && (
        <div className="absolute -top-6 right-0 flex items-center gap-1 md:gap-2 bg-[#1a0f08] border border-[#8b6f47] rounded px-1 md:px-2 py-1 z-10">
          {!isMobile && (
            <button
              {...attributes}
              {...listeners}
              className="text-[#e8dcc6] hover:text-[#d4af37] cursor-grab active:cursor-grabbing"
              title="Drag to move"
            >
              <GripVertical className="w-3 h-3" />
            </button>
          )}
          {isMobile && onReplace && zoneId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReplace(zoneId);
              }}
              className="text-[#d4af37] hover:text-[#e5c04a] text-xs px-1 md:px-2"
              title="Replace ad"
            >
              <span className="text-[10px] md:text-xs">Replace</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-400 hover:text-red-300"
            title="Remove ad"
          >
            <X className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        </div>
      )}

      {/* Ad Content */}
      <div className="absolute top-1 right-1">
        <span className="text-[8px] uppercase tracking-widest text-[#666]">SPONSORED</span>
      </div>
      <h3 className={`${headlineSize} font-bold text-[#1a1a1a] mb-2`}>{ad.company}</h3>
      {ad.tagline && (
        <p className={`${bodySize} font-semibold text-[#1a1a1a] mb-2`}>{ad.tagline}</p>
      )}
      <p className={`${bodySize} text-[#1a1a1a]`}>{ad.description}</p>
    </div>
  );
}

// Row Article Component (gebruikt voor alle rijen)
function RowArticle({
  article,
  variant,
  rowIndex,
  articleIndex,
  onDelete,
  onVariantChange,
  dragId,
  size = "medium",
  isMobile,
  onReplace,
  zoneId,
}: {
  article: Article;
  variant: VariantType;
  rowIndex: number;
  articleIndex: number;
  onDelete: () => void;
  onVariantChange: (variant: VariantType) => void;
  dragId: string;
  size?: "large" | "medium" | "small";
  isMobile?: boolean;
  onReplace?: (zoneId: string) => void;
  zoneId?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const [showControls, setShowControls] = useState(false);
  const [showVariantMenu, setShowVariantMenu] = useState(false);

  const variantText = article.processed_variants[variant] || article.processed_variants.factual;
  const headline = variantText.split(/[.!?]/)[0] || article.original_title;
  const body = variantText;

  // Size-based styling
  const headlineSize =
    size === "large"
      ? "text-3xl md:text-4xl"
      : size === "medium"
      ? "text-xl md:text-2xl"
      : "text-lg md:text-xl";
  const bodySize =
    size === "large"
      ? "text-sm md:text-base"
      : size === "medium"
      ? "text-xs md:text-sm"
      : "text-xs";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="relative border-b-2 border-[#1a1a1a] pb-4 mb-4 group"
      onMouseEnter={() => !isMobile && setShowControls(true)}
      onMouseLeave={() => {
        if (!isMobile) {
          setShowControls(false);
          setShowVariantMenu(false);
        }
      }}
      onTouchStart={() => isMobile && setShowControls(true)}
    >
      {/* Control Bar */}
      {(showControls || isMobile) && (
        <div className="absolute -top-6 right-0 flex items-center gap-1 md:gap-2 bg-[#1a0f08] border border-[#8b6f47] rounded px-1 md:px-2 py-1 z-10">
          <button
            {...attributes}
            {...listeners}
            className="text-[#e8dcc6] hover:text-[#d4af37] cursor-grab active:cursor-grabbing"
            title="Drag to move"
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <div className="relative">
            <button
              data-tutorial="variant-selector"
              onClick={() => setShowVariantMenu(!showVariantMenu)}
              className="text-[#e8dcc6] hover:text-[#d4af37] text-xs px-2 py-1 border border-[#8b6f47] rounded flex items-center gap-1"
            >
              {variant}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showVariantMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[#2a1810] border border-[#8b6f47] rounded shadow-lg z-20 min-w-[120px]">
                {(["factual", "sensationalist", "propaganda"] as VariantType[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      onVariantChange(v);
                      setShowVariantMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-[#e8dcc6] hover:bg-[#3a2418] ${
                      variant === v ? "bg-[#3a2418]" : ""
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300"
            title="Remove article"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Article Content */}
      <div className="mb-2">
        {article.location_city && (
          <span className="text-xs uppercase tracking-wider text-[#666]">
            {article.location_city.toUpperCase()}
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-[#666] ml-2">
          • {variant.toUpperCase()}
        </span>
      </div>
      <h2 className={`${headlineSize} font-bold text-[#1a1a1a] mb-3 leading-tight`}>
        {headline}
      </h2>
      <div className={`${bodySize} text-[#1a1a1a] leading-relaxed`}>
        <p>{body}</p>
      </div>
    </article>
  );
}

// Interactive Newspaper Preview Component
function InteractiveNewspaper({
  zoneState,
  articles,
  ads,
  onDeleteArticle,
  onVariantChange,
  username,
  onArticleMove,
  onZoneTap,
  isMobile,
  onReplace,
}: {
  zoneState: ZoneState;
  articles: Article[];
  ads: Ad[];
  onDeleteArticle: (zoneId: string) => void;
  onVariantChange: (zoneId: string, variant: VariantType) => void;
  onArticleMove: (fromZoneId: string, toZoneId: string) => void;
  username: string | null;
  onZoneTap?: (zoneId: string) => void;
  isMobile?: boolean;
  onReplace?: (zoneId: string) => void;
}) {
  const { newspaperName } = useGame();
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const adMap = new Map(ads.map((a) => [a.id, a]));
  

  return (
    <div className="min-h-screen bg-transparent py-2 md:py-8 px-0 md:px-8 w-full">
      <div className="w-full md:max-w-7xl md:mx-auto vintage-newspaper-paper p-2 md:p-12">
        {/* Masthead */}
        <header className="text-center mb-8 border-b-4 border-[#1a1a1a] pb-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 tracking-tight">
            {newspaperName}
          </h1>
          <div className="flex justify-between items-center text-sm md:text-base text-[#1a1a1a] border-t-2 border-b-2 border-[#1a1a1a] py-2 mt-4">
            <div className="text-left">
              <p>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">EDITION #42</p>
            </div>
            <div className="text-right">
              <p>PRICE: $5.00</p>
            </div>
          </div>
        </header>

        {/* Main Content - 3 Rows */}
        <div className="space-y-6">
          {/* Row 1: 1 breed artikel */}
          <div className="grid grid-cols-1 gap-4">
            <DroppableZone 
              zoneId="row1" 
              zoneType="row1" 
              className="w-full" 
              isEmpty={zoneState.row1.length === 0}
              onTap={onZoneTap ? () => onZoneTap("row1") : undefined}
              isMobile={isMobile}
            >
              {zoneState.row1.map((placed, index) => {
                if (placed.type === "article") {
                  const article = articleMap.get(placed.articleId);
                  if (!article) return null;
                  return (
                    <RowArticle
                      key={`row1-${index}`}
                      article={article}
                      variant={placed.variant}
                      rowIndex={1}
                      articleIndex={index}
                      onDelete={() => onDeleteArticle(`row1_${index}`)}
                      onVariantChange={(variant) => onVariantChange(`row1_${index}`, variant)}
                      dragId={`placed-row1_${index}`}
                      size="large"
                      isMobile={isMobile}
                      onReplace={onReplace}
                      zoneId={`row1_${index}`}
                    />
                  );
                } else {
                  const ad = adMap.get(placed.adId);
                  if (!ad) return null;
                  return (
                    <RowAd
                      key={`row1-ad-${index}`}
                      ad={ad}
                      rowIndex={1}
                      adIndex={index}
                      onDelete={() => onDeleteArticle(`row1_${index}`)}
                      dragId={`placed-row1_${index}`}
                      size="large"
                      isMobile={isMobile}
                      onReplace={onReplace}
                      zoneId={`row1_${index}`}
                    />
                  );
                }
              })}
            </DroppableZone>
          </div>

          {/* Row 2: 2 artikelen naast elkaar */}
          <div className="grid grid-cols-2 gap-2 md:gap-6">
            {[0, 1].map((slotIndex) => (
              <DroppableZone
                key={`row2-slot-${slotIndex}`}
                zoneId={`row2_${slotIndex}`}
                zoneType="row2"
                className="w-full"
                isEmpty={!zoneState.row2[slotIndex]}
                onTap={onZoneTap ? () => onZoneTap(`row2_${slotIndex}`) : undefined}
                isMobile={isMobile}
              >
                {zoneState.row2[slotIndex] && (() => {
                  const placed = zoneState.row2[slotIndex];
                  if (placed.type === "article") {
                    const article = articleMap.get(placed.articleId);
                    if (!article) return null;
                    return (
                      <RowArticle
                        article={article}
                        variant={placed.variant}
                        rowIndex={2}
                        articleIndex={slotIndex}
                        onDelete={() => onDeleteArticle(`row2_${slotIndex}`)}
                        onVariantChange={(variant) => onVariantChange(`row2_${slotIndex}`, variant)}
                        dragId={`placed-row2_${slotIndex}`}
                        size="medium"
                        isMobile={isMobile}
                        onReplace={onReplace}
                        zoneId={`row2_${slotIndex}`}
                      />
                    );
                  } else {
                    const ad = adMap.get(placed.adId);
                    if (!ad) return null;
                    return (
                      <RowAd
                        ad={ad}
                        rowIndex={2}
                        adIndex={slotIndex}
                        onDelete={() => onDeleteArticle(`row2_${slotIndex}`)}
                        dragId={`placed-row2_${slotIndex}`}
                        size="medium"
                        isMobile={isMobile}
                        onReplace={onReplace}
                        zoneId={`row2_${slotIndex}`}
                      />
                    );
                  }
                })()}
              </DroppableZone>
            ))}
          </div>

          {/* Row 3: 3 artikelen naast elkaar */}
          <div className="grid grid-cols-3 gap-2 md:gap-6">
            {[0, 1, 2].map((slotIndex) => (
              <DroppableZone
                key={`row3-slot-${slotIndex}`}
                zoneId={`row3_${slotIndex}`}
                zoneType="row3"
                className="w-full"
                isEmpty={!zoneState.row3[slotIndex]}
                onTap={onZoneTap ? () => onZoneTap(`row3_${slotIndex}`) : undefined}
                isMobile={isMobile}
              >
                {zoneState.row3[slotIndex] && (() => {
                  const placed = zoneState.row3[slotIndex];
                  if (placed.type === "article") {
                    const article = articleMap.get(placed.articleId);
                    if (!article) return null;
                    return (
                      <RowArticle
                        article={article}
                        variant={placed.variant}
                        rowIndex={3}
                        articleIndex={slotIndex}
                        onDelete={() => onDeleteArticle(`row3_${slotIndex}`)}
                        onVariantChange={(variant) => onVariantChange(`row3_${slotIndex}`, variant)}
                        dragId={`placed-row3_${slotIndex}`}
                        size="small"
                        isMobile={isMobile}
                        onReplace={onReplace}
                        zoneId={`row3_${slotIndex}`}
                      />
                    );
                  } else {
                    const ad = adMap.get(placed.adId);
                    if (!ad) return null;
                    return (
                      <RowAd
                        ad={ad}
                        rowIndex={3}
                        adIndex={slotIndex}
                        onDelete={() => onDeleteArticle(`row3_${slotIndex}`)}
                        dragId={`placed-row3_${slotIndex}`}
                        size="small"
                        isMobile={isMobile}
                        onReplace={onReplace}
                        zoneId={`row3_${slotIndex}`}
                      />
                    );
                  }
                })()}
              </DroppableZone>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t-2 border-[#1a1a1a] text-center">
          <p className="text-xs text-[#666]">
            © {new Date().getFullYear()} {newspaperName}. All rights reserved. | 
            Printed in Dystopia{username ? ` | Editor: ${username}` : ""} | 
            "The Truth, Sometimes"
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isGuest } = useAuth();
  const [dailyEdition, setDailyEdition] = useState<DailyEdition | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [assistantMessage, setAssistantMessage] = useState<string | undefined>(undefined);
  const [zoneState, setZoneState] = useState<ZoneState>({
    row1: [],
    row2: [],
    row3: [],
  });
  const [activeDragItem, setActiveDragItem] = useState<Article | Ad | null>(null);
  const [activeDragItemType, setActiveDragItemType] = useState<"article" | "ad" | null>(null);
  const [splitterPosition, setSplitterPosition] = useState<number>(25); // Percentage (25% for Wire, 75% for Newspaper) - Wire starts minimized
  const [isResizing, setIsResizing] = useState(false);
  const [showAds, setShowAds] = useState(false); // Toggle between articles and ads
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string>("");
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [paperSentToday, setPaperSentToday] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false); // Flag to prevent auto-disable after test simulation
  const [showPaperSentPopup, setShowPaperSentPopup] = useState(false);
  const [lastPublishedEdition, setLastPublishedEdition] = useState<PublishedEditionResponse | null>(null);
  const [yesterdayEdition, setYesterdayEdition] = useState<PublishedEditionResponse | null>(null);
  const [showYesterdayPaper, setShowYesterdayPaper] = useState(false);
  const [pendingReportData, setPendingReportData] = useState<{
    totalCash: number;
    cashBreakdown: { ads: number; bonuses: number; penalties: number };
    totalReaders: number;
    readerChange: number;
    credibilityScore: number;
    credibilityEvents: string[];
    editionId: number | null;
  } | null>(null);
  const [reportData, setReportData] = useState<{
    totalCash: number;
    cashBreakdown: { ads: number; bonuses: number; penalties: number };
    totalReaders: number;
    readerChange: number;
    credibilityScore: number;
    credibilityEvents: string[];
    editionId: number | null;
  } | null>(null);

  const hasPlacedItems =
    zoneState.row1.length > 0 || zoneState.row2.length > 0 || zoneState.row3.length > 0;

  // Draft auto-save functionality
  const DRAFT_STORAGE_KEY = "newspaper_draft";
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save draft to localStorage
  const saveDraft = useCallback((state: ZoneState) => {
    if (isGuest) return; // Don't save drafts for guests
    
    try {
      const draft = {
        zoneState: state,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  }, [isGuest]);

  // Load draft from localStorage
  const loadDraft = useCallback((): ZoneState | null => {
    if (isGuest) return null;
    
    try {
      const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draftJson) return null;
      
      const draft = JSON.parse(draftJson);
      
      // Check if draft is not too old (e.g., older than 7 days)
      const draftDate = new Date(draft.timestamp);
      const daysSinceDraft = (Date.now() - draftDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDraft > 7) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }
      
      return draft.zoneState as ZoneState;
    } catch (error) {
      console.error("Failed to load draft:", error);
      return null;
    }
  }, [isGuest]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear draft:", error);
    }
  }, []);

  const { user } = useAuth();
  const { newspaperName, refreshGameState } = useGame();  // Add refreshGameState
  const isMobile = useMobile();
  const [username, setUsername] = useState<string | null>(user?.username || null);
  
  // Mobile editor state
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [contentModalType, setContentModalType] = useState<"article" | "ad" | "both">("both");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Fetch username if not available in user object
  useEffect(() => {
    if (user?.id && !user?.username) {
      // Username not in user object, fetch it directly
      const { getPocketBase } = require("@/lib/pocketbase");
      const pb = getPocketBase();
      pb.collection("users").getOne(user.id)
        .then((userData) => {
          if (userData?.username) {
            setUsername(userData.username);
          }
        })
        .catch((error) => {
          console.error("[EditorPage] Failed to fetch username:", error);
        });
    } else if (user?.username) {
      setUsername(user.username);
    }
  }, [user?.id, user?.username]);
  
  
  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Disable sensors when paper has been sent today
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
      disabled: paperSentToday, // Disable drag when paper sent today
    })
  );

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [edition, adsList] = await Promise.all([
          fetchLatestArticles(), 
          fetchAds().catch(() => []) // Return empty array if ads fetch fails (e.g., for guests)
        ]);
        setDailyEdition(edition);
        setAds(adsList || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load data";
        setError(errorMessage);
        console.error("Error loading data:", err);
        // Set empty ads array on error to prevent crashes
        setAds([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Auto-save draft when zoneState changes (with debounce)
  useEffect(() => {
    if (isGuest || paperSentToday) return; // Don't save if guest or paper already sent
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout to save after 1 second of no changes
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(zoneState);
    }, 1000);
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [zoneState, isGuest, paperSentToday, saveDraft]);

  // Load draft on mount (only if no paper sent today)
  useEffect(() => {
    if (isGuest || paperSentToday) return;
    
    const draft = loadDraft();
    if (draft) {
      // Check if draft has any items
      const hasItems = draft.row1.length > 0 || draft.row2.length > 0 || draft.row3.length > 0;
      if (hasItems) {
        setZoneState(draft);
        toast.success("Draft restored", {
          duration: 2000,
          icon: "💾",
        });
      }
    }
  }, [isGuest, paperSentToday, loadDraft]);

  // Check if paper has been sent today (disable grid if so)
  // Skip this check if we're in test mode (after simulating next day)
  useEffect(() => {
    async function checkPaperSentToday() {
      if (isGuest || isTestMode) return; // Skip check in test mode
      
      try {
        const hasSent = await hasPublishedToday();
        setPaperSentToday(hasSent);
      } catch (error) {
        console.error("Failed to check if paper sent today:", error);
      }
    }

    checkPaperSentToday();
  }, [isGuest, isTestMode]);

  // Function to simulate next day (use the most recently published paper and show Morning Report)
  const simulateNextDay = async () => {
    if (isGuest) return;
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🌅 NEXT DAY FLOW: Starting");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    try {
      console.log("🌅 NEXT DAY FLOW: Step 1 - Clearing all previous state");
      // Clear all related state FIRST to ensure clean slate
      setReportData(null);
      setPendingReportData(null);
      setShowYesterdayPaper(false);
      setYesterdayEdition(null);
      
      console.log("🌅 NEXT DAY FLOW: Step 2 - Enabling test mode");
      // Enable test mode FIRST to prevent checkYesterdayPaper and checkPaperSentToday from running
      setIsTestMode(true);
      
      console.log("🌅 NEXT DAY FLOW: Step 3 - Fetching published editions");
      // Get all published editions and use the most recent one
      const { getAllPublishedEditions } = await import("@/lib/api");
      const allEditions = await getAllPublishedEditions();
      
      if (allEditions.length === 0) {
        console.log("🌅 NEXT DAY FLOW: ❌ ERROR - No published papers found");
        toast.error("No published papers found. Publish a paper first!", {
          duration: 3000,
        });
        return;
      }
      
      // Use the most recent edition (first in the sorted list)
      const mostRecent = allEditions[0];
      console.log("🌅 NEXT DAY FLOW: Step 4 - Using most recent paper (ID:", mostRecent.id + ")");
      
      console.log("🌅 NEXT DAY FLOW: Step 5 - Setting up newspaper animation");
      // Set the edition and show animation after a brief delay to ensure state is cleared
      setYesterdayEdition(mostRecent);
      // Use setTimeout to ensure state updates are applied before showing animation
      setTimeout(() => {
        setShowYesterdayPaper(true);
        console.log("🌅 NEXT DAY FLOW: Step 6 - Animation triggered");
      }, 50);
      
      console.log("🌅 NEXT DAY FLOW: Step 7 - Calculating Morning Report statistics");
      // Calculate stats for Morning Report (but don't set reportData yet - wait for animation)
      // Use the second most recent edition for comparison (if it exists)
      const previousEdition = allEditions.length > 1 ? allEditions[1] : null;
      const previousReaders = previousEdition?.stats?.readers || 10000; // Default starting readers
      const currentReaders = mostRecent.stats?.readers || 0;
      const readerChange = currentReaders - previousReaders;
      
      // Get recent transactions to calculate cash breakdown
      const transactions = await getRecentTransactions(10);
      let ads = 0;
      let bonuses = 0;
      let penalties = 0;
      
      transactions.forEach(t => {
        if (t.type === "income") {
          if (t.description.toLowerCase().includes("ad")) {
            ads += t.amount;
          } else if (t.description.toLowerCase().includes("bonus")) {
            bonuses += t.amount;
          }
        } else {
          penalties += Math.abs(t.amount);
        }
      });
      
      // Store report data in a ref or state that will be set after animation
      // We'll set it in onAnimationComplete
      const reportDataToSet = {
        totalCash: Math.round(mostRecent.stats?.cash || 0),
        cashBreakdown: { ads, bonuses, penalties },
        totalReaders: Math.round(currentReaders),
        readerChange: Math.round(readerChange),
        credibilityScore: Math.round(mostRecent.stats?.credibility || 0),
        credibilityEvents: [],
        editionId: mostRecent.id,
      };
      
      console.log("🌅 NEXT DAY FLOW: Step 8 - Report data prepared:", {
        totalCash: reportDataToSet.totalCash,
        totalReaders: reportDataToSet.totalReaders,
        readerChange: reportDataToSet.readerChange,
        credibilityScore: reportDataToSet.credibilityScore
      });
      
      // Store in a ref so we can access it in onAnimationComplete
      // Actually, we can use a closure or set it in a state variable that's not reportData
      // Let's use a separate state for pending report data
      setPendingReportData(reportDataToSet);
      
      // Reset paperSentToday so grid is enabled after Morning Report
      // Use setTimeout to ensure isTestMode is set first
      setTimeout(() => {
        setPaperSentToday(false);
      }, 0);
      
      console.log("🌅 NEXT DAY FLOW: Step 9 - Waiting for animation to complete and user to click 'Proceed'");
      toast.success("Next day simulated! Showing paper with animation.", {
        duration: 3000,
      });
    } catch (error) {
      console.log("🌅 NEXT DAY FLOW: ❌ ERROR -", error);
      console.error("Failed to simulate next day:", error);
      toast.error("Failed to simulate next day", {
        duration: 3000,
      });
    }
  };

  // Check for yesterday's paper on FIRST page load only (not on every navigation)
  // Use localStorage to track if we've already checked today for this user
  useEffect(() => {
    async function checkYesterdayPaper() {
      if (isGuest || isTestMode) return;
      
      // Only check once per user per day (track by user ID and date)
      const currentUserId = user?.id;
      if (!currentUserId) return; // Wait for user to be loaded
      
      // Check if we've already checked today for this user
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const storageKey = `yesterdayPaperChecked_${currentUserId}_${today}`;
      const hasCheckedToday = localStorage.getItem(storageKey);
      
      if (hasCheckedToday) {
        return; // Already checked today, skip
      }
      
      // Mark that we've checked today
      localStorage.setItem(storageKey, 'true');
      
      try {
        const yesterday = await getYesterdayEdition();
        if (yesterday) {
          setYesterdayEdition(yesterday);
          // Show the paper first, then Morning Report
          setShowYesterdayPaper(true);
          
          // Calculate stats for Morning Report
          const dayBefore = await getDayBeforeYesterdayEdition();
          const previousReaders = dayBefore?.stats?.readers || 10000; // Default starting readers
          const yesterdayReaders = yesterday.stats?.readers || 0;
          const readerChange = yesterdayReaders - previousReaders;
          
          // Get recent transactions to calculate cash breakdown
          const transactions = await getRecentTransactions(10);
          let ads = 0;
          let bonuses = 0;
          let penalties = 0;
          
          transactions.forEach(t => {
            if (t.type === "income") {
              if (t.description.toLowerCase().includes("ad")) {
                ads += t.amount;
              } else if (t.description.toLowerCase().includes("bonus")) {
                bonuses += t.amount;
              }
            } else {
              penalties += Math.abs(t.amount);
            }
          });
          
          // Store in pendingReportData instead of reportData directly
          // This ensures the animation shows first
          setPendingReportData({
            totalCash: Math.round(yesterday.stats?.cash || 0),
            cashBreakdown: { ads, bonuses, penalties },
            totalReaders: Math.round(yesterdayReaders),
            readerChange: Math.round(readerChange),
            credibilityScore: Math.round(yesterday.stats?.credibility || 0),
            credibilityEvents: [],
            editionId: yesterday.id,
          });
        }
      } catch (error) {
        console.error("Failed to check for yesterday's paper:", error);
      }
    }

    checkYesterdayPaper();
  }, [isGuest, isTestMode, user?.id]);

  const reloadLatest = async () => {
    const [edition, adsList] = await Promise.all([
      fetchLatestArticles(), 
      fetchAds().catch(() => []) // Return empty array if ads fetch fails (e.g., for guests)
    ]);
    setDailyEdition(edition);
    setAds(adsList || []);
  };

  const handleRefreshScoops = async () => {
    // Block refresh for guest users
    if (isGuest) {
      toast.error("Please log in to refresh scoops", { duration: 3000 });
      return;
    }
    
    try {
      setIsRefreshing(true);
      setRefreshError(null);
      setRefreshProgress("Deleting existing articles...");
      
      // Small delay to show the first message
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Use async job with polling for better progress tracking
      await resetAndIngestWithPolling((progress, status) => {
        setRefreshProgress(progress || "Processing...");
      });
      
      setRefreshProgress("Loading new scoops...");
      await reloadLatest();
      
      setRefreshProgress("Complete!");
      // Clear progress message after a short delay
      setTimeout(() => {
        setRefreshProgress("");
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setRefreshError(msg);
      setRefreshProgress("");
      console.error("Failed to refresh scoops:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper function to get ad target tag (similar to GridEditor)
  const getAdTargetTag = (ad: Ad): string | null => {
    const companyName = ad.company.toLowerCase();
    const adTags = ad.tags.map(t => t.toUpperCase());
    
    if (companyName.includes("peaceful arms") || companyName.includes("warcorp") || 
        companyName.includes("war") || adTags.includes("WAR")) {
      return "WAR";
    } else if (companyName.includes("pharmamax") || companyName.includes("pharma")) {
      return "HEALTH";
    } else if (companyName.includes("oil") || adTags.includes("OIL")) {
      return "OIL";
    }
    
    return adTags.length > 0 ? adTags[0] : null;
  };

  // Helper function to get ad impact
  const getAdImpact = (ad: Ad): { cash: number; credibility: number } => {
    const companyName = ad.company.toLowerCase();
    const adTags = ad.tags.map(t => t.toLowerCase());
    
    // WarCorp equivalent
    if (companyName.includes("peaceful arms") || companyName.includes("warcorp") || 
        companyName.includes("war") || adTags.includes("war")) {
      return { cash: 2000, credibility: -5 };
    }
    
    // PharmaMax equivalent
    if (companyName.includes("pharmamax") || companyName.includes("pharma")) {
      return { cash: 1500, credibility: -3 };
    }
    
    // Default ad
    return { cash: 1000, credibility: 0 };
  };

  // Calculate row-based stats
  const calculateRowBasedStats = (): PublishStats & {
    cashBreakdown: { ads: number; bonuses: number; penalties: number };
    readerChange: number;
  } => {
    // Start from last published edition stats, or use defaults if no previous edition
    const startingCredibility = lastPublishedEdition?.stats?.credibility ?? 50;
    const startingReaders = lastPublishedEdition?.stats?.readers ?? 10000;
    
    let cash = 0; // Cash is always calculated fresh (will be added to treasury in backend)
    let credibility = startingCredibility; // Start from last edition's credibility
    let readers = startingReaders; // Start from last edition's readers
    let adsCash = 0;
    let bonusCash = 0;
    let penaltyCash = 0;

    // Track ad cash contributions for synergy calculations
    const adCashContributions = new Map<string, number>();
    
    // Row multipliers (row1 = most visible, row3 = least visible)
    const rowMultipliers = {
      row1: 1.5,  // Top row - most visible
      row2: 1.2,  // Middle row
      row3: 1.0,  // Bottom row - least visible
    };

    // Helper to check for synergies/conflicts between adjacent items in a row
    const checkRowSynergies = (row: PlacedItem[], rowKey: string) => {
      for (let i = 0; i < row.length - 1; i++) {
        const item1 = row[i];
        const item2 = row[i + 1];
        if (!item1 || !item2) continue;

        // Check for ad-article combinations
        let ad: Ad | null = null;
        let article: Article | null = null;
        let adPosition = "";
        let articleVariant: VariantType = "factual";

        if (item1.type === "ad" && item2.type === "article") {
          ad = ads.find(a => a.id === item1.adId);
          article = dailyEdition?.articles.find(a => a.id === item2.articleId) || null;
          adPosition = `${rowKey}_${i}`;
          articleVariant = item2.variant || "factual";
        } else if (item1.type === "article" && item2.type === "ad") {
          ad = ads.find(a => a.id === item2.adId);
          article = dailyEdition?.articles.find(a => a.id === item1.articleId) || null;
          adPosition = `${rowKey}_${i + 1}`;
          articleVariant = item1.variant || "factual";
        }

        if (!ad || !article) continue;

        const adTargetTag = getAdTargetTag(ad);
        if (!adTargetTag) continue;

        const articleTags = article.tags?.topic_tags?.map(t => t.toUpperCase()) || [];
        const hasMatchingTag = articleTags.includes(adTargetTag);

        if (!hasMatchingTag) continue;

        const adCash = adCashContributions.get(adPosition) || 0;

        // Corporate Shill (Synergy): Ad next to Propaganda or Supportive article
        const isSupportive = article.tags?.sentiment?.toLowerCase() === "positive" || 
                            article.tags?.sentiment?.toLowerCase() === "supportive";
        const isPropaganda = articleVariant === "propaganda";

        if ((isPropaganda || isSupportive) && hasMatchingTag) {
          // Synergy: +50% cash bonus
          const bonus = adCash * 0.5;
          cash += bonus;
          bonusCash += bonus;
        }

        // Hypocrisy (Conflict): Ad next to Factual or Critical article
        const isCritical = article.tags?.sentiment?.toLowerCase() === "negative" || 
                          article.tags?.sentiment?.toLowerCase() === "critical";
        const isFactual = articleVariant === "factual";

        if ((isFactual || isCritical) && hasMatchingTag) {
          // Conflict: Remove ad cash, -15% credibility
          cash -= adCash;
          penaltyCash += adCash;
          credibility -= 15;
        }
      }
    };

    // Process row1
    zoneState.row1.forEach((item, index) => {
      if (!item) return;
      
      const multiplier = rowMultipliers.row1;

      if (item.type === "ad") {
        const ad = ads.find(a => a.id === item.adId);
        if (ad) {
          const impact = getAdImpact(ad);
          const adCash = impact.cash * multiplier;
          adCashContributions.set(`row1_${index}`, adCash);
          cash += adCash;
          adsCash += adCash;
          credibility += impact.credibility;
        }
      } else if (item.type === "article") {
        const variant = item.variant || "factual";
        switch (variant) {
          case "factual":
            credibility += 5 * multiplier;
            break;
          case "sensationalist":
            credibility -= 5;
            readers += 5000 * multiplier;
            break;
          case "propaganda":
            cash += 200 * multiplier;
            credibility -= 10;
            readers -= 2000;
            break;
        }
      }
    });

    // Process row2
    zoneState.row2.forEach((item, index) => {
      if (!item) return;
      
      const multiplier = rowMultipliers.row2;

      if (item.type === "ad") {
        const ad = ads.find(a => a.id === item.adId);
        if (ad) {
          const impact = getAdImpact(ad);
          const adCash = impact.cash * multiplier;
          adCashContributions.set(`row2_${index}`, adCash);
          cash += adCash;
          adsCash += adCash;
          credibility += impact.credibility;
        }
      } else if (item.type === "article") {
        const variant = item.variant || "factual";
        switch (variant) {
          case "factual":
            credibility += 5 * multiplier;
            break;
          case "sensationalist":
            credibility -= 5;
            readers += 5000 * multiplier;
            break;
          case "propaganda":
            cash += 200 * multiplier;
            credibility -= 10;
            readers -= 2000;
            break;
        }
      }
    });

    // Process row3
    zoneState.row3.forEach((item, index) => {
      if (!item) return;
      
      const multiplier = rowMultipliers.row3;

      if (item.type === "ad") {
        const ad = ads.find(a => a.id === item.adId);
        if (ad) {
          const impact = getAdImpact(ad);
          const adCash = impact.cash * multiplier;
          adCashContributions.set(`row3_${index}`, adCash);
          cash += adCash;
          adsCash += adCash;
          credibility += impact.credibility;
        }
      } else if (item.type === "article") {
        const variant = item.variant || "factual";
        switch (variant) {
          case "factual":
            credibility += 5 * multiplier;
            break;
          case "sensationalist":
            credibility -= 5;
            readers += 5000 * multiplier;
            break;
          case "propaganda":
            cash += 200 * multiplier;
            credibility -= 10;
            readers -= 2000;
            break;
        }
      }
    });

    // Check for synergies/conflicts within rows
    checkRowSynergies(zoneState.row1, "row1");
    checkRowSynergies(zoneState.row2, "row2");
    checkRowSynergies(zoneState.row3, "row3");

    // Clamp values
    credibility = Math.max(0, Math.min(100, credibility));
    readers = Math.max(0, readers);

    // Calculate reader change from starting readers (last edition or default)
    const readerChange = readers - startingReaders;

    return {
      cash,
      credibility,
      readers,
      cashBreakdown: {
        ads: Math.round(adsCash),
        bonuses: Math.round(bonusCash),
        penalties: Math.round(penaltyCash),
      },
      readerChange: Math.round(readerChange),
    };
  };

  const handlePublish = async () => {
    // Block publishing for guest users
    if (isGuest) {
      toast.error("Please log in to publish your newspaper", { 
        duration: 4000,
      });
      router.push("/login");
      return;
    }
    
    try {
      setIsPublishing(true);
      
      // Convert zoneState to GridPlacement format (for backend compatibility)
      const placedItems: Array<{
        articleId: string | null;
        variant: "factual" | "sensationalist" | "propaganda" | null;
        isAd: boolean;
        adId: string | null;
        headline?: string;  // NEW: Store displayed headline
        body?: string;      // NEW: Store displayed body text
      }> = [];

      // Add row1 items
      zoneState.row1.forEach((item) => {
        if (item) {
          if (item.type === "article") {
            const article = dailyEdition?.articles.find(a => a.id === item.articleId);
            if (article) {
              const variant = item.variant || "factual";
              const variantText = article.processed_variants?.[variant] || "";
              placedItems.push({
                articleId: item.articleId,
                variant: variant,
                isAd: false,
                adId: null,
                headline: article.original_title,
                body: variantText,
              });
            }
          } else {
            const ad = ads.find(a => a.id === item.adId);
            if (ad) {
              placedItems.push({
                articleId: null,
                variant: null,
                isAd: true,
                adId: item.adId,
                headline: ad.company,
                body: ad.description,
              });
            }
          }
        }
      });

      // Add row2 items
      zoneState.row2.forEach((item) => {
        if (item) {
          if (item.type === "article") {
            const article = dailyEdition?.articles.find(a => a.id === item.articleId);
            if (article) {
              const variant = item.variant || "factual";
              const variantText = article.processed_variants?.[variant] || "";
              placedItems.push({
                articleId: item.articleId,
                variant: variant,
                isAd: false,
                adId: null,
                headline: article.original_title,
                body: variantText,
              });
            }
          } else {
            const ad = ads.find(a => a.id === item.adId);
            if (ad) {
              placedItems.push({
                articleId: null,
                variant: null,
                isAd: true,
                adId: item.adId,
                headline: ad.company,
                body: ad.description,
              });
            }
          }
        }
      });

      // Add row3 items
      zoneState.row3.forEach((item) => {
        if (item) {
          if (item.type === "article") {
            const article = dailyEdition?.articles.find(a => a.id === item.articleId);
            if (article) {
              const variant = item.variant || "factual";
              const variantText = article.processed_variants?.[variant] || "";
              placedItems.push({
                articleId: item.articleId,
                variant: variant,
                isAd: false,
                adId: null,
                headline: article.original_title,
                body: variantText,
              });
            }
          } else {
            const ad = ads.find(a => a.id === item.adId);
            if (ad) {
              placedItems.push({
                articleId: null,
                variant: null,
                isAd: true,
                adId: item.adId,
                headline: ad.company,
                body: ad.description,
              });
            }
          }
        }
      });

      // Calculate stats using row-based scoring
      const publishStats = calculateRowBasedStats();

      // Publish the edition (only send core stats to API)
      const response = await publish(
        {
          cash: publishStats.cash,
          credibility: publishStats.credibility,
          readers: publishStats.readers,
        },
        placedItems,
        newspaperName // Include newspaper name
      );
      
      // Mark that paper has been sent today
      setPaperSentToday(true);
      
      // Disable test mode after publishing (new paper sent)
      setIsTestMode(false);
      
      // Clear draft after successful publication
      clearDraft();
      
      // Show popup instead of Morning Report
      setShowPaperSentPopup(true);
      
      // Refresh game state to show updated treasury, readers, and credibility
      await refreshGameState();
      
      // Reload last published edition for next time
      const { getAllPublishedEditions } = await import("@/lib/api");
      const allEditions = await getAllPublishedEditions();
      if (allEditions.length > 0) {
        setLastPublishedEdition(allEditions[0]);
      }
      
      toast.success("Newspaper sent to press successfully!", {
        duration: 3000,
      });

      // Advance tutorial if on step 8 (publish step)
      // Dispatch custom event that tutorial can listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('newspaper-published'));
      }
    } catch (error) {
      console.error("Failed to send to press:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to send to press: ${errorMessage}`, {
        duration: 5000,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.querySelector('[data-editor-container]') as HTMLElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Clamp between 20% and 80%
      const clampedPosition = Math.max(20, Math.min(80, newPosition));
      setSplitterPosition(clampedPosition);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleDragStart = (event: DragStartEvent) => {
    // Block drag if paper has already been sent today
    if (paperSentToday) {
      return;
    }
    
    const { active } = event;
    const activeId = active.id as string;

    if (activeId.startsWith("article-")) {
      const articleId = activeId.replace("article-", ""); // Now it's a string, not numeric
      const article = dailyEdition?.articles.find((a) => a.id === articleId);
      if (article) {
        setActiveDragItem(article);
        setActiveDragItemType("article");
        
        // Set assistant comment when dragging starts
        setSelectedArticleId(articleId);
        if (article.assistant_comment) {
          setAssistantMessage(article.assistant_comment);
        } else {
          // Fallback message
          setAssistantMessage("This looks like a solid lead.");
        }
      }
    } else if (activeId.startsWith("ad-")) {
      const adId = activeId.replace("ad-", "");  // Changed from parseInt to string
      const ad = ads.find((a) => a.id === adId);
      if (ad) {
        setActiveDragItem(ad);
        setActiveDragItemType("ad");
      }
    } else if (activeId.startsWith("placed-")) {
      // Dragging an already placed item
      const zoneId = activeId.replace("placed-", "");
      let item: Article | Ad | undefined;
      let itemType: "article" | "ad" | null = null;
      
      if (zoneId.startsWith("row1_")) {
        const index = parseInt(zoneId.replace("row1_", ""), 10);
        const placed = zoneState.row1[index];
        if (placed) {
          if (placed.type === "article") {
            item = dailyEdition?.articles.find((a) => a.id === placed.articleId);
            itemType = "article";
          } else {
            item = ads.find((a) => a.id === placed.adId);
            itemType = "ad";
          }
        }
      } else if (zoneId.startsWith("row2_")) {
        const index = parseInt(zoneId.replace("row2_", ""), 10);
        const placed = zoneState.row2[index];
        if (placed) {
          if (placed.type === "article") {
            item = dailyEdition?.articles.find((a) => a.id === placed.articleId);
            itemType = "article";
          } else {
            item = ads.find((a) => a.id === placed.adId);
            itemType = "ad";
          }
        }
      } else if (zoneId.startsWith("row3_")) {
        const index = parseInt(zoneId.replace("row3_", ""), 10);
        const placed = zoneState.row3[index];
        if (placed) {
          if (placed.type === "article") {
            item = dailyEdition?.articles.find((a) => a.id === placed.articleId);
            itemType = "article";
          } else {
            item = ads.find((a) => a.id === placed.adId);
            itemType = "ad";
          }
        }
      }
      
      if (item) {
        setActiveDragItem(item);
        setActiveDragItemType(itemType);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Block drag if paper has already been sent today
    if (paperSentToday) {
      setActiveDragItem(null);
      setActiveDragItemType(null);
      return;
    }
    
    setActiveDragItem(null);
    setActiveDragItemType(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Helper to parse zone info
    const parseZoneId = (zoneId: string): { zone: "row1" | "row2" | "row3"; index: number | null } => {
      if (zoneId === "row1") return { zone: "row1", index: null };
      if (zoneId.startsWith("row1_")) {
        const index = parseInt(zoneId.replace("row1_", ""), 10);
        return { zone: "row1", index };
      }
      if (zoneId === "row2") return { zone: "row2", index: null };
      if (zoneId.startsWith("row2_")) {
        const index = parseInt(zoneId.replace("row2_", ""), 10);
        return { zone: "row2", index };
      }
      if (zoneId === "row3") return { zone: "row3", index: null };
      if (zoneId.startsWith("row3_")) {
        const index = parseInt(zoneId.replace("row3_", ""), 10);
        return { zone: "row3", index };
      }
      return { zone: "row1", index: null };
    };

    // Wire to Zone - Articles
    if (activeId.startsWith("article-")) {
      const articleId = activeId.replace("article-", ""); // Changed: now it's a string (PocketBase ID)
      const target = parseZoneId(overId);

      setZoneState((prev) => {
        const newState = { ...prev };
        const newItem: PlacedArticle = {
          type: "article",
          articleId,
          variant: "factual",
          zoneId: overId,
        };

        if (target.zone === "row1") {
          newState.row1 = [newItem];
        } else if (target.zone === "row2") {
          if (target.index !== null && target.index >= 0 && target.index < 2) {
            newState.row2 = [...prev.row2];
            newState.row2[target.index] = newItem;
          } else {
            const emptyIndex = prev.row2.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row2 = [...prev.row2];
              newState.row2[emptyIndex] = newItem;
            } else {
              newState.row2 = prev.row2.length < 2 ? [...prev.row2, newItem] : prev.row2;
            }
          }
        } else if (target.zone === "row3") {
          if (target.index !== null && target.index >= 0 && target.index < 3) {
            newState.row3 = [...prev.row3];
            newState.row3[target.index] = newItem;
          } else {
            const emptyIndex = prev.row3.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row3 = [...prev.row3];
              newState.row3[emptyIndex] = newItem;
            } else {
              newState.row3 = prev.row3.length < 3 ? [...prev.row3, newItem] : prev.row3;
            }
          }
        }

        return newState;
      });
      return;
    }

    // Wire to Zone - Ads
    if (activeId.startsWith("ad-")) {
      const adId = activeId.replace("ad-", "");  // Changed from parseInt to string
      const target = parseZoneId(overId);

      setZoneState((prev) => {
        const newState = { ...prev };
        const newItem: PlacedAd = {
          type: "ad",
          adId,
          zoneId: overId,
        };

        if (target.zone === "row1") {
          newState.row1 = [newItem];
        } else if (target.zone === "row2") {
          if (target.index !== null && target.index >= 0 && target.index < 2) {
            newState.row2 = [...prev.row2];
            newState.row2[target.index] = newItem;
          } else {
            const emptyIndex = prev.row2.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row2 = [...prev.row2];
              newState.row2[emptyIndex] = newItem;
            } else {
              newState.row2 = prev.row2.length < 2 ? [...prev.row2, newItem] : prev.row2;
            }
          }
        } else if (target.zone === "row3") {
          if (target.index !== null && target.index >= 0 && target.index < 3) {
            newState.row3 = [...prev.row3];
            newState.row3[target.index] = newItem;
          } else {
            const emptyIndex = prev.row3.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row3 = [...prev.row3];
              newState.row3[emptyIndex] = newItem;
            } else {
              newState.row3 = prev.row3.length < 3 ? [...prev.row3, newItem] : prev.row3;
            }
          }
        }

        return newState;
      });
      return;
    }

    // Zone to Zone (moving placed articles)
    if (activeId.startsWith("placed-")) {
      const fromZoneId = activeId.replace("placed-", "");
      const fromTarget = parseZoneId(fromZoneId);
      const toTarget = parseZoneId(overId);

      setZoneState((prev) => {
        const newState = { ...prev };
        let movedItem: PlacedItem | null = null;

        // Check if moving within the same row
        if (fromTarget.zone === toTarget.zone && fromTarget.index !== null && toTarget.index !== null) {
          // Moving within same row - swap positions
          if (fromTarget.zone === "row1") {
            // Row1 only has 1 slot, so this shouldn't happen, but handle it
            return prev;
          } else if (fromTarget.zone === "row2") {
            const sourceIndex = fromTarget.index;
            const targetIndex = toTarget.index;
            if (sourceIndex === targetIndex) return prev; // Same position, no change
            
            newState.row2 = [...prev.row2];
            movedItem = prev.row2[sourceIndex];
            const targetItem = prev.row2[targetIndex];
            
            // Move or swap positions
            if (movedItem) {
              movedItem.zoneId = overId;
              // Remove from source
              newState.row2[sourceIndex] = targetItem; // Will be undefined if target was empty
              // Place at target
              newState.row2[targetIndex] = movedItem;
            }
          } else if (fromTarget.zone === "row3") {
            const sourceIndex = fromTarget.index;
            const targetIndex = toTarget.index;
            if (sourceIndex === targetIndex) return prev; // Same position, no change
            
            newState.row3 = [...prev.row3];
            movedItem = prev.row3[sourceIndex];
            const targetItem = prev.row3[targetIndex];
            
            // Move or swap positions
            if (movedItem) {
              movedItem.zoneId = overId;
              // Remove from source
              newState.row3[sourceIndex] = targetItem; // Will be undefined if target was empty
              // Place at target
              newState.row3[targetIndex] = movedItem;
            }
          }
        } else {
          // Moving between different rows or zones
          // Remove from source
          if (fromTarget.zone === "row1" && fromTarget.index !== null && prev.row1[fromTarget.index]) {
            movedItem = prev.row1[fromTarget.index];
            newState.row1 = prev.row1.filter((_, i) => i !== fromTarget.index);
          } else if (fromTarget.zone === "row2" && fromTarget.index !== null && prev.row2[fromTarget.index]) {
            movedItem = prev.row2[fromTarget.index];
            newState.row2 = prev.row2.filter((_, i) => i !== fromTarget.index);
          } else if (fromTarget.zone === "row3" && fromTarget.index !== null && prev.row3[fromTarget.index]) {
            movedItem = prev.row3[fromTarget.index];
            newState.row3 = prev.row3.filter((_, i) => i !== fromTarget.index);
          }

          // Add to target
          if (movedItem) {
            movedItem.zoneId = overId;
            if (toTarget.zone === "row1") {
              newState.row1 = [movedItem];
            } else if (toTarget.zone === "row2") {
              if (toTarget.index !== null && toTarget.index >= 0 && toTarget.index < 2) {
                // Ensure array is properly sized
                if (!newState.row2) newState.row2 = [];
                if (newState.row2.length <= toTarget.index) {
                  newState.row2 = [...newState.row2, ...Array(toTarget.index - newState.row2.length + 1).fill(null)];
                }
                newState.row2 = [...newState.row2];
                newState.row2[toTarget.index] = movedItem;
              } else {
                const emptyIndex = newState.row2.findIndex((a) => !a);
                if (emptyIndex !== -1) {
                  newState.row2 = [...newState.row2];
                  newState.row2[emptyIndex] = movedItem;
                } else {
                  newState.row2 = newState.row2.length < 2 ? [...newState.row2, movedItem] : newState.row2;
                }
              }
            } else if (toTarget.zone === "row3") {
              if (toTarget.index !== null && toTarget.index >= 0 && toTarget.index < 3) {
                // Ensure array is properly sized
                if (!newState.row3) newState.row3 = [];
                if (newState.row3.length <= toTarget.index) {
                  newState.row3 = [...newState.row3, ...Array(toTarget.index - newState.row3.length + 1).fill(null)];
                }
                newState.row3 = [...newState.row3];
                newState.row3[toTarget.index] = movedItem;
              } else {
                const emptyIndex = newState.row3.findIndex((a) => !a);
                if (emptyIndex !== -1) {
                  newState.row3 = [...newState.row3];
                  newState.row3[emptyIndex] = movedItem;
                } else {
                  newState.row3 = newState.row3.length < 3 ? [...newState.row3, movedItem] : newState.row3;
                }
              }
            }
          }
        }

        return newState;
      });
    }
  };

  const handleDeleteArticle = (zoneId: string) => {
    setZoneState((prev) => {
      const newState = { ...prev };
      if (zoneId.startsWith("row1_")) {
        const index = parseInt(zoneId.replace("row1_", ""), 10);
        newState.row1 = prev.row1.filter((_, i) => i !== index);
      } else if (zoneId.startsWith("row2_")) {
        const index = parseInt(zoneId.replace("row2_", ""), 10);
        newState.row2 = prev.row2.filter((_, i) => i !== index);
      } else if (zoneId.startsWith("row3_")) {
        const index = parseInt(zoneId.replace("row3_", ""), 10);
        newState.row3 = prev.row3.filter((_, i) => i !== index);
      }
      return newState;
    });
  };

  const handleVariantChange = (zoneId: string, variant: VariantType) => {
    setZoneState((prev) => {
      const newState = { ...prev };
      if (zoneId.startsWith("row1_")) {
        const index = parseInt(zoneId.replace("row1_", ""), 10);
        if (prev.row1[index] && prev.row1[index].type === "article") {
          newState.row1 = [...prev.row1];
          newState.row1[index] = { ...prev.row1[index], variant } as PlacedArticle;
        }
      } else if (zoneId.startsWith("row2_")) {
        const index = parseInt(zoneId.replace("row2_", ""), 10);
        if (prev.row2[index] && prev.row2[index].type === "article") {
          newState.row2 = [...prev.row2];
          newState.row2[index] = { ...prev.row2[index], variant } as PlacedArticle;
        }
      } else if (zoneId.startsWith("row3_")) {
        const index = parseInt(zoneId.replace("row3_", ""), 10);
        if (prev.row3[index] && prev.row3[index].type === "article") {
          newState.row3 = [...prev.row3];
          newState.row3[index] = { ...prev.row3[index], variant } as PlacedArticle;
        }
      }
      return newState;
    });
  };

  // Helper to parse zone info (reused from handleDragEnd)
  const parseZoneId = (zoneId: string): { zone: "row1" | "row2" | "row3"; index: number | null } => {
    if (zoneId === "row1") return { zone: "row1", index: null };
    if (zoneId.startsWith("row1_")) {
      const index = parseInt(zoneId.replace("row1_", ""), 10);
      return { zone: "row1", index };
    }
    if (zoneId === "row2") return { zone: "row2", index: null };
    if (zoneId.startsWith("row2_")) {
      const index = parseInt(zoneId.replace("row2_", ""), 10);
      return { zone: "row2", index };
    }
    if (zoneId === "row3") return { zone: "row3", index: null };
    if (zoneId.startsWith("row3_")) {
      const index = parseInt(zoneId.replace("row3_", ""), 10);
      return { zone: "row3", index };
    }
    return { zone: "row1", index: null };
  };

  // Mobile: Handle zone tap to open content selection modal
  const handleZoneTap = (zoneId: string) => {
    if (!isMobile) return;
    setSelectedZone(zoneId);
    setContentModalType("both");
    setIsContentModalOpen(true);
  };

  // Mobile: Handle content selection from modal
  const handleContentSelect = (item: { type: "article"; article: Article; variant?: "factual" | "sensationalist" | "propaganda" } | { type: "ad"; ad: Ad }) => {
    if (!selectedZone) return;

    const target = parseZoneId(selectedZone);

    if (item.type === "article") {
      const articleId = item.article.id;
      const variant = item.variant || "factual";

      setZoneState((prev) => {
        const newState = { ...prev };
        const newItem: PlacedArticle = {
          type: "article",
          articleId,
          variant,
          zoneId: selectedZone,
        };

        if (target.zone === "row1") {
          newState.row1 = [newItem];
        } else if (target.zone === "row2") {
          if (target.index !== null && target.index >= 0 && target.index < 2) {
            newState.row2 = [...prev.row2];
            newState.row2[target.index] = newItem;
          } else {
            const emptyIndex = prev.row2.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row2 = [...prev.row2];
              newState.row2[emptyIndex] = newItem;
            } else {
              newState.row2 = prev.row2.length < 2 ? [...prev.row2, newItem] : prev.row2;
            }
          }
        } else if (target.zone === "row3") {
          if (target.index !== null && target.index >= 0 && target.index < 3) {
            newState.row3 = [...prev.row3];
            newState.row3[target.index] = newItem;
          } else {
            const emptyIndex = prev.row3.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row3 = [...prev.row3];
              newState.row3[emptyIndex] = newItem;
            } else {
              newState.row3 = prev.row3.length < 3 ? [...prev.row3, newItem] : prev.row3;
            }
          }
        }

        return newState;
      });
    } else if (item.type === "ad") {
      const adId = item.ad.id;

      setZoneState((prev) => {
        const newState = { ...prev };
        const newItem: PlacedAd = {
          type: "ad",
          adId,
          zoneId: selectedZone,
        };

        if (target.zone === "row1") {
          newState.row1 = [newItem];
        } else if (target.zone === "row2") {
          if (target.index !== null && target.index >= 0 && target.index < 2) {
            newState.row2 = [...prev.row2];
            newState.row2[target.index] = newItem;
          } else {
            const emptyIndex = prev.row2.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row2 = [...prev.row2];
              newState.row2[emptyIndex] = newItem;
            } else {
              newState.row2 = prev.row2.length < 2 ? [...prev.row2, newItem] : prev.row2;
            }
          }
        } else if (target.zone === "row3") {
          if (target.index !== null && target.index >= 0 && target.index < 3) {
            newState.row3 = [...prev.row3];
            newState.row3[target.index] = newItem;
          } else {
            const emptyIndex = prev.row3.findIndex((a) => !a);
            if (emptyIndex !== -1) {
              newState.row3 = [...prev.row3];
              newState.row3[emptyIndex] = newItem;
            } else {
              newState.row3 = prev.row3.length < 3 ? [...prev.row3, newItem] : prev.row3;
            }
          }
        }

        return newState;
      });
    }

    setSelectedZone(null);
    setIsContentModalOpen(false);
  };

  // Filter items to only show those NOT currently placed
  const placedArticleIds = new Set<string>();
  const placedAdIds = new Set<string>();
  
  zoneState.row1.forEach((item) => {
    if (item && item.type === "article") placedArticleIds.add(item.articleId);
    else if (item && item.type === "ad") placedAdIds.add(item.adId);
  });
  zoneState.row2.forEach((item) => {
    if (item && item.type === "article") placedArticleIds.add(item.articleId);
    else if (item && item.type === "ad") placedAdIds.add(item.adId);
  });
  zoneState.row3.forEach((item) => {
    if (item && item.type === "article") placedArticleIds.add(item.articleId);
    else if (item && item.type === "ad") placedAdIds.add(item.adId);
  });

  const availableArticles =
    dailyEdition?.articles.filter((article) => !placedArticleIds.has(article.id)) || [];
  const availableAds = ads.filter((ad) => !placedAdIds.has(ad.id));
  

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#2a1810] paper-texture">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mx-auto mb-4" />
          <p className="text-[#e8dcc6] text-lg">Loading Editor...</p>
        </div>
      </div>
    );
  }

  if (error || !dailyEdition) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#2a1810] paper-texture">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-[#e8dcc6] text-lg mb-2">Failed to load editor</p>
          <p className="text-[#8b6f47] text-sm">{error || "No data available"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#8b6f47] text-[#e8dcc6] rounded hover:bg-[#a68a5a] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowGuest={true}>
      <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col overflow-hidden bg-[#2a1810]" data-editor-container>
        {/* Mobile Header - Always visible on mobile */}
        {isMobile && (
          <div className="bg-[#1a0f08] bg-opacity-90 border-b border-[#8b6f47] p-3 paper-texture z-[1000] flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded hover:bg-[#3a2418] text-[#8b6f47] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-[#e8dcc6] font-serif">{newspaperName}</p>
              <p className="text-xs text-[#8b6f47] mt-0.5">Front Page Editor</p>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        )}

        {/* Mobile Drawer */}
        {isMobile && (
          <MobileDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            onRefreshScoops={handleRefreshScoops}
            onOpenShop={() => setIsShopOpen(true)}
            isRefreshing={isRefreshing}
          />
        )}

        <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - The Wire (Desktop Only) */}
        {!isMobile && (
          <div
            className="h-full flex flex-col bg-[#1a0f08] border-r-2 border-[#8b6f47] paper-texture overflow-hidden flex-shrink-0"
            style={{ width: `${splitterPosition}%` }}
          >
          {/* Header with Assistant */}
          <div className="bg-[#2a1810] border-b border-[#8b6f47] p-4 flex-shrink-0">
            <div className="mb-3">
              <Assistant 
                mood="neutral" 
                message={assistantMessage || "Drag scoops to the newspaper zones on the right."}
                viewMode="grid"
              />
            </div>
            {refreshError && (
              <p className="text-xs text-red-400 mb-2">{refreshError}</p>
            )}
            {refreshProgress && (
              <div className="mb-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-[#d4af37] animate-spin" />
                <p className="text-xs text-[#d4af37] font-serif">{refreshProgress}</p>
              </div>
            )}
            
            {/* Toggle between Articles and Ads */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAds(false)}
                className={`flex-1 px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm ${
                  !showAds
                    ? "bg-[#d4af37] text-[#1a0f08]"
                    : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                }`}
              >
                <span>Scoops ({availableArticles.length})</span>
              </button>
              <button
                data-tutorial="ad-button"
                onClick={() => setShowAds(true)}
                className={`flex-1 px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm ${
                  showAds
                    ? "bg-[#d4af37] text-[#1a0f08]"
                    : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                }`}
              >
                <Megaphone className="w-4 h-4" />
                <span>Ads ({availableAds.length})</span>
              </button>
            </div>
          </div>

          {/* Wire Content - Full Width */}
          <div data-tutorial="editor-wire" className="flex-1 overflow-y-auto p-4">
            {showAds ? (
              <div>
                {availableAds.length > 0 ? (
                  availableAds.map((ad) => <DraggableAdCard key={ad.id} ad={ad} paperSentToday={paperSentToday} />)
                ) : (
                  <p className="text-sm text-[#8b6f47] italic text-center py-8">
                    No available ads
                  </p>
                )}
              </div>
            ) : (
              <Wire
                articles={availableArticles}
                selectedArticleId={selectedArticleId}
                onArticleSelect={(articleId: string | number) => {
                  const articleIdStr = String(articleId);
                  setSelectedArticleId(articleIdStr);
                  
                  // Find the article and set assistant comment
                  const selectedArticle = availableArticles.find(a => a.id === articleIdStr);
                  
                  if (selectedArticle?.assistant_comment) {
                    setAssistantMessage(selectedArticle.assistant_comment);
                  } else {
                    // Fallback message
                    setAssistantMessage("This looks like a solid lead.");
                  }
                }}
                viewMode="grid"
                showHeader={false}
                paperSentToday={paperSentToday}
              />
            )}
          </div>
        </div>
        )}

        {/* Resize Handle (Desktop Only) */}
        {!isMobile && (
          <div
            className="w-1 bg-[#8b6f47] hover:bg-[#d4af37] cursor-col-resize flex-shrink-0 transition-colors relative group"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            {/* Visual indicator */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-transparent group-hover:bg-[#d4af37] transition-colors" />
          </div>
        )}

        {/* Right Panel - Newspaper Preview + Toolbar */}
        <div
          className={`h-full flex overflow-hidden flex-shrink-0 ${isMobile ? "w-full" : ""}`}
          style={!isMobile ? { width: `${100 - splitterPosition}%` } : {}}
        >
          <div className="h-full overflow-y-auto bg-[#2a1810] flex-1 relative">
            {/* Floating Send to Press Button - Top Right (Desktop) / Bottom (Mobile) */}
            {hasPlacedItems && !paperSentToday && (
              <button
                data-tutorial="publish-button"
                onClick={handlePublish}
                disabled={isPublishing || isGuest || paperSentToday}
                className={`${isMobile ? "fixed bottom-4 left-4 right-4 z-50" : "fixed top-4 right-20 z-50"} px-6 py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isPublishing || isGuest || paperSentToday
                    ? "bg-[#3a2418] text-[#8b6f47] opacity-60 cursor-not-allowed"
                    : "bg-[#d4af37] text-[#1a0f08] hover:bg-[#e5c04a] hover:shadow-xl"
                }`}
                title={paperSentToday ? "Paper already sent to press today" : isGuest ? "Login required to send to press" : "Send to Press"}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-serif font-bold">Sending to press...</span>
                  </>
                ) : isGuest ? (
                  <>
                    <span className="text-xl">🔒</span>
                    <span className="font-serif font-bold">Login to Send</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    <span className="font-serif font-bold">Send to Press</span>
                  </>
                )}
              </button>
            )}
            <div 
              data-tutorial="grid-layout" 
              className={`transform origin-top w-full ${isMobile ? "scale-[1]" : "scale-[0.95]"} relative ${paperSentToday ? "opacity-50 pointer-events-none" : ""}`}
            >
              {paperSentToday && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
                  <div className="bg-[#1a0f08] border-2 border-[#d4af37] rounded-lg p-6 max-w-md mx-4 text-center">
                    <Printer className="w-12 h-12 text-[#d4af37] mx-auto mb-4" />
                    <h3 className="text-xl font-serif font-bold text-[#e8dcc6] mb-2">
                      Paper Already Sent
                    </h3>
                    <p className="text-[#e8dcc6] text-sm">
                      Your newspaper has been sent to press today. Check back tomorrow morning for your published paper and scores.
                    </p>
                  </div>
                </div>
              )}
              <InteractiveNewspaper
                zoneState={zoneState}
                articles={dailyEdition.articles}
                ads={ads}
                onDeleteArticle={handleDeleteArticle}
                onVariantChange={handleVariantChange}
                onArticleMove={() => {}} // Handled by drag & drop
                username={username}
                onZoneTap={handleZoneTap}
                isMobile={isMobile}
                onReplace={handleZoneTap}
              />
            </div>
          </div>

          {/* Vertical Toolbar - Right Side (Desktop Only) */}
          {!isMobile && (
            <div className="w-16 bg-[#1a0f08] border-l border-[#8b6f47] flex flex-col items-center gap-4 py-4 paper-texture flex-shrink-0">
          {/* Only show refresh button for admin */}
          {isAdmin && (
            <>
            <button
              onClick={handleRefreshScoops}
              disabled={isRefreshing || isGuest}
              className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
                isRefreshing
                  ? "bg-[#3a2418] text-[#8b6f47] opacity-60 cursor-not-allowed"
                  : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
              }`}
              title="Fetch new scoops"
            >
              {isRefreshing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              <span className="text-[10px]">{isRefreshing ? "..." : "Fetch"}</span>
            </button>
            <button
              onClick={simulateNextDay}
              disabled={isGuest}
              className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
              title="Simulate Next Day (Test Only)"
            >
              <Calendar className="w-5 h-5" />
              <span className="text-[10px]">Next Day</span>
            </button>
            </>
          )}
          <button
            onClick={() => router.push('/hub')}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              pathname === "/hub"
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Executive Desk"
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px]">Hub</span>
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            title="Map View"
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[10px]">Map</span>
          </button>
          <button
            onClick={() => router.push('/editor')}
            className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#d4af37] text-[#1a0f08]"
            title="Grid Editor"
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">Grid</span>
          </button>
          <button
            onClick={() => router.push("/archives")}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              pathname === "/archives"
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Archives"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px]">Archives</span>
          </button>
          <button
            onClick={() => router.push("/leaderboard")}
            className={`w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
              pathname === "/leaderboard"
                ? "bg-[#d4af37] text-[#1a0f08]"
                : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
            }`}
            title="Leaderboard"
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px]">Top 5</span>
          </button>
          <button
            onClick={() => setIsShopOpen(true)}
            className="w-12 h-12 rounded transition-colors flex flex-col items-center justify-center gap-1 bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020] border border-red-600/50 hover:border-red-500"
            title="Shop"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">Shop</span>
          </button>
        </div>
        )}
        </div>
        </div>
      </div>
      
      {/* Shop Modal */}
      <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />

      {/* Content Selection Modal (Mobile) */}
      <ContentSelectionModal
        isOpen={isContentModalOpen}
        onClose={() => {
          setIsContentModalOpen(false);
          setSelectedZone(null);
        }}
        onSelect={handleContentSelect}
        articles={availableArticles}
        ads={availableAds}
        contentType={contentModalType}
        targetZone={selectedZone || undefined}
      />

      {/* Drag Overlay */}
      <DragOverlay
        style={{
          cursor: "grabbing",
          pointerEvents: "none",
        }}
        zIndex={9999}
      >
        {activeDragItem && activeDragItemType ? (
          <div className="w-64 p-3 rounded border bg-[#3a2418] border-[#8b6f47] shadow-2xl opacity-90 transform rotate-2">
            {activeDragItemType === "article" ? (
              <h3 className="font-bold text-sm mb-2 font-serif text-[#e8dcc6]">
                {(activeDragItem as Article).original_title}
              </h3>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="w-4 h-4 text-[#d4af37]" />
                  <h3 className="font-bold text-sm font-serif text-[#e8dcc6]">
                    {(activeDragItem as Ad).company}
                  </h3>
                </div>
                <p className="text-xs text-[#8b6f47]">
                  {(activeDragItem as Ad).tagline || (activeDragItem as Ad).description}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>

      {/* Paper Sent Popup */}
      <PaperSentPopup
        isOpen={showPaperSentPopup}
        onClose={() => setShowPaperSentPopup(false)}
      />

      {/* Yesterday's Paper View with Rotating Animation */}
      <NewspaperAnimation
        editionId={yesterdayEdition?.id || null}
        isOpen={showYesterdayPaper && !!yesterdayEdition && !reportData}
        onClose={() => {
          console.log("🌅 NEXT DAY FLOW: Step 10 - Animation closed, preparing Morning Report");
          setShowYesterdayPaper(false);
          // Show Morning Report if we have pending report data
          if (pendingReportData) {
            console.log("🌅 NEXT DAY FLOW: Step 11 - Displaying Morning Report");
            setReportData(pendingReportData);
            setPendingReportData(null);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("🌅 NEXT DAY FLOW: Complete - Morning Report is now visible");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          }
        }}
        onAnimationComplete={() => {
          console.log("🌅 NEXT DAY FLOW: Step 10 - Animation closed, preparing Morning Report");
          // After animation completes, show Morning Report
          setShowYesterdayPaper(false);
          if (pendingReportData) {
            console.log("🌅 NEXT DAY FLOW: Step 11 - Displaying Morning Report");
            setReportData(pendingReportData);
            setPendingReportData(null);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("🌅 NEXT DAY FLOW: Complete - Morning Report is now visible");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          }
        }}
      />

      {/* Morning Report overlay */}
      {reportData && (
        <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm">
          <MorningReport
            totalCash={reportData.totalCash}
            cashBreakdown={reportData.cashBreakdown}
            totalReaders={reportData.totalReaders}
            readerChange={reportData.readerChange}
            credibilityScore={reportData.credibilityScore}
            credibilityEvents={reportData.credibilityEvents}
              onContinue={async () => {
              // Refresh game state after viewing Morning Report
              await refreshGameState();
              
              // If in test mode (simulated next day), enable grid for new edition
              if (isTestMode) {
                // Reset zoneState to start fresh for the new day
                setZoneState({
                  row1: [],
                  row2: [],
                  row3: [],
                });
                
                // Clear any draft since we're starting a new day
                clearDraft();
                
                // Grid is already enabled (paperSentToday is false in test mode)
                toast.success("Grid enabled - create your new edition!", {
                  duration: 2000,
                });
              }
              
              setReportData(null);
              setShowYesterdayPaper(false);
              setYesterdayEdition(null);
              
              // Only navigate to newspaper if not in test mode
              if (!isTestMode && reportData.editionId !== null) {
                router.push(`/newspaper?id=${reportData.editionId}`);
              } else if (!isTestMode) {
                router.push("/newspaper");
              }
            }}
          />
        </div>
      )}
      </DndContext>
    </ProtectedRoute>
  );
}
