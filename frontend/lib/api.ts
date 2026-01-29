/**
 * API client - Uses PocketBase for data fetching, FastAPI for ingestion
 * 
 * To use PocketBase: Import from './pocketbase-api' instead
 * To use FastAPI: Import from this file (legacy)
 */

// Option to use PocketBase instead of FastAPI
const USE_POCKETBASE = process.env.NEXT_PUBLIC_USE_POCKETBASE === "true";

// Dynamically determine API URL based on where the frontend is accessed from
function getApiBaseUrl(): string {
  // If explicitly set via environment variable, use that
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // If running in browser, use the same hostname as the frontend
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If accessing via localhost or 127.0.0.1, use localhost for backend
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    // If accessing via production domain or Cloudflare tunnel, use Next.js API proxy
    // The proxy route will forward requests to the backend
    if (hostname === "quartapotestas.com" || hostname === "www.quartapotestas.com" || hostname.includes("trycloudflare.com")) {
      // Use Next.js API proxy route
      return ""; // Empty string means relative to current origin, will use /api/proxy
    }
    // Otherwise, use the same hostname (for network access)
    return `http://${hostname}:8000`;
  }
  
  // Fallback for server-side rendering
  return "http://localhost:8000";
}

const API_BASE_URL = getApiBaseUrl();

// Helper to get the actual API URL (with proxy support for Cloudflare tunnels)
function getActualApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    
    // Check if we're on the production domain or old Cloudflare tunnel
    // Use Next.js API proxy route for both
    if (hostname === "quartapotestas.com" || hostname === "www.quartapotestas.com" || hostname.includes("trycloudflare.com")) {
      // Use Next.js proxy route
      // Remove /api/ prefix from path since proxy adds it
      const cleanPath = path.startsWith("/api/") ? path.substring(4) : (path.startsWith("/") ? path : `/${path}`);
      return `/api/proxy${cleanPath}`;
    }
  }
  // Use direct backend URL for localhost/network access
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchWithErrorHandling(url: string): Promise<Response> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      // Don't include credentials to avoid CORS preflight issues
      credentials: "omit",
      // Add mode to handle CORS
      mode: "cors",
    });

    return response;
  } catch (error) {
    // Network error (backend not running, CORS issue, etc.)
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend at ${API_BASE_URL}. Please ensure:\n1. Backend is running (uvicorn app.main:app --reload)\n2. Backend is accessible on port 8000\n3. No firewall is blocking the connection`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export async function fetchTodayArticles(): Promise<import("@/types/api").DailyEdition> {
  const response = await fetchWithErrorHandling(getActualApiUrl("/api/articles/today"));

  if (!response.ok) {
    if (response.status === 404) {
      // Try to fetch latest edition if today's doesn't exist
      return fetchLatestArticles();
    }
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch articles (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function fetchFeed(): Promise<import("@/types/api").DailyEdition> {
  /**
   * Fetch scoops from the public feed endpoint.
   * Returns articles between yesterday 18:00 and today 18:00 (Dutch timezone).
   * Requires authentication.
   * Converts feed response to DailyEdition format for compatibility.
   */
  // Always try to get token from PocketBase first (app uses PocketBase for auth)
  let token: string | null = null;
  
  try {
    const { getPocketBase } = await import("./pocketbase");
    const pb = getPocketBase();
    token = pb.authStore.token;
  } catch (e) {
    // PocketBase not available, try localStorage as fallback
    token = localStorage.getItem("token");
  }
  
  if (!token) {
    throw new Error("Authentication required. Please log in first.");
  }

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  const apiUrl = getActualApiUrl("/api/feed");
  console.log("[fetchFeed] Fetching from:", apiUrl);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
      mode: "cors",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
    if (response.status === 401) {
      // Clear invalid token
      localStorage.removeItem("token");
      throw new Error("Authentication failed. Please log in again.");
    }
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch feed (${response.status}): ${errorText}`);
    }

    const feedData = await response.json();
  const items = feedData.items || [];
  
  // Convert feed items to DailyEdition format
  // Generate a simple numeric ID for each article (hash of string ID)
  const articles = items.map((item: any, index: number) => {
    // Parse JSON fields if they're strings
    let processed_variants = item.processed_variants || {};
    let tags = item.tags || {};
    
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
    
    // Generate numeric ID from string ID
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
      id: item.id, // Use REAL PocketBase ID, not hash! This is critical for published_editions
      original_title: item.original_title || "",
      processed_variants: processed_variants,
      tags: tags,
      location_lat: item.location_lat || null,
      location_lon: item.location_lon || null,
      location_city: item.location_city || null,
      assistant_comment: item.assistant_comment || undefined,
      audience_scores: audience_scores || undefined,
      date: item.date || new Date().toISOString().split("T")[0],
      published_at: item.published_at || null,
    };
  });
  
    // Return as DailyEdition format
    return {
      id: 0, // Feed doesn't have a specific edition ID
      date: new Date().toISOString().split("T")[0],
      global_mood: "neutral",
      articles: articles,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout: Backend did not respond in time. Please check if the backend is running.");
    }
    throw error;
  }
}

