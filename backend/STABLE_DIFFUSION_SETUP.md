# Stable Diffusion Setup Guide

This guide explains how to set up Stable Diffusion for local image generation with your newspaper application.

## Prerequisites

- Python 3.10+
- NVIDIA GPU with at least 4GB VRAM (recommended) or CPU (slower)
- 10GB+ free disk space

## Installation Steps

### Option 1: Automatic1111 WebUI (Recommended)

1. **Install Automatic1111 WebUI:**
   ```bash
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
   cd stable-diffusion-webui
   ```

2. **Install dependencies:**
   ```bash
   # On macOS/Linux:
   ./webui.sh --api
   
   # On Windows:
   webui.bat --api
   ```

3. **Download a model:**
   - Go to https://huggingface.co/models?pipeline_tag=text-to-image
   - Recommended: `runwayml/stable-diffusion-v1-5` or `stabilityai/stable-diffusion-2-1`
   - Download the `.safetensors` file
   - Place it in `stable-diffusion-webui/models/Stable-diffusion/`

4. **Start the WebUI with API enabled:**
   ```bash
   ./webui.sh --api --listen
   ```
   
   The API will be available at `http://127.0.0.1:7860`

### Option 2: ComfyUI (Alternative)

1. **Install ComfyUI:**
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   pip install -r requirements.txt
   ```

2. **Start ComfyUI with API:**
   ```bash
   python main.py --listen 127.0.0.1 --port 8188
   ```

   Note: ComfyUI uses a different API endpoint, so you'll need to adjust the URL in your configuration.

## Configuration

### Environment Variable

Set the Stable Diffusion URL in your `.env` file:

```bash
STABLE_DIFFUSION_URL=http://127.0.0.1:7860
```

Or use the default (localhost:7860).

### Testing the Connection

You can test if Stable Diffusion is running:

```bash
curl http://127.0.0.1:7860/sdapi/v1/options
```

If it returns JSON, you're good to go!

## Usage

Once Stable Diffusion is running, the image generation will happen automatically when you:

1. Fetch new scoops via the `/api/articles/reset-and-ingest` endpoint
2. Articles will be processed with Ollama (text generation)
3. Images will be generated using Stable Diffusion
4. Images will be saved to `backend/app/static/images/`

## Troubleshooting

### "Could not connect to Stable Diffusion"
- Make sure Stable Diffusion WebUI is running
- Check that the `--api` flag is enabled
- Verify the URL in your `.env` file matches the running instance

### "Out of memory" errors
- Use a smaller model (e.g., SD 1.5 instead of SD 2.1)
- Reduce image size in `ai_service.py` (change width/height to 384x384)
- Close other GPU-intensive applications

### Images not appearing
- Check that the `static/images/` directory exists and is writable
- Verify file permissions
- Check backend logs for error messages

## Performance Tips

- **GPU**: Much faster (10-30 seconds per image)
- **CPU**: Slower (2-5 minutes per image) but works without GPU
- **Batch processing**: Consider generating images asynchronously in a background job
- **Caching**: Images are saved to disk, so they're only generated once per article

## Alternative: Use Cloud API

If local generation is too slow or resource-intensive, you can use cloud APIs:
- Stability AI API
- Replicate API
- Hugging Face Inference API

Just update the `generate_image` method in `ai_service.py` to use the cloud API instead.

