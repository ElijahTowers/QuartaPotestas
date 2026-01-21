# Image Generation Implementation

## Overview

The application now generates images automatically for each news article (scoop) using a two-stage process:
1. **Ollama** generates a visual prompt from the article text
2. **Stable Diffusion** (local) generates the actual image

## Setup Required

### 1. Install Stable Diffusion

Follow the guide in `backend/STABLE_DIFFUSION_SETUP.md` to set up Stable Diffusion WebUI with API enabled.

### 2. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

New dependencies added:
- `requests` - For API calls to Stable Diffusion
- `Pillow` - For image processing

### 3. Database Migration

The Article model now includes:
- `image_url` - Path to the generated image file
- `image_prompt` - The prompt used for image generation

Run a migration or recreate the database to add these fields.

### 4. Environment Variables (Optional)

```bash
STABLE_DIFFUSION_URL=http://127.0.0.1:7860
```

Defaults to `http://127.0.0.1:7860` if not set.

## How It Works

### Workflow

1. **Article Ingestion** (`ingestion_service.py`):
   - Fetches articles from RSS feed
   - Processes text with Ollama (existing functionality)
   - Creates article in database
   - Generates image prompt using Ollama
   - Generates image using Stable Diffusion
   - Saves image to `backend/app/static/images/`
   - Updates article with image URL

2. **Image Generation** (`ai_service.py`):
   - `generate_image_prompt()`: Uses Ollama to create a visual description
   - `generate_image()`: Calls Stable Diffusion API to generate the image
   - Images are styled as "vintage newspaper photographs" (black & white, grainy, 1920s-1950s)

3. **Image Storage** (`ingestion_service.py`):
   - Images saved as `article_{id}.png`
   - Served via FastAPI static file mount at `/static/images/`

## API Changes

### Article Response

Articles now include:
```json
{
  "id": 1,
  "original_title": "...",
  "image_url": "/static/images/article_1.png",
  "image_prompt": "A vintage newspaper photograph of...",
  ...
}
```

### Frontend Types

Updated `frontend/types/api.ts` to include:
- `image_url?: string | null`
- `image_prompt?: string | null`

## Usage

### Automatic Generation

Images are generated automatically when you:
- Fetch new scoops via `/api/articles/reset-and-ingest`
- Process new articles through the ingestion service

### Manual Testing

You can test image generation:

```python
from app.services.ai_service import AIService

# Generate prompt
prompt = AIService.generate_image_prompt(
    article_title="Breaking News",
    article_text="Article content here...",
    variant="factual",
    location="New York"
)

# Generate image
image_base64 = AIService.generate_image(prompt)

# Check if Stable Diffusion is available
is_available = AIService.check_stable_diffusion_available()
```

## Displaying Images in Frontend

### Example: Wire Component

```tsx
{article.image_url && (
  <img 
    src={`http://localhost:8000${article.image_url}`}
    alt={article.original_title}
    className="w-full h-32 object-cover"
  />
)}
```

### Example: Newspaper Layout

```tsx
{article.image_url && (
  <img 
    src={`http://localhost:8000${article.image_url}`}
    alt={headline}
    className="w-full mb-4"
  />
)}
```

## Performance Considerations

- **Image Generation Time**: 10-30 seconds per image (GPU) or 2-5 minutes (CPU)
- **Storage**: ~500KB per image (512x512 PNG)
- **Processing**: Images are generated synchronously during ingestion (may slow down bulk processing)

### Optimization Options

1. **Async Processing**: Move image generation to background job
2. **Caching**: Only generate images for new articles
3. **Batch Processing**: Generate images in parallel
4. **Lazy Loading**: Generate images on-demand when article is viewed

## Troubleshooting

### Images Not Generating

1. Check Stable Diffusion is running:
   ```bash
   curl http://127.0.0.1:7860/sdapi/v1/options
   ```

2. Check backend logs for errors

3. Verify image directory exists and is writable:
   ```bash
   ls -la backend/app/static/images/
   ```

### Images Not Displaying

1. Check image URL is correct
2. Verify FastAPI static file mount is working
3. Check CORS settings if accessing from frontend
4. Verify image file exists on disk

## Future Enhancements

- [ ] Async image generation (background jobs)
- [ ] Image variants per article variant (factual/sensationalist/propaganda)
- [ ] Image caching and optimization
- [ ] Thumbnail generation
- [ ] Image regeneration on demand
- [ ] Support for multiple image generation backends