/**
 * Aggregate audience scores across the current feed articles
 * to get a snapshot of how each faction is reacting overall.
 */
export async function getAudienceSnapshot(): Promise<import("@/types/api").AudienceScores> {
  // Default zeroed scores
  const emptyScores: import("@/types/api").AudienceScores = {
    elite: 0,
    working_class: 0,
    patriots: 0,
    syndicate: 0,
    technocrats: 0,
    faithful: 0,
    resistance: 0,
    doomers: 0,
  };

  try {
    const edition = await fetchLatestArticles();
    const articles = edition.articles || [];

    if (!articles.length) return emptyScores;

    const totals = { ...emptyScores };
    const counts = { ...emptyScores };

    for (const article of articles) {
      if (!article.audience_scores) continue;
      for (const key of Object.keys(emptyScores) as (keyof typeof emptyScores)[]) {
        const val = article.audience_scores[key];
        if (typeof val === "number") {
          totals[key] += val;
          counts[key] += 1;
        }
      }
    }

    const averaged: import("@/types/api").AudienceScores = { ...emptyScores };
    (Object.keys(emptyScores) as (keyof typeof emptyScores)[]).forEach((key) => {
      if (counts[key] > 0) {
        averaged[key] = Math.round(totals[key] / counts[key]);
      }
    });

    return averaged;
  } catch (error) {
    console.error("Failed to compute audience snapshot:", error);
    return emptyScores;
  }
}

