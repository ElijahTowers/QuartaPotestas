# 🌍 Global Influence Map Implementation

## Overview
This implementation adds a **Global Influence Map** where countries light up based on the number of articles the user has published about them. The map uses a choropleth visualization with a "dystopian" color scheme.

---

## PART 1: Backend Changes ✅

### 1. **Updated AI Service** (`backend/app/services/ai_service.py`)

**New Method:** `extract_country_code(title, content, model)`
- Extracts ISO 3166-1 alpha-2 country code from article content
- Uses Ollama to intelligently identify the primary country
- Returns codes like "US", "NL", "JP", "GB", "GLOBAL", or "XX" (unknown)

**Updated Method:** `generate_article_variants(title, content, model)`
- Now includes `country_code` in the returned dictionary
- Country code is extracted as part of the AI generation process
- Fallback value: "XX" if extraction fails

### 2. **Updated Ingestion Service** (`backend/app/services/ingestion_service_pb.py`)

**Changes:**
- Extracts `country_code` from AI result
- Saves `country_code` to PocketBase articles table
- Field name: `country_code` (text field, ISO 3166-1 alpha-2 format)

---

## PART 2: Frontend Changes ✅

### 1. **New Component:** `InfluenceLayer.tsx`

**Location:** `frontend/components/map/InfluenceLayer.tsx`

**Features:**
- Fetches world GeoJSON from GitHub (Johan/world.geo.json)
- Queries all articles from PocketBase
- Aggregates articles by country_code
- Renders choropleth map overlay

**Color Scale (Dystopian Theme):**
| Articles | Color | Meaning |
|----------|-------|---------|
| 0 | `transparent` | No influence |
| 1-2 | `#e6d5ac` | Faint Sepia/Paper |
| 3-5 | `#d4a373` | Rust/Orange |
| 6-10 | `#a44a3f` | Dark Red |
| 11+ | `#2f2f2f` | Deep Black/Charcoal (Total Control) |

**Interactivity:**
- Hover over countries to see popup: `"{CountryName}: {X} Articles"`
- Popups show on hover, close on mouseout
- Opacity increases on hover for better visibility

### 2. **Updated Map Component** (`frontend/components/Map.tsx`)

**Changes:**
- Import `InfluenceLayer`
- Add `<InfluenceLayer />` inside `<MapContainer>`
- Renders after tile layer but before markers

---

## Database Schema

### PocketBase `articles` Collection
**New Field:**
- `country_code` (text, required)
  - ISO 3166-1 alpha-2 format (e.g., "US", "NL", "JP")
  - "GLOBAL" for worldwide articles
  - "XX" for unknown

---

## Data Flow

```
1. RSS Article Fetched
   ↓
2. Ollama AI generates variants + country_code
   ↓
3. Ingestion Service saves to PocketBase with country_code
   ↓
4. Frontend fetches articles from PocketBase
   ↓
5. InfluenceLayer aggregates by country_code
   ↓
6. Choropleth renders with color scale
   ↓
7. Map dynamically updates as new articles are published
```

---

## Usage

### Admin Adding New Articles
1. Run ingestion (automatic or via refresh button)
2. Ollama processes each article and extracts country code
3. PocketBase records updated with `country_code`
4. Map automatically updates to show influence

### Viewing the Map
1. Navigate to Map page
2. See countries colored by publication intensity
3. Hover to see article count
4. Watch the map evolve as new scoops are published

---

## Testing Checklist

- [ ] Backend: Verify country codes are extracted correctly in Ollama prompts
- [ ] Backend: Check PocketBase articles table has `country_code` field
- [ ] Frontend: GeoJSON loads successfully (check console)
- [ ] Frontend: Countries render with correct colors
- [ ] Frontend: Hover popups display correctly
- [ ] Frontend: Map updates dynamically when articles are published
- [ ] Edge cases: "GLOBAL" articles, unknown locations (XX)

---

## Future Enhancements

- Add legend to map
- Add statistics panel (total countries, top 5 countries)
- Add animation for new articles
- Add export/analytics
- Add per-variant country breakdown
- Add time-based heat map (evolution over days/weeks)

---

## Technical Notes

- **GeoJSON Source:** Uses low-resolution world borders for performance
- **PocketBase Queries:** Fetches full records with `country_code` field
- **Color Matching:** GeoJSON feature `ISO_A2` or `iso_a2` property matched to `country_code`
- **Performance:** GeoJSON render is optimized for 200+ countries

