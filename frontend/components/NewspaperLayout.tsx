"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchEdition, fetchLatestArticles, fetchAds, type Article, type Ad } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface PublishedItem {
  id: number;
  type: "article" | "ad";
  headline: string;
  body: string;
  variant?: "factual" | "sensationalist" | "propaganda";
  source?: string; // For ads: company name
  location?: string;
}

interface NewspaperLayoutProps {
  publishedItems?: PublishedItem[];
  date?: Date;
  editionNumber?: number;
  newspaperName?: string;
}

// Mock data for development
const mockPublishedItems: PublishedItem[] = [
  {
    id: 1,
    type: "article",
    headline: "BREAKING: World Leaders Gather in Secret Summit",
    body: "In an unprecedented move, world leaders from across the globe convened in an undisclosed location yesterday to discuss the future of international relations. Sources close to the matter suggest that the meeting, which lasted over 12 hours, covered topics ranging from economic policy to climate change mitigation strategies. The secrecy surrounding the event has raised eyebrows among transparency advocates, who question the democratic legitimacy of such closed-door negotiations.",
    variant: "factual",
    location: "Global",
  },
  {
    id: 2,
    type: "article",
    headline: "Tech Giant Announces Revolutionary AI Breakthrough",
    body: "A major technology corporation has unveiled what it claims to be the most advanced artificial intelligence system ever created. The new system, according to company executives, can process information at speeds previously thought impossible and make decisions with 'human-like intuition.' Critics, however, warn of potential risks and call for increased regulation before widespread deployment.",
    variant: "sensationalist",
    location: "San Francisco",
  },
  {
    id: 3,
    type: "ad",
    headline: "WarCorp Defense Solutions",
    body: "Protecting freedom, one contract at a time. Premium military-grade equipment for governments and private entities. Terms and conditions apply.",
    source: "WarCorp",
  },
  {
    id: 4,
    type: "article",
    headline: "Climate Summit Ends with Historic Agreement",
    body: "After weeks of intense negotiations, delegates from over 190 countries reached a landmark agreement on carbon emissions. The new framework, which sets ambitious targets for the next decade, has been hailed as a turning point in the fight against climate change. Environmental groups celebrate the progress while acknowledging that implementation will be the true test.",
    variant: "propaganda",
    location: "Geneva",
  },
  {
    id: 5,
    type: "ad",
    headline: "PharmaMax - Your Health, Our Priority",
    body: "Trusted by millions worldwide. Revolutionary treatments for modern ailments. Consult your doctor. Side effects may include dependency and existential dread.",
    source: "PharmaMax",
  },
  {
    id: 6,
    type: "article",
    headline: "Local Economy Shows Signs of Recovery",
    body: "Economic indicators suggest that the local economy is beginning to stabilize after months of uncertainty. Unemployment rates have decreased slightly, and consumer confidence is on the rise. Analysts remain cautious, noting that the recovery is fragile and dependent on several external factors.",
    variant: "factual",
    location: "New York",
  },
];

