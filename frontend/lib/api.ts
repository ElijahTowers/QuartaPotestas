/**
 * API client for FastAPI backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/articles/today`);

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

export async function fetchLatestArticles(): Promise<import("@/types/api").DailyEdition> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/articles/latest`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch articles (${response.status}): ${errorText}`);
  }

  return response.json();
}

export interface Ad {
  id: number;
  company: string;
  tagline: string;
  description: string;
  tags: string[];
}

export async function fetchAds(): Promise<Ad[]> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/ads/`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch ads (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.ads || [];
}

export interface GridPlacement {
  articleId: number | null;
  variant: "factual" | "sensationalist" | "propaganda" | null;
  isAd: boolean;
  adId: number | null;
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
    const response = await fetch(`${API_BASE_URL}/api/submissions/submit`, {
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
    const response = await fetch(`${API_BASE_URL}/api/debug/trigger-ingest`, {
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
  try {
    const response = await fetch(`${API_BASE_URL}/api/debug/reset-and-ingest`, {
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
      throw new Error(`Failed to reset and ingest (${response.status}): ${errorText}`);
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
  id: number;
}

export async function publish(
  stats: PublishStats,
  placedItems: GridPlacement[]
): Promise<PublishResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      mode: "cors",
      body: JSON.stringify({
        stats,
        placedItems,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to publish (${response.status}): ${errorText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      const errorMsg = error.message.includes("Failed to fetch")
        ? `Cannot connect to backend at ${API_BASE_URL}. Please ensure:\n1. Backend is running (uvicorn app.main:app --reload)\n2. Backend is accessible on port 8000\n3. No firewall is blocking the connection`
        : `Network error: ${error.message}`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export interface EditionData {
  id: number;
  published_at: string;
  stats: {
    cash: number;
    credibility: number;
    readers: number;
  };
  placedItems: GridPlacement[];
}

export async function fetchEdition(editionId: number): Promise<EditionData> {
  try {
    const response = await fetch(`${API_BASE_URL}/edition/${editionId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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