export async function fetchLatestArticles(): Promise<import("@/types/api").DailyEdition> {
  // Always try to get token from PocketBase first (app uses PocketBase for auth)
  let hasToken = false;
  let token: string | null = null;
  let isGuest = false;
  
  // Check if user is in guest mode
  try {
    if (typeof window !== "undefined") {
      isGuest = localStorage.getItem("guestMode") === "true";
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  
  try {
    const { getPocketBase } = await import("./pocketbase");
    const pb = getPocketBase();
    token = pb.authStore.token;
    hasToken = !!token;
  } catch (e) {
    // PocketBase not available, try localStorage
    token = localStorage.getItem("token");
    hasToken = !!token;
  }
  
  console.log(`[fetchLatestArticles] Auth state: hasToken=${hasToken}, isGuest=${isGuest}`);
  
  // If we have a token and are not a guest, try the feed endpoint first
  if (hasToken && !isGuest) {
    try {
      return await fetchFeed();
    } catch (error) {
      // If feed fails (e.g., token expired), fall back to PocketBase
      console.warn("Feed endpoint failed, falling back to PocketBase:", error);
      try {
        const { fetchLatestArticles: fetchFromPB } = await import("./pocketbase-api");
        return fetchFromPB();
      } catch (pbError) {
        // If PocketBase also fails, re-throw the original feed error
        throw error;
      }
    }
  }
  
  // No token - try public API endpoint first (for guests)
  // The backend endpoint uses admin auth, so it works without user token
  console.log("[fetchLatestArticles] No user token, trying public API endpoint for guest access");
  try {
    const response = await fetchWithErrorHandling(getActualApiUrl("/api/articles/latest"));
    if (response.ok) {
      const data = await response.json();
      console.log(`[fetchLatestArticles] Raw response from public endpoint:`, data);
      console.log(`[fetchLatestArticles] Successfully fetched ${data.articles?.length || 0} articles from public endpoint`);
      
      // Map backend response format to frontend format if needed
      // Backend returns: { id (string), date, global_mood, articles: [...] }
      // Frontend expects: { id (number), date, global_mood, articles: [...] }
      // Articles have string IDs, edition has number ID
      const mappedData = {
        id: typeof data.id === 'string' ? parseInt(data.id) || 0 : (typeof data.id === 'number' ? data.id : 0),
        date: data.date || new Date().toISOString().split("T")[0],
        global_mood: data.global_mood || "neutral",
        articles: (data.articles || []).map((article: any) => ({
          id: String(article.id), // Articles always use string IDs
          original_title: article.original_title || "",
          processed_variants: article.processed_variants || { factual: "", sensationalist: "", propaganda: "" },
          tags: article.tags || { topic_tags: [], sentiment: "neutral" },
          location_lat: article.location_lat ?? null,
          location_lon: article.location_lon ?? null,
          location_city: article.location_city ?? null,
          date: article.date || data.date || new Date().toISOString().split("T")[0],
          published_at: article.published_at || null,
          assistant_comment: article.assistant_comment,
          audience_scores: article.audience_scores,
        })),
      };
      
      console.log(`[fetchLatestArticles] Mapped data:`, mappedData);
      return mappedData;
    } else {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[fetchLatestArticles] Public endpoint returned ${response.status}:`, errorText);
      throw new Error(`Public endpoint returned ${response.status}: ${errorText}`);
    }
  } catch (publicError) {
    // If public endpoint fails, try PocketBase directly (might work if collection is public)
    console.log("[fetchLatestArticles] Public endpoint failed, trying PocketBase directly:", publicError);
    try {
      const { fetchLatestArticles: fetchFromPB } = await import("./pocketbase-api");
      return fetchFromPB();
    } catch (pbError) {
      // If both fail, provide a helpful error message
      console.error("[fetchLatestArticles] Both public endpoint and PocketBase failed:", { publicError, pbError });
      // For guests, return empty edition instead of throwing error
      // This allows the UI to load even if articles can't be fetched
      return {
        id: 0,
        date: new Date().toISOString().split("T")[0],
        global_mood: "neutral",
        articles: [],
      };
    }
  }
}

export interface Ad {
  id: string;  // Changed from number to string to support large hash values
  company: string;
  tagline: string;
  description: string;
  tags: string[];
}

// Track ongoing ads request to prevent duplicates and auto-cancellation issues
let ongoingAdsRequest: Promise<Ad[]> | null = null;

export async function fetchAds(): Promise<Ad[]> {
  /**
   * Fetch ads from the public ads endpoint (similar to scoops feed).
   * Returns all ads available to all authenticated users.
   * Requires authentication.
   */
  // If there's already an ongoing request, return it instead of starting a new one
  // This prevents duplicate requests and auto-cancellation errors
  if (ongoingAdsRequest) {
    try {
      return await ongoingAdsRequest;
    } catch (error) {
      // If the ongoing request fails, allow a new one
      ongoingAdsRequest = null;
      throw error;
    }
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      // Get authentication token
      let token: string | null = null;
      
      try {
        const { getPocketBase } = await import("./pocketbase");
        const pb = getPocketBase();
        token = pb.authStore.token;
      } catch (e) {
        // PocketBase not available, try localStorage
        token = localStorage.getItem("token");
      }
      
      // For guests (no token), return empty array instead of throwing error
      if (!token) {
        console.log("[fetchAds] No authentication token found, returning empty ads array for guest user");
        return [];
      }

      // Fetch ads from FastAPI endpoint (similar to fetchFeed)
      const response = await fetch(getActualApiUrl("/api/ads"), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "omit",
        mode: "cors",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Clear invalid token
          localStorage.removeItem("token");
          throw new Error("Authentication failed. Please log in again.");
        }
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to fetch ads (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const ads = data.items || [];
      
      console.log(`[fetchAds] Fetched ${ads.length} ads from API`);
      return ads;
    } catch (error: any) {
      // Check if this is an auto-cancellation error (which we can ignore)
      const isAutoCancelled = 
        error?.message?.includes("autocancelled") ||
        error?.message?.includes("auto-cancellation") ||
        error?.message?.includes("The request was autocancelled");
      
      if (isAutoCancelled) {
        // Auto-cancellation is expected when components unmount or new requests are made
        // Return empty array silently
        return [];
      }
      
      // For authentication errors, throw to show user they need to log in
      if (error?.message?.includes("Authentication required") || error?.message?.includes("Authentication failed")) {
        throw error;
      }
      
      // For other errors, log but still return empty array to prevent crashes
      console.warn("Error fetching ads from API (returning empty array):", error);
      return [];
    } finally {
      // Clear the ongoing request when done
      ongoingAdsRequest = null;
    }
  })();

  // Store the promise so concurrent calls can reuse it
  ongoingAdsRequest = requestPromise;
  
  return requestPromise;
}

export interface GridPlacement {
  articleId: string | null;  // Changed from number to string (PocketBase ID)
  variant: "factual" | "sensationalist" | "propaganda" | null;
  isAd: boolean;
  adId: string | null;
  headline?: string;  // NEW: Store displayed headline
  body?: string;  // NEW: Store displayed body text
}

export interface SubmitGridResponse {
  submission_id: number;
  score: number;
  sales: number;
  outrage_meter: number;
  faction_balance: {
    elite: number;
    populace: number;
    gov: number;
  };
}

export async function submitGrid(
  grid: GridPlacement[],
  userId: number = 1
): Promise<SubmitGridResponse> {
  try {
    const response = await fetch(getActualApiUrl("/api/submissions/submit"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "omit",
      mode: "cors",
      body: JSON.stringify({
        grid,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to submit grid (${response.status}): ${errorText}`);
    }

    return response.json();
  } catch (error) {
    // Network error (backend not running, CORS issue, etc.)
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend at ${API_BASE_URL}. Please ensure:\n1. Backend is running (uvicorn app.main:app --reload)\n2. Backend is accessible on port 8000\n3. No firewall is blocking the connection`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export async function triggerIngest(): Promise<any> {
  try {
    const response = await fetch(getActualApiUrl("/api/debug/trigger-ingest"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to trigger ingest (${response.status}): ${errorText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend at ${API_BASE_URL}. Please ensure the backend is running.`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export async function resetAndIngest(): Promise<any> {
  // Always try to get token from PocketBase first (app uses PocketBase for auth)
  let token: string | null = null;
  
  try {
    const { getPocketBase } = await import("./pocketbase");
    const pb = getPocketBase();
    token = pb.authStore.token;
  } catch (e) {
    // PocketBase not available, try localStorage as fallback
    token = localStorage.getItem("token");
  }
  
  if (!token) {
    throw new Error("Authentication required. Please log in first.");
  }

  // For long-running requests like reset-and-ingest, use direct localhost if available
  // Cloudflare tunnels have a timeout (~100s) which can be exceeded
  let apiUrl: string;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If accessing via localhost, use direct connection to avoid tunnel timeout
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      apiUrl = "http://localhost:8000/api/debug/reset-and-ingest";
    } else {
      // Use tunnel/proxy for remote access
      apiUrl = getActualApiUrl("/api/debug/reset-and-ingest");
    }
  } else {
    apiUrl = getActualApiUrl("/api/debug/reset-and-ingest");
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
      mode: "cors",
      // Increase timeout for long-running requests (browser default is usually 5 minutes)
      // Note: This doesn't affect Cloudflare tunnel timeout, but helps with local requests
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      
      // Handle Cloudflare timeout errors specifically
      if (response.status === 524 || errorText.includes("524") || errorText.includes("timeout")) {
        throw new Error(
          "Request timeout: De reset-and-ingest operatie duurt te lang via de Cloudflare tunnel. " +
          "Als je lokaal werkt, gebruik dan localhost in plaats van de tunnel URL. " +
          "Of probeer het later opnieuw."
        );
      }
      
      throw new Error(`Failed to reset and ingest (${response.status}): ${errorText.substring(0, 200)}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend. Please ensure the backend is running on port 8000.`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export interface PublishStats {
  cash: number;
  credibility: number;
  readers: number;
}

export interface PublishRequest {
  stats: PublishStats;
  placedItems: GridPlacement[];
}

export interface PublishResponse {
  status: string;
  message: string;
  id: string; // Changed from number to string (PocketBase ID)
}

export async function publish(
  stats: PublishStats,
  placedItems: GridPlacement[],
  newspaperName?: string
): Promise<PublishResponse> {
  // Always try to get token from PocketBase first (app uses PocketBase for auth)
  let token: string | null = null;
  let pb: any = null;
  
  try {
    const { getPocketBase } = await import("./pocketbase");
    pb = getPocketBase();
    token = pb.authStore.token;
  } catch (e) {
    // PocketBase not available, try localStorage as fallback
    token = localStorage.getItem("token");
  }
  
  if (!token) {
    throw new Error("Authentication required. Please log in first.");
  }

  try {
    console.log("[Publish] Starting publish process...");
    
    // Use placedItems as-is - they should already have valid article/ad IDs from the wire
    const finalPlacedItems = placedItems;
    
    console.log("[Publish] PlacedItems to publish:", finalPlacedItems);

    // For long-running requests, use direct localhost if available
    let apiUrl: string;
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      // If accessing via localhost, use direct connection to avoid tunnel timeout
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        apiUrl = "http://localhost:8000/api/published-editions";
      } else {
        // Use tunnel/proxy for remote access
        apiUrl = getActualApiUrl("/api/published-editions");
      }
    } else {
      apiUrl = getActualApiUrl("/api/published-editions");
    }

    console.log(`[Publish] Sending to ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
      mode: "cors",
      body: JSON.stringify({
        stats,
        placedItems: finalPlacedItems, // Use final items
        newspaper_name: newspaperName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to publish (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Publish] Edition created successfully: ${data.id}`);
    
    // Convert response to match expected format
    // Keep the string ID from PocketBase, don't try to parse as number
    return {
      status: "success",
      message: "Newspaper published successfully!",
      id: data.id || "0", // Keep as string (PocketBase ID)
    };
  } catch (error) {
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend. Please ensure the backend is running on port 8000.`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export interface EditionData {
  id: string; // Changed from number to string (PocketBase ID)
  published_at: string;
  stats: {
    cash: number;
    credibility: number;
    readers: number;
  };
  placedItems: GridPlacement[];
}

export async function fetchEdition(editionId: string | number): Promise<EditionData> {
  try {
    // Get authentication token
    let token: string | null = null;
    try {
      const { getPocketBase } = await import("./pocketbase");
      const pb = getPocketBase();
      token = pb.authStore.token;
    } catch (e) {
      token = localStorage.getItem("token");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Add authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(getActualApiUrl(`/api/published-editions/${editionId}`), {
      method: "GET",
      headers,
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch edition (${response.status}): ${errorText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend at ${API_BASE_URL}. Please ensure the backend is running.`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}


/**
 * Get the current user's newspaper name from the database
 */
export async function getNewspaperName(): Promise<string> {
  try {
    // Get token from PocketBase auth store
    const { getPocketBase } = await import("@/lib/pocketbase");
    const pb = getPocketBase();
    const token = pb.authStore.token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = getActualApiUrl("/api/auth/newspaper-name");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
    });

    if (!response.ok) {
      // If error, return default
      return "THE DAILY DYSTOPIA";
    }

    const data = await response.json();
    return data.newspaper_name || "THE DAILY DYSTOPIA";
  } catch (error) {
    console.error("Failed to fetch newspaper name:", error);
    // Return default on error
    return "THE DAILY DYSTOPIA";
  }
}

/**
 * Update the current user's username in the database
 * Enforces unique usernames across all users (case-insensitive).
 */
export async function updateUsername(username: string): Promise<void> {
  try {
    // Get token from PocketBase auth store
    const { getPocketBase } = await import("@/lib/pocketbase");
    const pb = getPocketBase();
    const token = pb.authStore.token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = getActualApiUrl("/api/auth/username");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ username: username }),
      credentials: "omit",
    });

    if (!response.ok) {
      // Try to parse JSON error response for detailed message
      let errorMessage = "Failed to update username";
      try {
        const errorData = await response.json();
        // FastAPI returns errors in "detail" field
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = `Failed to update username (${response.status})`;
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error("Failed to update username:", error);
    throw error;
  }
}

