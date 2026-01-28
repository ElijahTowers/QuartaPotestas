/**
 * PocketBase API client for fetching scoops/articles
 * This replaces the FastAPI backend for data fetching
 */

import { getPocketBase } from "./pocketbase";
import type { Article, DailyEdition } from "@/types/api";

const pb = getPocketBase();

/**
 * Fetch latest articles (scoops) from PocketBase
 * Maps PocketBase collection to DailyEdition format
 */
// Track ongoing requests to prevent duplicates
let ongoingRequest: Promise<DailyEdition> | null = null;

export async function fetchLatestArticles(): Promise<DailyEdition> {
  // If there's already an ongoing request, return it instead of starting a new one
  if (ongoingRequest) {
    try {
      return await ongoingRequest;
    } catch (error) {
      // If the ongoing request fails, allow a new one
      ongoingRequest = null;
      throw error;
    }
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      // Optimized approach: Fetch all articles first, then find the edition with most articles
      // This reduces the number of requests and avoids auto-cancellation issues
      
      // Fetch all recent articles (single request)
      const allArticles = await pb.collection("articles").getList(1, 500, {
        sort: "-published_at",
        expand: "daily_edition_id", // Try to expand relation (may not work, but worth trying)
      });

    if (allArticles.items.length === 0) {
      // No articles at all, return empty edition
      return {
        id: 0,
        date: new Date().toISOString().split("T")[0],
        global_mood: "neutral",
        articles: [],
      };
    }

    // Group articles by daily_edition_id
    const articlesByEdition = new Map<string, typeof allArticles.items>();
    for (const article of allArticles.items) {
      const editionId = article.daily_edition_id;
      if (!articlesByEdition.has(editionId)) {
        articlesByEdition.set(editionId, []);
      }
      articlesByEdition.get(editionId)!.push(article);
    }

    // Find the edition with the most articles
    let bestEditionId = "";
    let maxCount = 0;
    for (const [editionId, articles] of articlesByEdition.entries()) {
      if (articles.length > maxCount) {
        maxCount = articles.length;
        bestEditionId = editionId;
      }
    }

    // Fetch the edition details
    let edition;
    try {
      edition = await pb.collection("daily_editions").getOne(bestEditionId);
    } catch (error) {
      // If edition fetch fails, try to get latest edition as fallback
      const editions = await pb.collection("daily_editions").getList(1, 1, {
        sort: "-date",
      });
      if (editions.items.length > 0) {
        edition = editions.items[0];
      } else {
        throw new Error("No daily editions found");
      }
    }
    
    const articles = articlesByEdition.get(bestEditionId) || [];

    // Map PocketBase records to Article format
    // Note: PocketBase IDs are strings, but we convert to number for compatibility
    const mappedArticles: Article[] = articles.map((item: any) => {
      // Parse JSON fields if they're strings
      let processed_variants = item.processed_variants;
      let tags = item.tags;
      
      if (typeof processed_variants === 'string') {
        try {
          processed_variants = JSON.parse(processed_variants);
        } catch {
          processed_variants = {};
        }
      }
      
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = {};
        }
      }
      
      // Convert PocketBase string ID to number (using hash or simple conversion)
      // For now, use a simple hash of the string ID
      const idHash = item.id.split('').reduce((acc: number, char: string) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      const numericId = Math.abs(idHash);
      
      // Parse audience_scores if present
      let audience_scores = item.audience_scores;
      if (typeof audience_scores === 'string') {
        try {
          audience_scores = JSON.parse(audience_scores);
        } catch {
          audience_scores = undefined;
        }
      }
      
      return {
        id: item.id, // Use REAL PocketBase ID (string), not numeric hash
        original_title: item.original_title,
        processed_variants: processed_variants || {},
        tags: tags || {},
        location_lat: item.location_lat || null,
        location_lon: item.location_lon || null,
        location_city: item.location_city || null,
        date: item.date || edition.date,
        published_at: item.published_at || null,
        assistant_comment: item.assistant_comment || undefined,
        audience_scores: audience_scores || undefined,
      };
    });

    // Convert edition ID to number (using hash)
    const editionIdHash = edition.id.split('').reduce((acc: number, char: string) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const numericEditionId = Math.abs(editionIdHash);
    
      return {
        id: numericEditionId,
        date: edition.date || new Date().toISOString().split("T")[0],
        global_mood: edition.global_mood || "neutral",
        articles: mappedArticles,
      };
    } catch (error: any) {
      // Check if this is an auto-cancellation error (which we can ignore)
      const isAutoCancelled = 
        error?.message?.includes("autocancelled") ||
        error?.message?.includes("auto-cancellation") ||
        error?.status === 0 ||
        (error?.isAbortError === true);
      
      if (isAutoCancelled) {
        // If request was auto-cancelled, it means a new request was made
        // Return empty edition to avoid breaking the UI, but log it
        console.warn("Request was auto-cancelled (likely due to rapid re-renders)");
        return {
          id: 0,
          date: new Date().toISOString().split("T")[0],
          global_mood: "neutral",
          articles: [],
        };
      }
      
      console.error("Error fetching articles from PocketBase:", error);
      throw new Error(
        `Failed to fetch articles: ${error.message || "Unknown error"}`
      );
    } finally {
      // Clear ongoing request when done (success or error)
      ongoingRequest = null;
    }
  })();

  ongoingRequest = requestPromise;
  return requestPromise;
}

/**
 * Fetch ads from PocketBase
 */
export async function fetchAds(): Promise<import("./api").Ad[]> {
  try {
    const ads = await pb.collection("ads").getList(1, 100, {
      sort: "-created",
    });

    return ads.items.map((item: any) => ({
      id: parseInt(item.id),
      company: item.company,
      tagline: item.tagline,
      description: item.description,
      tags: item.tags || [],
    }));
  } catch (error: any) {
    console.error("Error fetching ads from PocketBase:", error);
    throw new Error(`Failed to fetch ads: ${error.message || "Unknown error"}`);
  }
}

/**
 * Reset and ingest new articles
 * This will call the FastAPI backend for now (since ingestion logic is there)
 * TODO: Move ingestion logic to a PocketBase hook or separate service
 */
export async function resetAndIngest(): Promise<any> {
  // For now, keep using the FastAPI backend for ingestion
  // This can be moved to PocketBase hooks later
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  // Get authentication token from PocketBase
  const pb = getPocketBase();
  const token = pb.authStore.token;
  
  if (!token) {
    throw new Error("Authentication required. Please log in first.");
  }
  
  try {
    // Use proxy if on Cloudflare tunnel
    const resetUrl = typeof window !== "undefined" && window.location.hostname.includes("trycloudflare.com")
      ? `/api/proxy/debug/reset-and-ingest`
      : `${API_BASE_URL}/api/debug/reset-and-ingest`;
    
    const response = await fetch(resetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to reset and ingest (${response.status}): ${errorText}`);
    }

    return response.json();
  } catch (error: any) {
    throw new Error(
      `Failed to reset and ingest: ${error.message || "Unknown error"}`
    );
  }
}

