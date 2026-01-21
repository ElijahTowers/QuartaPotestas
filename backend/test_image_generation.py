#!/usr/bin/env python3
"""
Test script to generate example images for existing scoops.
This will help you see what the image generation produces before integrating it fully.
"""
import sys
import os
import requests
import base64
from pathlib import Path
from PIL import Image
from io import BytesIO

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.services.ai_service import AIService

# Example scoops to test with
EXAMPLE_SCOOPS = [
    {
        "title": "Swiss deadly fire bar owners' lawyers condemn 'vindictiveness'",
        "text": "Lawyers representing bar owners involved in a deadly fire in Switzerland have condemned what they call vindictive prosecution. The case has drawn international attention as authorities investigate the circumstances that led to multiple fatalities.",
        "location": "Switzerland"
    },
    {
        "title": "Japanese Prime Minister Takaichi calls an early election",
        "text": "In a surprising move, Japanese Prime Minister Takaichi has announced an early general election. Political analysts are scrambling to understand the timing and potential implications for the country's future direction.",
        "location": "Japan"
    },
    {
        "title": "Tech Giant Announces Revolutionary AI Breakthrough",
        "text": "A major technology corporation has unveiled what it claims to be the most advanced artificial intelligence system ever created. The new system can process information at unprecedented speeds and make decisions with human-like intuition.",
        "location": "San Francisco"
    },
    {
        "title": "Climate Summit Ends with Historic Agreement",
        "text": "After weeks of intense negotiations, delegates from over 190 countries reached a landmark agreement on carbon emissions. The new framework sets ambitious targets for the next decade in the fight against climate change.",
        "location": "Geneva"
    },
    {
        "title": "World Leaders Gather in Secret Summit",
        "text": "World leaders from across the globe convened in an undisclosed location to discuss the future of international relations. The meeting, which lasted over 12 hours, covered topics ranging from economic policy to climate change mitigation.",
        "location": "Global"
    }
]

def check_stable_diffusion():
    """Check if Stable Diffusion is running."""
    url = os.getenv("STABLE_DIFFUSION_URL", "http://127.0.0.1:7860")
    try:
        response = requests.get(f"{url}/sdapi/v1/options", timeout=5)
        if response.status_code == 200:
            print(f"✅ Stable Diffusion is running at {url}")
            return True
        else:
            print(f"❌ Stable Diffusion returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to Stable Diffusion at {url}")
        print("   Make sure Stable Diffusion WebUI is running with --api flag:")
        print("   ./webui.sh --api --listen")
        return False
    except Exception as e:
        print(f"❌ Error checking Stable Diffusion: {e}")
        return False

def generate_and_save_image(prompt, title, output_dir, index):
    """Generate image and save it."""
    url = os.getenv("STABLE_DIFFUSION_URL", "http://127.0.0.1:7860")
    
    enhanced_prompt = (
        f"{prompt}, "
        "vintage newspaper photograph, black and white, grainy texture, "
        "high contrast, 1920s-1950s style, photojournalism, "
        "dramatic lighting, film noir aesthetic"
    )
    
    negative_prompt = (
        "color, modern, digital, clean, smooth, "
        "high resolution, sharp, colorful, contemporary, "
        "cartoon, illustration, drawing, painting"
    )
    
    payload = {
        "prompt": enhanced_prompt,
        "negative_prompt": negative_prompt,
        "steps": 25,
        "width": 512,
        "height": 512,
        "cfg_scale": 7,
        "sampler_name": "Euler a",
        "seed": -1,
    }
    
    print(f"\n🖼️  Generating image {index + 1}/5: {title[:50]}...")
    print(f"   Prompt: {prompt[:80]}...")
    
    try:
        response = requests.post(
            f"{url}/sdapi/v1/txt2img",
            json=payload,
            timeout=120  # 2 minutes timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("images") and len(result["images"]) > 0:
                # Decode and save image
                image_data = base64.b64decode(result["images"][0])
                image = Image.open(BytesIO(image_data))
                
                # Create safe filename
                safe_title = "".join(c for c in title[:40] if c.isalnum() or c in (' ', '-', '_')).strip()
                safe_title = safe_title.replace(' ', '_')
                filename = f"test_{index + 1:02d}_{safe_title}.png"
                filepath = output_dir / filename
                
                image.save(filepath, "PNG")
                print(f"   ✅ Saved: {filepath}")
                return str(filepath)
            else:
                print(f"   ❌ No images returned")
                return None
        else:
            print(f"   ❌ API error: {response.status_code} - {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def main():
    print("=" * 70)
    print("Stable Diffusion Image Generation Test")
    print("=" * 70)
    
    # Check Stable Diffusion
    if not check_stable_diffusion():
        print("\n❌ Please start Stable Diffusion first!")
        return
    
    # Check Ollama
    print("\n🔍 Checking Ollama...")
    if not AIService.check_ollama_available():
        print("❌ Ollama is not available. Please start Ollama first.")
        return
    print("✅ Ollama is available")
    
    # Create output directory
    output_dir = Path(__file__).parent / "test_images"
    output_dir.mkdir(exist_ok=True)
    print(f"\n📁 Output directory: {output_dir}")
    
    # Process each scoop
    print("\n" + "=" * 70)
    print("Generating Images for Example Scoops")
    print("=" * 70)
    
    results = []
    
    for i, scoop in enumerate(EXAMPLE_SCOOPS):
        print(f"\n📰 Scoop {i + 1}: {scoop['title']}")
        print(f"   Location: {scoop['location']}")
        
        # Generate image prompt using Ollama
        try:
            image_prompt = AIService.generate_image_prompt(
                article_title=scoop['title'],
                article_text=scoop['text'],
                variant="factual",
                location=scoop['location'] if scoop['location'] != "Global" else None
            )
            print(f"   Generated prompt: {image_prompt[:100]}...")
        except Exception as e:
            print(f"   ❌ Error generating prompt: {e}")
            continue
        
        # Generate and save image
        image_path = generate_and_save_image(
            prompt=image_prompt,
            title=scoop['title'],
            output_dir=output_dir,
            index=i
        )
        
        if image_path:
            results.append({
                "scoop": scoop['title'],
                "image": image_path,
                "prompt": image_prompt
            })
    
    # Summary
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    print(f"✅ Successfully generated {len(results)}/{len(EXAMPLE_SCOOPS)} images")
    print(f"📁 Images saved in: {output_dir}")
    print("\nGenerated images:")
    for i, result in enumerate(results, 1):
        print(f"  {i}. {result['scoop'][:60]}...")
        print(f"     → {result['image']}")
    
    print("\n💡 Tip: Open the images to see if they match the vintage newspaper style!")
    print("   If they look good, the integration is ready to use.")

if __name__ == "__main__":
    main()

