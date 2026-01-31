"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPublicPublishedEdition, type PublicPublishedItem } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface PublishedItem {
  id: string;
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
    id: "1",
    type: "article",
    headline: "BREAKING: World Leaders Gather in Secret Summit",
    body: "In an unprecedented move, world leaders from across the globe convened in an undisclosed location yesterday to discuss the future of international relations. Sources close to the matter suggest that the meeting, which lasted over 12 hours, covered topics ranging from economic policy to climate change mitigation strategies. The secrecy surrounding the event has raised eyebrows among transparency advocates, who question the democratic legitimacy of such closed-door negotiations.",
    variant: "factual",
    location: "Global",
  },
  {
    id: "2",
    type: "article",
    headline: "Tech Giant Announces Revolutionary AI Breakthrough",
    body: "A major technology corporation has unveiled what it claims to be the most advanced artificial intelligence system ever created. The new system, according to company executives, can process information at speeds previously thought impossible and make decisions with 'human-like intuition.' Critics, however, warn of potential risks and call for increased regulation before widespread deployment.",
    variant: "sensationalist",
    location: "San Francisco",
  },
  {
    id: "3",
    type: "ad",
    headline: "WarCorp Defense Solutions",
    body: "Protecting freedom, one contract at a time. Premium military-grade equipment for governments and private entities. Terms and conditions apply.",
    source: "WarCorp",
  },
  {
    id: "4",
    type: "article",
    headline: "Climate Summit Ends with Historic Agreement",
    body: "After weeks of intense negotiations, delegates from over 190 countries reached a landmark agreement on carbon emissions. The new framework, which sets ambitious targets for the next decade, has been hailed as a turning point in the fight against climate change. Environmental groups celebrate the progress while acknowledging that implementation will be the true test.",
    variant: "propaganda",
    location: "Geneva",
  },
  {
    id: "5",
    type: "ad",
    headline: "PharmaMax - Your Health, Our Priority",
    body: "Trusted by millions worldwide. Revolutionary treatments for modern ailments. Consult your doctor. Side effects may include dependency and existential dread.",
    source: "PharmaMax",
  },
  {
    id: "6",
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
  
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>(
    propPublishedItems || mockPublishedItems
  );
  const [date, setDate] = useState<Date>(propDate || new Date());
  const [editionNumber, setEditionNumber] = useState<number>(propEditionNumber || 42);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ cash: number; credibility: number; readers: number } | null>(null);
  const [paperName, setPaperName] = useState<string>(newspaperName);
  const [username, setUsername] = useState<string | null>(null);

  // Update publishedItems when prop changes (for real-time editor preview)
  useEffect(() => {
    if (propPublishedItems && !editionId) {
      setPublishedItems(propPublishedItems);
    }
  }, [propPublishedItems, editionId]);

  useEffect(() => {
    async function loadEditionData() {
      if (!editionId) {
        if (propPublishedItems) setPublishedItems(propPublishedItems);
        setPaperName(newspaperName);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const editionData = await getPublicPublishedEdition(editionId);

        const mappedItems: PublishedItem[] = (editionData.published_items || []).map(
          (item: PublicPublishedItem, idx: number) => ({
            id: `${editionData.id}-${idx}`,
            type: item.type,
            headline: item.headline,
            body: item.body,
            variant: item.variant,
            source: item.source,
            location: item.location,
          })
        );

        setPublishedItems(mappedItems);
        setPaperName(editionData.newspaper_name || newspaperName);
        setUsername(editionData.username || null);

        const parsedDate = new Date(editionData.date);
        setDate(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);

        setEditionNumber(propEditionNumber || 42);

        const s: any = editionData.stats || {};
        setStats({
          cash: Number(s.cash ?? 0),
          credibility: Number(s.credibility ?? 0),
          readers: Number(s.readers ?? 0),
        });
      } catch (err) {
        console.error("Failed to load edition:", err);
        setError(err instanceof Error ? err.message : "Failed to load edition");
        setPublishedItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadEditionData();
  }, [editionId, propEditionNumber, propPublishedItems, newspaperName]);

  // Map published items into row-based layout (matching editor)
  const row1 = publishedItems.slice(0, 1);
  const row2 = publishedItems.slice(1, 3);
  const row3 = publishedItems.slice(3, 6);

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
      <div className="max-w-7xl mx-auto vintage-newspaper-paper p-8 md:p-12" style={{ fontFamily: "var(--font-merriweather), 'Times New Roman', serif" }}>
        {/* Masthead */}
        <header className="text-center mb-8 border-b-4 border-[#1a1a1a] pb-6 relative z-10">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 tracking-tight break-words px-2 relative z-10" style={{ fontFamily: "var(--font-merriweather), 'Times New Roman', serif" }}>
                {paperName}
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

        {/* Main Content - Match editor layout: 1 / 2 / 3 rows */}
        <div className="space-y-6">
          {/* Row 1: 1 breed item */}
          <div className="grid grid-cols-1 gap-4">
            {row1.length > 0 ? (
              row1.map((item) => (
                <RenderedItem key={`row1-${item.id}`} item={item} size="large" />
              ))
            ) : (
              <div className="border-2 border-dashed border-[#1a1a1a] p-6 text-center text-[#666] italic">
                Drop article or ad here
              </div>
            )}
          </div>

          {/* Row 2: 2 items naast elkaar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[0, 1].map((idx) => {
              const item = row2[idx];
              return item ? (
                <RenderedItem key={`row2-${item.id}`} item={item} size="medium" />
              ) : (
                <div
                  key={`row2-placeholder-${idx}`}
                  className="border-2 border-dashed border-[#1a1a1a] p-6 text-center text-[#666] italic"
                >
                  Drop article or ad here
                </div>
              );
            })}
          </div>

          {/* Row 3: 3 items naast elkaar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[0, 1, 2].map((idx) => {
              const item = row3[idx];
              return item ? (
                <RenderedItem key={`row3-${item.id}`} item={item} size="small" />
              ) : (
                <div
                  key={`row3-placeholder-${idx}`}
                  className="border-2 border-dashed border-[#1a1a1a] p-6 text-center text-[#666] italic"
                >
                  Drop article or ad here
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t-2 border-[#1a1a1a] text-center">
          <p className="text-xs text-[#666]">
            © {new Date().getFullYear()} {paperName}. All rights reserved. | 
            Printed in Dystopia{username ? ` | Editor: ${username}` : ""} | 
            "The Truth, Sometimes"
          </p>
        </footer>
      </div>
    </div>
  );
}

// Render helpers
function RenderedItem({ item, size }: { item: PublishedItem; size: "large" | "medium" | "small" }) {
  if (item.type === "article") {
    return <RenderedArticle item={item} size={size} />;
  }
  return <RenderedAd item={item} size={size} />;
}

function RenderedArticle({ item, size }: { item: PublishedItem; size: "large" | "medium" | "small" }) {
  const headingSize =
    size === "large" ? "text-3xl md:text-4xl" : size === "medium" ? "text-2xl" : "text-xl";
  const bodySize = size === "large" ? "text-base md:text-lg" : size === "medium" ? "text-sm md:text-base" : "text-sm";

  return (
    <article className="border-2 border-[#1a1a1a] p-4 bg-[#f9f3e5] shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[#666]">
        {item.location && <span>{item.location.toUpperCase()}</span>}
        {item.variant && <span>• {item.variant.toUpperCase()}</span>}
      </div>
      <h3 className={`${headingSize} font-bold text-[#1a1a1a] mb-3 leading-tight`}>
        {item.headline}
      </h3>
      <p className={`${bodySize} text-[#1a1a1a] leading-relaxed`}>{item.body}</p>
    </article>
  );
}

function RenderedAd({ item, size }: { item: PublishedItem; size: "large" | "medium" | "small" }) {
  const headingSize = size === "large" ? "text-2xl" : size === "medium" ? "text-xl" : "text-lg";
  const bodySize = size === "large" ? "text-base" : "text-sm";

  return (
    <div className="border-4 border-[#1a1a1a] p-4 bg-[#f9f9f9] relative shadow-sm">
      <div className="absolute top-1 right-1">
        <span className="text-[8px] uppercase tracking-widest text-[#666]">SPONSORED</span>
      </div>
      <h4 className={`${headingSize} font-bold text-[#1a1a1a] mb-2`}>
        {item.headline}
      </h4>
      {item.source && (
        <p className="text-xs text-[#666] mb-2 italic">
          {item.source}
        </p>
      )}
      <p className={`${bodySize} text-[#1a1a1a] leading-relaxed`}>{item.body}</p>
    </div>
  );
}

