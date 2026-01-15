/**
 * API types matching the FastAPI backend models
 */

export interface Article {
  id: number;
  original_title: string;
  processed_variants: {
    factual: string;
    sensationalist: string;
    propaganda: string;
  };
  tags: {
    topic_tags: string[];
    sentiment: string;
  };
  location_lat: number | null;
  location_lon: number | null;
  location_city: string | null;
  date: string;
  published_at: string | null;
}

export interface DailyEdition {
  id: number;
  date: string;
  global_mood: string | null;
  articles: Article[];
}

