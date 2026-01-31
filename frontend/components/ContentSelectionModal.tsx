"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Newspaper, Megaphone, MapPin, Tag } from "lucide-react";
import type { Article } from "@/types/api";
import type { Ad } from "@/lib/api";
import { parseDutchDateTime, formatDutchTime } from "@/lib/dateUtils";

interface ContentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: { type: "article"; article: Article; variant?: "factual" | "sensationalist" | "propaganda" } | { type: "ad"; ad: Ad }) => void;
  articles: Article[];
  ads: Ad[];
  contentType: "article" | "ad" | "both"; // What type of content to show
  targetZone?: string; // The zone/spot being edited (for context)
}

export default function ContentSelectionModal({
  isOpen,
  onClose,
  onSelect,
  articles,
  ads,
  contentType,
  targetZone,
}: ContentSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"articles" | "ads">(
    contentType === "ad" ? "ads" : "articles"
  );

  // Filter articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const query = searchQuery.toLowerCase();
    return articles.filter(
      (article) =>
        article.original_title.toLowerCase().includes(query) ||
        article.processed_variants?.factual?.toLowerCase().includes(query) ||
        article.processed_variants?.sensationalist?.toLowerCase().includes(query) ||
        article.processed_variants?.propaganda?.toLowerCase().includes(query) ||
        article.tags?.topic_tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        article.location_city?.toLowerCase().includes(query)
    );
  }, [articles, searchQuery]);

  // Filter ads based on search
  const filteredAds = useMemo(() => {
    if (!searchQuery.trim()) return ads;
    const query = searchQuery.toLowerCase();
    return ads.filter(
      (ad) =>
        ad.company.toLowerCase().includes(query) ||
        ad.tagline.toLowerCase().includes(query) ||
        ad.description.toLowerCase().includes(query) ||
        ad.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [ads, searchQuery]);

  const handleSelectArticle = (article: Article, variant?: "factual" | "sensationalist" | "propaganda") => {
    onSelect({ type: "article", article, variant });
    onClose();
  };

  const handleSelectAd = (ad: Ad) => {
    onSelect({ type: "ad", ad });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 z-[10000]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 top-0 md:top-auto md:bottom-4 md:left-4 md:right-4 md:max-w-2xl md:max-h-[90vh] md:mx-auto bg-[#1a0f08] border-t md:border border-[#8b6f47] paper-texture z-[10001] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#1a0f08] border-b border-[#8b6f47] p-4 flex items-center justify-between z-10">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#e8dcc6] font-serif">
                  Select Content
                </h2>
                {targetZone && (
                  <p className="text-xs text-[#8b6f47] mt-1">
                    Placing in: {targetZone}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded hover:bg-[#3a2418] text-[#8b6f47] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs (if both types available) */}
            {contentType === "both" && (
              <div className="flex border-b border-[#8b6f47] bg-[#1a0f08]">
                <button
                  onClick={() => setActiveTab("articles")}
                  className={`flex-1 px-4 py-3 transition-colors flex items-center justify-center gap-2 ${
                    activeTab === "articles"
                      ? "bg-[#d4af37] text-[#1a0f08]"
                      : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                  }`}
                >
                  <Newspaper className="w-4 h-4" />
                  <span className="font-serif">Scoops ({articles.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("ads")}
                  className={`flex-1 px-4 py-3 transition-colors flex items-center justify-center gap-2 ${
                    activeTab === "ads"
                      ? "bg-[#d4af37] text-[#1a0f08]"
                      : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                  }`}
                >
                  <Megaphone className="w-4 h-4" />
                  <span className="font-serif">Ads ({ads.length})</span>
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="p-4 border-b border-[#8b6f47] bg-[#1a0f08]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b6f47]" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#3a2418] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]"
                />
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4">
              {(activeTab === "articles" || contentType === "article") && (
                <div className="space-y-3">
                  {filteredArticles.length === 0 ? (
                    <p className="text-sm text-[#8b6f47] italic text-center py-8">
                      {searchQuery ? "No articles match your search" : "No articles available"}
                    </p>
                  ) : (
                    filteredArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onSelect={handleSelectArticle}
                      />
                    ))
                  )}
                </div>
              )}

              {(activeTab === "ads" || contentType === "ad") && (
                <div className="space-y-3">
                  {filteredAds.length === 0 ? (
                    <p className="text-sm text-[#8b6f47] italic text-center py-8">
                      {searchQuery ? "No ads match your search" : "No ads available"}
                    </p>
                  ) : (
                    filteredAds.map((ad) => (
                      <AdCard key={ad.id} ad={ad} onSelect={handleSelectAd} />
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Article Card Component
function ArticleCard({
  article,
  onSelect,
}: {
  article: Article;
  onSelect: (article: Article, variant?: "factual" | "sensationalist" | "propaganda") => void;
}) {
  const [selectedVariant, setSelectedVariant] = useState<"factual" | "sensationalist" | "propaganda" | null>(null);

  const handleClick = () => {
    if (selectedVariant) {
      onSelect(article, selectedVariant);
    } else {
      // If no variant selected, default to factual
      onSelect(article, "factual");
    }
  };

  return (
    <div className="bg-[#3a2418] border border-[#8b6f47] rounded-lg p-4 hover:border-[#d4af37] transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-base font-bold text-[#e8dcc6] font-serif mb-2">
            {article.original_title}
          </h3>

          {/* Variant Selection */}
          {article.processed_variants && (
            <div className="mb-3">
              <p className="text-xs text-[#8b6f47] mb-2">Select variant:</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(article.processed_variants).map(([variant, text]) => (
                  <button
                    key={variant}
                    onClick={() => setSelectedVariant(variant as any)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      selectedVariant === variant
                        ? "bg-[#d4af37] text-[#1a0f08]"
                        : "bg-[#2a1810] text-[#8b6f47] hover:bg-[#4a3020]"
                    }`}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 text-xs text-[#8b6f47] mb-3">
            {article.location_city && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{article.location_city}</span>
              </div>
            )}
            {article.tags?.topic_tags && article.tags.topic_tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>{article.tags.topic_tags.slice(0, 2).join(", ")}</span>
              </div>
            )}
            {article.date && (
              <div className="flex items-center gap-1">
                <span>{formatDutchTime(parseDutchDateTime(article.date))}</span>
              </div>
            )}
          </div>

          {/* Assistant Comment */}
          {article.assistant_comment && (
            <p className="text-xs text-[#d4af37] italic mb-3 font-serif">
              "{article.assistant_comment}"
            </p>
          )}

          {/* Select Button */}
          <button
            onClick={handleClick}
            className="w-full px-4 py-2 bg-[#d4af37] text-[#1a0f08] rounded hover:bg-[#e5c04a] transition-colors font-serif font-semibold"
          >
            Place Article
          </button>
        </div>
      </div>
    </div>
  );
}

// Ad Card Component
function AdCard({
  ad,
  onSelect,
}: {
  ad: Ad;
  onSelect: (ad: Ad) => void;
}) {
  return (
    <div className="bg-[#3a2418] border border-[#8b6f47] rounded-lg p-4 hover:border-[#d4af37] transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-base font-bold text-[#e8dcc6] font-serif mb-1">
            {ad.company}
          </h3>
          <p className="text-sm text-[#d4af37] mb-2 font-serif italic">
            {ad.tagline}
          </p>
          <p className="text-xs text-[#8b6f47] mb-3">
            {ad.description}
          </p>
          {ad.tags && ad.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {ad.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-[#2a1810] text-[#8b6f47] rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => onSelect(ad)}
            className="w-full px-4 py-2 bg-[#d4af37] text-[#1a0f08] rounded hover:bg-[#e5c04a] transition-colors font-serif font-semibold"
          >
            Place Ad
          </button>
        </div>
      </div>
    </div>
  );
}

