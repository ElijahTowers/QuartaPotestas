"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Loader2, ArrowLeft } from "lucide-react";

// Helper to get actual API URL with Cloudflare tunnel support
function getActualApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Use API proxy for production domain or Cloudflare tunnels
    if (hostname === "quartapotestas.com" || hostname === "www.quartapotestas.com" || hostname.includes("trycloudflare.com")) {
      const cleanPath = path.startsWith("/api/") ? path.substring(4) : (path.startsWith("/") ? path : `/${path}`);
      return `/api/proxy${cleanPath}`;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
    }
    return `http://${hostname}:8000${path.startsWith("/") ? path : `/${path}`}`;
  }
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
}

interface GridPlacement {
  articleId: number | null;
  variant: string | null;
  isAd: boolean;
  adId: string | null;
}

interface PublishedEdition {
  id: string;
  date: string;
  newspaper_name: string;
  grid_layout: GridPlacement[];
  stats: {
    cash: number;
    credibility: number;
    readers: number;
  };
  created: string;
}

interface Article {
  id: number;
  original_title: string;
  processed_variants?: Record<string, string>;
  date?: string;
  published_at?: string;
  location_city?: string;
}

interface Ad {
  id: string;
  company: string;
  tagline: string;
  description: string;
  tags?: string[];
}

interface PublishedItem {
  id: number;
  type: "article" | "ad";
  headline: string;
  body: string;
  variant?: "factual" | "sensationalist" | "propaganda";
  source?: string;
  location?: string;
}

