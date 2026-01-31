/**
 * API types matching the FastAPI backend models
 */

export interface AudienceScores {
  elite: number;
  working_class: number;
  patriots: number;
  syndicate: number;
  technocrats: number;
  faithful: number;
  resistance: number;
  doomers: number;
}

// Audience scores per variant
export interface AudienceScoresPerVariant {
  factual: AudienceScores;
  sensationalist: AudienceScores;
  propaganda: AudienceScores;
}

export interface Article {
  id: string; // Changed from number to string (PocketBase ID)
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
  assistant_comment?: string; // Short commentary from the editor
  audience_scores?: AudienceScoresPerVariant; // Faction reaction scores per variant (-10 to +10)
}

export interface DailyEdition {
  id: number;
  date: string;
  global_mood: string | null;
  articles: Article[];
}

