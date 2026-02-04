"use client";

import { useState, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Article } from "@/types/api";
import { Newspaper, MapPin, Tag, Clock, GripVertical, Search, X } from "lucide-react";
import { parseDutchDateTime, formatDutchTime } from "@/lib/dateUtils";

interface WireProps {
  articles: Article[];
  selectedArticleId: string | null;
  onArticleSelect: (articleId: string | number) => void;
  viewMode: "map" | "grid";
  showHeader?: boolean; // Optional prop to show/hide header
  paperSentToday?: boolean; // Disable dragging when paper has been sent today
}

function DraggableArticleItem({ 
  article, 
  isSelected, 
  onSelect,
  viewMode,
  paperSentToday = false
}: { 
  article: Article; 
  isSelected: boolean; 
  onSelect: () => void;
  viewMode: "map" | "grid";
  paperSentToday?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `article-${article.id}`,
    disabled: viewMode === "map" || paperSentToday, // Disable dragging in map mode or when paper sent today
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Click handler - active in both map and grid mode
  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger if we're currently dragging
    if (isDragging) {
      return;
    }
    // Trigger selection (works in both map and grid mode)
    e.stopPropagation();
    onSelect();
  };

  // Determine cursor style and drag behavior based on view mode
  const isMapMode = viewMode === "map";
  const cursorClass = isMapMode ? "cursor-pointer" : "cursor-grab";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      // In grid mode, attach drag listeners to the entire card
      {...(isMapMode ? {} : { ...listeners, ...attributes })}
      className={`
        p-3 rounded border ${cursorClass} transition-all relative group
        ${isMapMode ? "" : "active:cursor-grabbing"}
        ${
          isSelected
            ? "bg-[#d4af37] bg-opacity-20 border-[#d4af37] border-2 shadow-lg"
            : "bg-[#3a2418] border-[#8b6f47] hover:bg-[#4a3020] hover:border-[#a68a5a]"
        }
      `}
    >
      
      <h3
        className={`font-bold text-sm mb-2 font-serif pr-6 ${
          isSelected ? "text-[#f4e8d0]" : "text-[#e8dcc6]"
        }`}
      >
        {article.original_title}
      </h3>
      
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-[#8b6f47]">
          <Clock className="w-3 h-3" />
          <span>
            {formatDutchTime(parseDutchDateTime(article.published_at))}
          </span>
        </div>
        {article.location_city && (
          <div className="flex items-center gap-1 text-xs text-[#8b6f47]">
            <MapPin className="w-3 h-3" />
            <span>{article.location_city}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-[#8b6f47]">
          <Tag className="w-3 h-3" />
          <span className="capitalize">{article.tags.sentiment}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {article.tags.topic_tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-[#8b6f47] bg-opacity-30 text-[#d4af37] text-xs rounded border border-[#8b6f47]"
          >
            {tag}
          </span>
        ))}
        {article.tags.topic_tags.length > 3 && (
          <span className="px-2 py-0.5 text-[#8b6f47] text-xs">
            +{article.tags.topic_tags.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Wire({ articles, selectedArticleId, onArticleSelect, viewMode, showHeader = true, paperSentToday = false }: WireProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Enhanced search function that searches across multiple fields
  const filteredArticles = articles.filter((article) => {
    if (!searchTerm.trim()) {
      return true; // Show all articles if search is empty
    }

    const searchLower = searchTerm.toLowerCase();
    
    // Search in title
    const titleMatch = article.original_title.toLowerCase().includes(searchLower);
    
    // Search in location
    const locationMatch = article.location_city?.toLowerCase().includes(searchLower) || false;
    
    // Search in tags
    const tagMatch = article.tags.topic_tags.some((tag) => tag.toLowerCase().includes(searchLower));
    
    // Search in sentiment
    const sentimentMatch = article.tags.sentiment?.toLowerCase().includes(searchLower) || false;
    
    // Search in assistant comment
    const commentMatch = article.assistant_comment?.toLowerCase().includes(searchLower) || false;
    
    // Search in variant titles/bodies (if available)
    const variantMatch = 
      (typeof article.processed_variants?.factual === 'object' && 
       (article.processed_variants.factual.title?.toLowerCase().includes(searchLower) ||
        article.processed_variants.factual.body?.toLowerCase().includes(searchLower))) ||
      (typeof article.processed_variants?.sensationalist === 'object' &&
       (article.processed_variants.sensationalist.title?.toLowerCase().includes(searchLower) ||
        article.processed_variants.sensationalist.body?.toLowerCase().includes(searchLower))) ||
      (typeof article.processed_variants?.propaganda === 'object' &&
       (article.processed_variants.propaganda.title?.toLowerCase().includes(searchLower) ||
        article.processed_variants.propaganda.body?.toLowerCase().includes(searchLower))) ||
      false;
    
    return titleMatch || locationMatch || tagMatch || sentimentMatch || commentMatch || variantMatch;
  });

  return (
    <div className="w-80 h-full bg-[#2a1810] border-r border-[#8b6f47] flex flex-col paper-texture">
      {/* Search Bar - Always visible */}
      <div className="p-3 border-b border-[#8b6f47] bg-[#1a0f08] flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b6f47]" />
          <input
            type="text"
            placeholder="Search scoops..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[#3a2418] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder:text-[#8b6f47] text-sm focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#8b6f47] hover:text-[#d4af37] transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-[#8b6f47] mt-2">
          {filteredArticles.length} of {articles.length} scoop{articles.length !== 1 ? "s" : ""}
          {searchTerm && ` matching "${searchTerm}"`}
        </p>
      </div>

      {/* Header - Only if showHeader is true */}
      {showHeader && (
        <div className="p-4 border-b border-[#8b6f47] bg-[#1a0f08] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-[#d4af37]" />
            <h2 className="text-xl font-bold text-[#e8dcc6] font-serif">The Wire</h2>
          </div>
        </div>
      )}

      {/* Articles List */}
      <div className="flex-1 overflow-y-auto">
        {filteredArticles.length === 0 ? (
          <div className="p-8 text-center text-[#8b6f47]">
            <p>No scoops found</p>
            <p className="text-xs mt-2">Try a different search term</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredArticles.map((article) => {
              const isSelected = selectedArticleId === article.id;
              return (
                <DraggableArticleItem
                  key={article.id}
                  article={article}
                  isSelected={isSelected}
                  onSelect={() => onArticleSelect(article.id)}
                  viewMode={viewMode}
                  paperSentToday={paperSentToday}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