/**
 * Update the current user's newspaper name in the database
 * Enforces unique newspaper names across all users.
 */
export async function updateNewspaperName(newspaperName: string): Promise<void> {
  try {
    // Get token from PocketBase auth store
    const { getPocketBase } = await import("@/lib/pocketbase");
    const pb = getPocketBase();
    const token = pb.authStore.token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = getActualApiUrl("/api/auth/newspaper-name");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ newspaper_name: newspaperName }),
      credentials: "omit",
    });

    if (!response.ok) {
      // Try to parse JSON error response for detailed message
      let errorMessage = "Failed to update newspaper name";
      try {
        const errorData = await response.json();
        // FastAPI returns errors in "detail" field
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = `Failed to update newspaper name (${response.status})`;
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error("Failed to update newspaper name:", error);
    throw error;
  }
}

/**
 * Get the current user's game state (treasury, purchased_upgrades, readers, credibility) from the database
 */
export async function getGameState(): Promise<{ treasury: number; purchased_upgrades: string[]; readers: number; credibility: number }> {
  try {
    // Get token from PocketBase auth store
    const { getPocketBase } = await import("@/lib/pocketbase");
    const pb = getPocketBase();
    const token = pb.authStore.token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = getActualApiUrl("/api/auth/game-state");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
    });

    if (!response.ok) {
      // If error, return defaults
      return { treasury: 0, purchased_upgrades: [], readers: 0, credibility: 0 };
    }

    const data = await response.json();
    return {
      treasury: data.treasury || 0,
      purchased_upgrades: data.purchased_upgrades || [],
      readers: data.readers || 0,
      credibility: data.credibility || 0,
    };
  } catch (error) {
    console.error("Failed to fetch game state:", error);
    // Return defaults on error
    return { treasury: 0, purchased_upgrades: [], readers: 0, credibility: 0 };
  }
}