export default function NewspaperLayout({
  publishedItems: propPublishedItems,
  date: propDate,
  editionNumber: propEditionNumber,
  newspaperName = "THE DAILY DYSTOPIA",
}: NewspaperLayoutProps) {
  const searchParams = useSearchParams();
  const editionId = searchParams.get("id");
  
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>(mockPublishedItems);
  const [date, setDate] = useState<Date>(propDate || new Date());
  const [editionNumber, setEditionNumber] = useState<number>(propEditionNumber || 42);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ cash: number; credibility: number; readers: number } | null>(null);

  useEffect(() => {
    async function loadEditionData() {
      if (!editionId) {
        // No ID provided, use mock data
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch edition data
        const editionData = await fetchEdition(parseInt(editionId, 10));
        
        // Fetch articles and ads to get full content
        const [dailyEdition, adsList] = await Promise.all([
          fetchLatestArticles(),
          fetchAds(),
        ]);

        // Create article and ad lookup maps
        const articleMap = new Map<number, Article>();
        dailyEdition.articles.forEach((article) => {
          articleMap.set(article.id, article);
        });

        const adMap = new Map<number, Ad>();
        adsList.forEach((ad) => {
          adMap.set(ad.id, ad);
        });

        // Map placedItems to PublishedItem format, preserving grid order
        // Filter out empty cells first, then map to PublishedItem
        const mappedItems: PublishedItem[] = editionData.placedItems
          .map((item, gridIndex) => {
            if (item.isAd && item.adId) {
              const ad = adMap.get(item.adId);
              if (ad) {
                return {
                  id: gridIndex, // Use grid index to preserve order
                  type: "ad" as const,
                  headline: ad.company,
                  body: ad.description,
                  source: ad.company,
                };
              }
              return null;
            } else if (item.articleId) {
              const article = articleMap.get(item.articleId);
              if (article) {
                const variant = item.variant || "factual";
                const variantText = article.processed_variants[variant] || article.processed_variants.factual;
                
                // Extract headline (first sentence or first 80 chars)
                const getHeadline = (text: string, fallback: string): string => {
                  if (!text) return fallback;
                  const firstSentenceMatch = text.match(/^[^.!?]+[.!?]/);
                  if (firstSentenceMatch) {
                    return firstSentenceMatch[0].trim();
                  }
                  if (text.length > 80) {
                    return text.substring(0, 80).trim() + "...";
                  }
                  return text.trim() || fallback;
                };

                return {
                  id: gridIndex, // Use grid index to preserve order
                  type: "article" as const,
                  headline: getHeadline(variantText, article.original_title),
                  body: variantText,
                  variant: variant as "factual" | "sensationalist" | "propaganda",
                  location: article.location_city || undefined,
                };
              }
              return null;
            }
            return null;
          })
          .filter((item): item is PublishedItem => item !== null);

        setPublishedItems(mappedItems);
        setDate(new Date(editionData.published_at));
        setEditionNumber(editionData.id);
        setStats(editionData.stats);
      } catch (err) {
        console.error("Failed to load edition:", err);
        setError(err instanceof Error ? err.message : "Failed to load edition");
        // Fall back to mock data on error
        setPublishedItems(mockPublishedItems);
      } finally {
        setLoading(false);
      }
    }

    loadEditionData();
  }, [editionId]);

  // Headline story is the first article in the grid (lowest id/index)
  const headlineStory = publishedItems
    .filter((item) => item.type === "article")
    .sort((a, b) => a.id - b.id)[0];
  
  const otherStories = publishedItems.filter(
    (item) => item.type === "article" && item.id !== headlineStory?.id
  );
  const ads = publishedItems.filter((item) => item.type === "ad");

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f1ea] py-8 px-4 md:px-8 newspaper-paper-texture flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-[#1a1a1a] animate-spin mx-auto mb-4" />
          <p className="text-xl text-[#1a1a1a] font-serif">Printing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] py-8 px-4 md:px-8 newspaper-paper-texture">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl p-8 md:p-12" style={{ fontFamily: "var(--font-merriweather), 'Times New Roman', serif" }}>
        {/* Masthead */}
        <header className="text-center mb-8 border-b-4 border-[#1a1a1a] pb-6">
              <h1 className="text-6xl md:text-8xl font-bold text-[#1a1a1a] mb-4 tracking-tight" style={{ fontFamily: "var(--font-merriweather), 'Times New Roman', serif" }}>
                {newspaperName}
              </h1>
          <div className="flex justify-between items-center text-sm md:text-base text-[#1a1a1a] border-t-2 border-b-2 border-[#1a1a1a] py-2 mt-4">
            <div className="text-left">
              <p>{formatDate(date)}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">EDITION #{editionNumber}</p>
            </div>
            <div className="text-right">
              <p>PRICE: $5.00</p>
            </div>
          </div>
          {stats && (
            <div className="flex justify-center gap-6 mt-4 text-xs text-[#666] border-t border-[#1a1a1a] pt-2">
              <span>Treasury: ${stats.cash.toLocaleString()}</span>
              <span>Credibility: {Math.round(stats.credibility)}%</span>
              <span>Readers: {stats.readers.toLocaleString()}</span>
            </div>
          )}
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {/* Headline Story - Spans full width or 2/3 */}
          {headlineStory && (
            <article className="md:col-span-8 border-b-2 border-[#1a1a1a] pb-6 mb-6">
              <div className="mb-2">
                {headlineStory.location && (
                  <span className="text-xs uppercase tracking-wider text-[#666]">
                    {headlineStory.location.toUpperCase()}
                  </span>
                )}
                {headlineStory.variant && (
                  <span className="text-xs uppercase tracking-wider text-[#666] ml-2">
                    • {headlineStory.variant.toUpperCase()}
                  </span>
                )}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4 leading-tight">
                {headlineStory.headline}
              </h2>
              <div className="text-[#1a1a1a] text-base md:text-lg leading-relaxed">
                <p>{headlineStory.body}</p>
              </div>
            </article>
          )}

          {/* Right Column - Sub-stories and Ads */}
          <div className="md:col-span-4 space-y-6">
            {/* Sub-stories */}
            {otherStories.slice(0, 2).map((story) => (
              <article key={story.id} className="border-b border-[#1a1a1a] pb-4">
                <div className="mb-2">
                  {story.location && (
                    <span className="text-xs uppercase tracking-wider text-[#666]">
                      {story.location.toUpperCase()}
                    </span>
                  )}
                  {story.variant && (
                    <span className="text-xs uppercase tracking-wider text-[#666] ml-2">
                      • {story.variant.toUpperCase()}
                    </span>
                  )}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-[#1a1a1a] mb-2 leading-tight">
                  {story.headline}
                </h3>
                <p className="text-sm md:text-base text-[#1a1a1a] leading-relaxed">
                  {story.body}
                </p>
              </article>
            ))}

            {/* Ads */}
            {ads.slice(0, 2).map((ad) => (
              <div
                key={ad.id}
                className="border-4 border-[#1a1a1a] p-4 bg-[#f9f9f9] relative"
              >
                <div className="absolute top-1 right-1">
                  <span className="text-[8px] uppercase tracking-widest text-[#666]">
                    SPONSORED
                  </span>
                </div>
                <h4 className="text-lg font-bold text-[#1a1a1a] mb-2">
                  {ad.headline}
                </h4>
                {ad.source && (
                  <p className="text-xs text-[#666] mb-2 italic">
                    {ad.source}
                  </p>
                )}
                <p className="text-sm text-[#1a1a1a] leading-relaxed">
                  {ad.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section - More Stories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8 border-t-2 border-[#1a1a1a] pt-6">
          {otherStories.slice(2).map((story) => (
            <article key={story.id} className="border-r border-[#1a1a1a] pr-4 last:border-r-0">
              <div className="mb-2">
                {story.location && (
                  <span className="text-xs uppercase tracking-wider text-[#666]">
                    {story.location.toUpperCase()}
                  </span>
                )}
                {story.variant && (
                  <span className="text-xs uppercase tracking-wider text-[#666] ml-2">
                    • {story.variant.toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="text-lg md:text-xl font-bold text-[#1a1a1a] mb-2 leading-tight">
                {story.headline}
              </h3>
              <p className="text-sm text-[#1a1a1a] leading-relaxed">
                {story.body}
              </p>
            </article>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t-2 border-[#1a1a1a] text-center">
          <p className="text-xs text-[#666]">
            © {new Date().getFullYear()} {newspaperName}. All rights reserved. | 
            Printed in Dystopia, USA | 
            "The Truth, Sometimes"
          </p>
        </footer>
      </div>
    </div>
  );
}

