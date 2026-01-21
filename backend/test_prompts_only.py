#!/usr/bin/env python3
"""
Test script to generate image prompts for example scoops.
This shows what prompts will be sent to Stable Diffusion.
"""
import sys
import os

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

def main():
    print("=" * 80)
    print("Image Prompt Generation Test")
    print("=" * 80)
    
    # Check Ollama
    print("\n🔍 Checking Ollama...")
    if not AIService.check_ollama_available():
        print("❌ Ollama is not available. Please start Ollama first.")
        return
    print("✅ Ollama is available\n")
    
    print("=" * 80)
    print("Generating Image Prompts for Example Scoops")
    print("=" * 80)
    
    for i, scoop in enumerate(EXAMPLE_SCOOPS, 1):
        print(f"\n{'='*80}")
        print(f"Scoop {i}: {scoop['title']}")
        print(f"Location: {scoop['location']}")
        print(f"{'='*80}")
        
        # Generate image prompt using Ollama
        try:
            print("\n🤖 Generating prompt with Ollama...")
            image_prompt = AIService.generate_image_prompt(
                article_title=scoop['title'],
                article_text=scoop['text'],
                variant="factual",
                location=scoop['location'] if scoop['location'] != "Global" else None
            )
            
            print(f"\n📝 Generated Prompt:")
            print(f"   {image_prompt}")
            
            # Show what will be sent to Stable Diffusion
            enhanced_prompt = (
                f"{image_prompt}, "
                "vintage newspaper photograph, black and white, grainy texture, "
                "high contrast, 1920s-1950s style, photojournalism, "
                "dramatic lighting, film noir aesthetic"
            )
            
            print(f"\n🎨 Full Prompt (with style):")
            print(f"   {enhanced_prompt}")
            
        except Exception as e:
            print(f"❌ Error generating prompt: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print(f"\n{'='*80}")
    print("Summary")
    print("=" * 80)
    print("✅ Prompts generated successfully!")
    print("\n💡 Next steps:")
    print("   1. Start Stable Diffusion: ./webui.sh --api --listen")
    print("   2. Run: python test_image_generation.py")
    print("   3. Check the generated images in backend/test_images/")

if __name__ == "__main__":
    main()