/**
 * Update the current user's game state in the database
 */
export async function updateGameState(updates: { treasury?: number; purchased_upgrades?: string[]; readers?: number; credibility?: number }): Promise<void> {
  try {
    // Get token from PocketBase auth store
    const { getPocketBase } = await import("@/lib/pocketbase");
    const pb = getPocketBase();
    const token = pb.authStore.token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = getActualApiUrl("/api/auth/game-state");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
      credentials: "omit",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to update game state (${response.status}): ${errorText}`);
    }
  } catch (error) {
    console.error("Failed to update game state:", error);
    throw error;
  }
}

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export interface LeaderboardEntry {
  rank: number;
  edition_id: string;
  newspaper_name: string;
  user_email: string;
  profit: number;
  readers: number;
  credibility: number;
  date: string;
}

export interface PublicPublishedItem {
  type: "article" | "ad";
  headline: string;
  body: string;
  variant?: "factual" | "sensationalist" | "propaganda";
  source?: string;
  location?: string;
}

export interface PublicEditionResponse {
  id: string;
  newspaper_name: string;
  date: string;
  published_at: string;
  stats: { cash?: number; credibility?: number; readers?: number };
  published_items: PublicPublishedItem[];
}

/**
 * Get recent transactions derived from published editions
 */
export async function getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
  try {
    // Get token from PocketBase auth store
    const { getPocketBase } = await import("@/lib/pocketbase");
    const pb = getPocketBase();
    const token = pb.authStore.token;

    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = getActualApiUrl(`/api/published-editions/transactions/recent?limit=${limit}`);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "omit",
    });

    if (!response.ok) {
      // If error, return empty array
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    // Return empty array on error
    return [];
  }
}

/**
 * Get the leaderboard (top 5 newspapers by profit from latest day).
 * Public endpoint - no authentication required.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const url = getActualApiUrl("/api/published-editions/leaderboard");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch leaderboard (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    // Return empty array on error
    return [];
  }
}

/**
 * Public endpoint to view a published edition by id (read-only).
 */
export async function getPublicPublishedEdition(editionId: string): Promise<PublicEditionResponse> {
  const url = getActualApiUrl(`/api/published-editions/public/${editionId}`);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    credentials: "omit",
    mode: "cors",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch edition (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Request a password reset email for the given address.
 * Always reports success (server-side also hides whether email exists).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    const url = getActualApiUrl("/api/auth/request-password-reset");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email }),
      credentials: "omit",
      mode: "cors",
    });

    // We don't care about status details; backend always returns success semantics
    // but we still log unexpected non-2xx responses.
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      console.warn("requestPasswordReset non-OK response:", response.status, text);
    }
  } catch (error) {
    console.error("Failed to request password reset:", error);
    // Don't throw to avoid leaking implementation details to the user;
    // frontend will just show a generic "check your email" message.
  }
}

/**
 * Confirm a password reset using a token from the email link.
 */
export async function confirmPasswordReset(token: string, password: string, passwordConfirm: string): Promise<void> {
  const url = getActualApiUrl("/api/auth/confirm-password-reset");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      token,
      password,
      password_confirm: passwordConfirm,
    }),
    credentials: "omit",
    mode: "cors",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to reset password (${response.status}): ${text}`);
  }
}