export default function ArchiveDetailPage() {
  const router = useRouter();
  const params = useParams();
  const editionId = params.id as string;
  const { user } = useAuth();

  const [edition, setEdition] = useState<PublishedEdition | null>(null);
  const [publishedItems, setPublishedItems] = useState<PublishedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get token
        let token: string | null = null;
        try {
          const { getPocketBase } = await import("@/lib/pocketbase");
          const pb = getPocketBase();
          token = pb.authStore.token;
        } catch (e) {
          token = localStorage.getItem("token");
        }

        if (!token) {
          throw new Error("Not authenticated");
        }

        // Fetch edition
        const editionResponse = await fetch(
          getActualApiUrl(`/api/published-editions/${editionId}`),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            credentials: "omit",
          }
        );

        if (!editionResponse.ok) {
          throw new Error("Failed to load edition");
        }

        const editionData = await editionResponse.json();
        
        console.log("[Archive Detail] Loaded edition:", {
          id: editionData.id,
          newspaper_name: editionData.newspaper_name,
          grid_layout_type: typeof editionData.grid_layout,
          grid_layout_length: Array.isArray(editionData.grid_layout) ? editionData.grid_layout.length : "not array",
          grid_layout_keys: typeof editionData.grid_layout === "object" ? Object.keys(editionData.grid_layout) : "not object",
          grid_layout_sample: editionData.grid_layout,
        });

        // Parse grid_layout if it's a string
        if (typeof editionData.grid_layout === "string") {
          try {
            editionData.grid_layout = JSON.parse(editionData.grid_layout);
          } catch (e) {
            console.warn("Could not parse grid_layout:", e);
            editionData.grid_layout = [];
          }
        }

        // Convert object to array if needed
        if (typeof editionData.grid_layout === "object" && !Array.isArray(editionData.grid_layout)) {
          console.log("[Archive Detail] Converting grid_layout object to array", editionData.grid_layout);
          // Check if it has placedItems property (this is what we store)
          if (editionData.grid_layout.placedItems && Array.isArray(editionData.grid_layout.placedItems)) {
            editionData.grid_layout = editionData.grid_layout.placedItems;
          } else {
            // It's an object with numeric keys, convert to array
            editionData.grid_layout = Object.values(editionData.grid_layout);
          }
        }

        // Ensure grid_layout is an array
        if (!Array.isArray(editionData.grid_layout)) {
          console.warn("grid_layout is not an array:", editionData.grid_layout);
          editionData.grid_layout = [];
        }

        setEdition(editionData);

        // Fetch all articles and ads to build lookup maps
        try {
          console.log("[Archive Detail] Fetching articles and ads...");
          
          // Get token for PocketBase direct access
          let pbToken: string | null = token;
          try {
            const { getPocketBase } = await import("@/lib/pocketbase");
            const pb = getPocketBase();
            if (pb.authStore.token) {
              pbToken = pb.authStore.token;
            }
          } catch (e) {
            // Use the token we already have
          }

          const [articlesResponse, adsResponse] = await Promise.all([
            // Fetch articles directly from PocketBase with all records
            fetch(
              `http://localhost:8090/api/collections/articles/records?perPage=500`,
              {
                headers: { 
                  "Authorization": `Bearer ${pbToken}`,
                  "Content-Type": "application/json",
                },
              }
            ),
            fetch(getActualApiUrl("/api/ads"), {
              headers: { "Authorization": `Bearer ${token}` },
            }),
          ]);

          const articleMap = new Map<number, Article>();
          const adMap = new Map<string, Ad>();

          if (articlesResponse.ok) {
            const articlesData = await articlesResponse.json();
            console.log("[Archive Detail] Fetched articles from PocketBase:", articlesData.items?.length || 0);
            
            // Store articles with numeric index as key (1-based) since that's what placedItems uses
            articlesData.items?.forEach((article: any, index: number) => {
              const numericId = index + 1;
              articleMap.set(numericId, {
                id: numericId,
                original_title: article.original_title || article.headline || "",
                processed_variants: article.processed_variants || {},
                date: article.date,
                published_at: article.published_at,
                location_city: article.location_city,
              });
            });
            
            console.log("[Archive Detail] Article map size:", articleMap.size);
            console.log("[Archive Detail] Article map keys:", Array.from(articleMap.keys()));
          } else {
            console.warn("[Archive Detail] Articles fetch failed:", articlesResponse.status);
          }

          if (adsResponse.ok) {
            const adsData = await adsResponse.json();
            console.log("[Archive Detail] Fetched ads:", adsData.items?.length || 0);
            adsData.items?.forEach((ad: Ad) => {
              adMap.set(ad.id, ad);
            });
            console.log("[Archive Detail] Ad map size:", adMap.size);
          } else {
            console.warn("[Archive Detail] Ads fetch failed:", adsResponse.status);
          }

          // Convert grid_layout to publishedItems
          const items: PublishedItem[] = [];
          let articleIndex = 0; // Track which article we're on for fallback
          
          editionData.grid_layout.forEach((placement: GridPlacement, index: number) => {
            console.log(`[Archive Detail] Processing cell ${index}:`, {
              placement_keys: Object.keys(placement),
              isAd: placement.isAd,
              articleId: placement.articleId,
              adId: placement.adId,
              variant: placement.variant,
              full_placement: placement,
            });

            // If headline and body are already stored, use them directly!
            if (placement.headline && placement.body) {
              console.log(`[Archive Detail] Cell ${index}: Using stored content`);
              items.push({
                id: index,
                type: placement.isAd ? "ad" : "article",
                headline: placement.headline,
                body: placement.body,
                variant: placement.variant as any,
                source: placement.isAd ? placement.headline : undefined,
              });
              return;
            }

            // Fallback: Lookup from database (for older editions without stored content)
            if (placement.isAd && placement.adId) {
              const ad = adMap.get(placement.adId);
              console.log(`[Archive Detail] Ad lookup for "${placement.adId}":`, ad ? "found" : "not found");
              if (ad) {
                items.push({
                  id: index,
                  type: "ad",
                  headline: ad.company,
                  body: ad.description,
                  source: ad.company,
                });
              }
            } else if (placement.articleId !== null || !placement.isAd) {
              // Try to find article by ID first, otherwise use next available article
              let article = placement.articleId ? articleMap.get(placement.articleId) : null;
              
              // Fallback: if article not found by ID, use next available article
              if (!article && articleIndex < articleMap.size) {
                article = articleMap.get(articleIndex + 1);
                articleIndex++;
              }
              
              console.log(`[Archive Detail] Article lookup for ${placement.articleId}:`, article ? "found" : "not found");
              if (article) {
                const variant = placement.variant || "factual";
                const variantText =
                  article.processed_variants?.[variant] ||
                  article.processed_variants?.factual ||
                  "";

                items.push({
                  id: index,
                  type: "article",
                  headline: article.original_title,
                  body: variantText,
                  variant: variant as "factual" | "sensationalist" | "propaganda",
                  location: article.location_city,
                });
              }
            }
          });

          console.log("[Archive Detail] Final published items:", items.length);
          setPublishedItems(items);
        } catch (e) {
          console.error("Could not fetch articles/ads:", e);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load edition";
        setError(message);
        console.error("Archive detail error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editionId]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-[#f4f1ea]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#1a1a1a] animate-spin mx-auto mb-4" />
            <p className="text-[#1a1a1a]">Loading edition...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !edition) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-[#f4f1ea]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || "Edition not found"}</p>
            <button
              onClick={() => router.push("/archives")}
              className="px-6 py-2 bg-[#1a1a1a] text-[#f4f1ea] font-bold rounded hover:bg-[#333] transition-colors"
            >
              Back to Archives
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Map items to rows like in the editor
  const row1 = publishedItems.slice(0, 1);
  const row2 = publishedItems.slice(1, 3);
  const row3 = publishedItems.slice(3, 6);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ProtectedRoute>
      <div className="w-full bg-[#f4f1ea] newspaper-paper-texture" style={{ height: "100vh", overflowY: "auto" }}>
        {/* Header Bar */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 sticky top-0 bg-[#f4f1ea] z-50 border-b border-[#8b6f47]">
          <button
            onClick={() => router.push("/archives")}
            className="flex items-center gap-2 text-[#1a1a1a] hover:text-[#666] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Archives
          </button>
        </div>

        {/* Newspaper */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12" style={{ fontFamily: "var(--font-merriweather), 'Times New Roman', serif" }}>
          <div className="vintage-newspaper-paper p-8 md:p-12">
          {/* Masthead */}
          <header className="text-center mb-8 border-b-4 border-[#1a1a1a] pb-6 relative z-10">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 tracking-tight break-words px-2 relative z-10"
              style={{ fontFamily: "var(--font-merriweather), 'Times New Roman', serif" }}
            >
              {edition.newspaper_name}
            </h1>
            <div className="flex justify-between items-center text-sm md:text-base text-[#1a1a1a] border-t-2 border-b-2 border-[#1a1a1a] py-2 mt-4">
              <div className="text-left">
                <p>{formatDate(edition.date)}</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">EDITION #{edition.id.substring(0, 8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p>PRICE: $5.00</p>
              </div>
            </div>
            {edition.stats && (
              <div className="flex justify-center gap-6 mt-4 text-xs text-[#666] border-t border-[#1a1a1a] pt-2">
                <span>Treasury: ${edition.stats.cash.toLocaleString()}</span>
                <span>Credibility: {Math.round(edition.stats.credibility)}%</span>
                <span>Readers: {edition.stats.readers.toLocaleString()}</span>
              </div>
            )}
          </header>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Row 1: 1 breed item */}
            <div className="grid grid-cols-1 gap-4">
              {row1.length > 0 ? (
                row1.map((item) => (
                  <RenderedItem key={`row1-${item.id}`} item={item} size="large" />
                ))
              ) : (
                <div className="border-2 border-dashed border-[#1a1a1a] p-6 text-center text-[#666] italic">
                  Empty slot
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
                    Empty slot
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
                    Empty slot
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-8 pt-4 border-t-2 border-[#1a1a1a] text-center">
            <p className="text-xs text-[#666]">
              © {new Date().getFullYear()} {edition.newspaper_name}. All rights reserved. | Printed
              in Dystopia | "The Truth, Sometimes"
            </p>
          </footer>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Render helpers
function RenderedItem({ item, size }: { item: PublishedItem; size: "large" | "medium" | "small" }) {
  if (item.type === "article") {
    return <RenderedArticle item={item} size={size} />;
  }
  return <RenderedAd item={item} size={size} />;
}

function RenderedArticle({
  item,
  size,
}: {
  item: PublishedItem;
  size: "large" | "medium" | "small";
}) {
  const headingSize =
    size === "large" ? "text-3xl md:text-4xl" : size === "medium" ? "text-2xl" : "text-xl";
  const bodySize =
    size === "large" ? "text-base md:text-lg" : size === "medium" ? "text-sm md:text-base" : "text-sm";

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

function RenderedAd({
  item,
  size,
}: {
  item: PublishedItem;
  size: "large" | "medium" | "small";
}) {
  const headingSize = size === "large" ? "text-2xl" : size === "medium" ? "text-xl" : "text-lg";
  const bodySize = size === "large" ? "text-base" : "text-sm";

  return (
    <div className="border-4 border-[#1a1a1a] p-4 bg-[#f9f9f9] relative shadow-sm">
      <div className="absolute top-1 right-1">
        <span className="text-[8px] uppercase tracking-widest text-[#666]">SPONSORED</span>
      </div>
      <h4 className={`${headingSize} font-bold text-[#1a1a1a] mb-2`}>{item.headline}</h4>
      {item.source && (
        <p className="text-xs text-[#666] mb-2 italic">{item.source}</p>
      )}
      <p className={`${bodySize} text-[#1a1a1a] leading-relaxed`}>{item.body}</p>
    </div>
  );
}
