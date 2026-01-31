"""
AI Service for interacting with Ollama to generate article variants and extract metadata.
"""
import ollama
from typing import Dict, Any, List
import json
import re


class AIService:
    """Service for processing articles through Ollama LLM."""
    
    DEFAULT_MODEL = "llama3"  # Default Ollama model
    
    @staticmethod
    def simplify_english(text: str, model: str = None, max_words: int = None) -> str:
        """
        Simplify English text to make it easier to read.
        
        Args:
            text: Original text to simplify
            model: Ollama model name (defaults to DEFAULT_MODEL)
            max_words: Maximum number of words (optional, used for titles/headlines)
            
        Returns:
            Simplified English text
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        word_limit_instruction = ""
        if max_words:
            word_limit_instruction = f"""
CRITICAL WORD LIMIT: You are creating a HEADLINE/TITLE. The output MUST be EXACTLY {max_words} words or fewer. 
Count your words carefully. This is a headline, not a full sentence - be concise and impactful.
If the original text is longer, create a shorter headline version that captures the essence in {max_words} words or less.
DO NOT exceed {max_words} words. If you do, your response is invalid."""
        
        prompt = f"""Rewrite the following text in simpler, easier-to-understand English. 
Keep the meaning and key facts the same, but use simpler words and shorter sentences.
Make it accessible for readers with a basic understanding of English.

CRITICAL: You MUST preserve ALL geographical information:
- Country names (e.g., "Swiss", "Switzerland", "American", "French", "German")
- City names (e.g., "London", "Tokyo", "New York")
- Region names (e.g., "European", "Asian", "Middle Eastern")
- Continent names (e.g., "Africa", "Asia", "Europe")
- Language-related terms (e.g., "English", "Spanish", "Arabic")
- Nationality terms (e.g., "Swiss", "American", "British")

Do NOT remove or simplify these terms. Keep them exactly as they appear.
Do NOT add quotation marks or quotes around the text. Return the text directly without surrounding quotes.{word_limit_instruction}
ONLY return the simplified text, nothing else. No explanations, no notes, no quotes, just the simplified text.

Original text:
{text}

Simplified text:"""
        
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are a skilled editor who rewrites text in simpler, clearer English. You maintain the original meaning while making it easier to understand. You ALWAYS preserve geographical information like country names, city names, regions, continents, languages, and nationalities exactly as they appear in the original text.{" When creating headlines or titles, you MUST strictly adhere to word limits and count your words carefully." if max_words else ""}"""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Handle different response formats
            if isinstance(response, dict):
                result_text = response.get("message", {}).get("content", "")
                if not result_text:
                    result_text = response.get("response", "")
            else:
                result_text = str(response)
            
            # Clean up: remove any explanatory notes or prefixes
            result_text = result_text.strip()
            # Remove common prefixes like "Here is the rewritten text:" or "Simplified text:"
            prefixes = [
                "Here is the rewritten text:",
                "Simplified text:",
                "Here's the simplified version:",
                "Simplified version:"
            ]
            for prefix in prefixes:
                if result_text.lower().startswith(prefix.lower()):
                    result_text = result_text[len(prefix):].strip()
            
            # Remove notes in parentheses at the end
            if "(Note:" in result_text or "(note:" in result_text:
                result_text = result_text.split("(Note:")[0].strip()
                result_text = result_text.split("(note:")[0].strip()
            
            # Remove surrounding quotes (both single and double quotes)
            result_text = result_text.strip()
            if result_text.startswith('"') and result_text.endswith('"'):
                result_text = result_text[1:-1].strip()
            if result_text.startswith("'") and result_text.endswith("'"):
                result_text = result_text[1:-1].strip()
            
            result_text = result_text.strip()
            
            # If max_words is specified, verify the word count
            # Ollama should have respected the limit, but we verify as a safety check
            if max_words:
                words = result_text.split()
                word_count = len(words)
                
                # Only truncate if significantly over limit (more than 2 words over)
                # This is a safety net - Ollama should have already respected the limit
                if word_count > max_words + 2:
                    print(f"Warning: Ollama generated {word_count} words (limit: {max_words}), truncating as safety measure")
                    result_text = " ".join(words[:max_words])
                elif word_count > max_words:
                    # Slightly over - give a warning but don't truncate (might break important info)
                    print(f"Warning: Ollama generated {word_count} words (limit: {max_words}), but keeping full text to preserve information")
            
            return result_text
        except Exception as e:
            print(f"Error simplifying text with Ollama: {e}")
            return text  # Return original text if simplification fails
    
    @staticmethod
    def extract_location(title: str, content: str, model: str = None) -> str:
        """
        Extract the primary location (city) from an article using Ollama.
        
        Args:
            title: Article title
            content: Article content/summary
            model: Ollama model name (defaults to DEFAULT_MODEL)
            
        Returns:
            City name or "Unknown" if no location can be determined
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        prompt = f"""Read the following news article and identify the PRIMARY city, region, or location mentioned.
Return ONLY the location name (e.g., "London", "Washington", "Tokyo", "Greenland", "Arctic").
If a region or territory is mentioned (like "Greenland", "Arctic"), return that name.
If the article is about global/worldwide topics (mentions "global", "worldwide", "world", "international", "everywhere"), return "Global".
If no specific city or location is mentioned, return "Unknown".
Do not include country names unless the city name itself includes it (e.g., "New York" not "New York, USA").
Return only the location name, nothing else.

Article Title: {title}
Article Content: {content}

Primary location:"""
        
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a location extraction tool. You identify the primary city mentioned in news articles. Return only the city name or 'Unknown'."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Handle different response formats
            if isinstance(response, dict):
                result_text = response.get("message", {}).get("content", "")
                if not result_text:
                    result_text = response.get("response", "")
            else:
                result_text = str(response)
            
            # Clean up the result
            location = result_text.strip()
            # Remove any explanatory text
            if "\n" in location:
                location = location.split("\n")[0].strip()
            # Remove common prefixes/suffixes
            location = location.replace("Primary city:", "").strip()
            location = location.replace("City:", "").strip()
            location = location.replace('"', '').strip()
            
            # Return "Unknown" if empty or if it contains "unknown" (case insensitive)
            if not location or location.lower() == "unknown" or "cannot determine" in location.lower():
                return "Unknown"
            
            return location
        except Exception as e:
            print(f"Error extracting location with Ollama: {e}")
            return "Unknown"
    
    @staticmethod
    def extract_country(title: str, content: str, model: str = None) -> str:
        """
        Extract the country mentioned in an article using Ollama.
        
        Args:
            title: Article title
            content: Article content/summary
            model: Ollama model name (defaults to DEFAULT_MODEL)
            
        Returns:
            Country name (e.g., "United States", "United Kingdom", "France") or "Unknown" if none found
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        prompt = f"""Read the following news article and identify the PRIMARY country or region mentioned or implied.
Return ONLY the country/region name (e.g., "United States", "United Kingdom", "France", "China", "Russia", "Greenland", "Iceland").
If the article mentions a nationality (like "American", "British", "French", "Greenlander"), return the corresponding country name.
If the article mentions a region or territory (like "Greenland", "Arctic"), return that region name.
If the article is about global/worldwide topics (mentions "global", "worldwide", "world", "international", "everywhere"), return "Global".
If no country or region is clearly mentioned or implied, return "Unknown".
Return only the country/region name, nothing else.

Article Title: {title}
Article Content: {content}

Primary country/region:"""
        
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a location extraction tool. You identify the primary country mentioned in news articles. Return only the country name or 'Unknown'."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Handle different response formats
            if isinstance(response, dict):
                result_text = response.get("message", {}).get("content", "")
                if not result_text:
                    result_text = response.get("response", "")
            else:
                result_text = str(response)
            
            # Clean up the result
            country = result_text.strip()
            # Remove any explanatory text
            if "\n" in country:
                country = country.split("\n")[0].strip()
            # Remove common prefixes/suffixes
            country = country.replace("Primary country:", "").strip()
            country = country.replace("Country:", "").strip()
            country = country.replace('"', '').strip()
            
            # Return "Unknown" if empty or if it contains "unknown" (case insensitive)
            if not country or country.lower() == "unknown" or "cannot determine" in country.lower():
                return "Unknown"
            
            return country
        except Exception as e:
            print(f"Error extracting country with Ollama: {e}")
            return "Unknown"
    
    @staticmethod
    def generate_article_variants(
        title: str,
        content: str,
        model: str = None
    ) -> Dict[str, Any]:
        """
        Generate three variants (Factual, Sensationalist, Propaganda) and extract metadata.
        
        Args:
            title: Original article title
            content: Original article content/summary
            model: Ollama model name (defaults to DEFAULT_MODEL)
            
        Returns:
            Dictionary with processed_variants, tags, sentiment, location_city, country_code
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        prompt = f"""You are the Editor-in-Chief of a dystopian tabloid. You are cynical, profit-driven, and focused solely on circulation numbers and public impact. You view tragedy as opportunity and chaos as content.

Given the following news article, create THREE DISTINCTLY DIFFERENT variants of the same story.

CRITICAL REQUIREMENT: You MUST provide ALL THREE variants. The JSON response MUST contain exactly these keys: "factual", "sensationalist", "propaganda". Each variant must be 50-100 words.

IMPORTANT: Each variant MUST be UNIQUE and DIFFERENT from the others. They should have different wording, tone, and emphasis. DO NOT copy the same text for multiple variants.

1. FACTUAL: Write a dry, boring, objective news report. Just the facts. No emotion. Use neutral language. (50-100 words)
2. SENSATIONALIST: Write a fear-mongering, clickbait version. Make it dramatic and alarming. Use exclamation marks, urgent language, and emotional words like "shocking", "devastating", "terrifying". (50-100 words)
3. PROPAGANDA: Write a version that praises the government/institutions. Make it positive and supportive. Emphasize progress, success, and official responses. Use words like "authorities", "officials", "successful", "effective". (50-100 words)

Additionally, extract:
- TOPIC_TAGS: List of topic tags (e.g., ["WAR", "TECH", "ECONOMY", "POLITICS", "CLIMATE", "HEALTH"])
- SENTIMENT: Overall sentiment (positive/negative/neutral)
- LOCATION_CITY: The primary city mentioned in the article (or "Unknown" if none)
- COUNTRY_CODE: The ISO 3166-1 alpha-2 country code (e.g., "US", "NL", "JP", "GB", "GLOBAL", or "XX" if unknown)
- ASSISTANT_COMMENT: A short, cynical QUESTION (1 sentence, max 15 words) from your perspective as a profit-driven editor. You MUST read and understand the specific article content. Ask a relevant question that references specific details, people, places, or events mentioned in the article. The question should be cynical and focused on circulation/impact, NOT generic. Focus on: What angle will sell, who will be affected, what's the real story behind this, or what's the political/economic fallout. NEVER provide moral lessons, ethical guidance, or lectures on societal values. NEVER mention 'journalistic integrity', 'consent', or 'supporting victims' in a sincere way. Do NOT judge potential choices. Be cynical and focused on circulation.
- AUDIENCE_SCORES: Analyze how EACH VARIANT of this story will be received by 8 distinct factions. Each variant (factual, sensationalist, propaganda) will have DIFFERENT impacts on each faction. Assign a score from -10 to +10 for EACH faction for EACH variant based on how they would react to that specific variant. The 8 factions are:
  * elite: Wealthy, pro-business, anti-tax. They like: tax cuts, deregulation, corporate success, economic growth. They dislike: wealth redistribution, regulation, anti-business sentiment.
  * working_class: Pro-jobs, anti-automation, wants cheap entertainment. They like: job creation, worker rights, affordable goods, entertainment. They dislike: automation, job loss, expensive necessities, elitism.
  * patriots: Pro-military/police, anti-foreigner, loyal to the State. They like: military strength, law enforcement, national security, traditional values. They dislike: criticism of military/police, immigration, anti-government sentiment.
  * syndicate: Criminal underground, wants weak police and chaos. They like: police corruption, chaos, weak law enforcement, opportunities for crime. They dislike: strong police, law and order, crackdowns on crime.
  * technocrats: Pro-AI/Cyborgs, anti-tradition. They like: technological progress, AI advancement, innovation, efficiency. They dislike: anti-tech sentiment, tradition, luddite movements, regulation of tech.
  * faithful: Religious/Nature-loving, anti-tech, conservative. They like: religious values, nature conservation, tradition, moral stories. They dislike: tech advancement, secularism, environmental destruction, moral decay.
  * resistance: Anti-government, pro-truth/freedom. They like: government corruption exposed, truth, freedom, whistleblowing. They dislike: propaganda, government praise, censorship, authoritarianism.
  * doomers: Paranoid preppers, love bad news and collapse theories. They like: disasters, collapse scenarios, bad news, warnings of doom. They dislike: positive news, optimism, "everything is fine" narratives.
  
  IMPORTANT: Each variant will have different impacts:
  - FACTUAL: Neutral, objective reporting. Generally neutral scores, but some factions may prefer truth (resistance +, patriots - if critical).
  - SENSATIONALIST: Dramatic, fear-mongering. Doomers and syndicate may like it more (+), elite and technocrats may dislike it (-).
  - PROPAGANDA: Pro-government, positive spin. Patriots and elite may like it (+), resistance and doomers may strongly dislike it (-).
  
  Return an object with three keys (factual, sensationalist, propaganda), each containing an object with all 8 faction keys, each with an integer score from -10 to +10.

CRITICAL: The comment MUST be a QUESTION that references SPECIFIC details from the article (names, places, events, numbers, etc.). Do NOT use generic questions like "Will this sell?" or "What's the angle here?" - make it specific to THIS article.

Examples of GOOD comments (specific questions referencing article details):
- "How many casualties before this becomes front page?"
- "Will the CEO's resignation tank their stock price?"
- "Which politician is going to spin this as a win?"
- "Can we get photos of the crash site before the cleanup?"
- "What's the real reason they're pulling out of the deal?"

Examples of BAD comments (DO NOT USE - too generic):
- "This scandal will sell well in the suburbs."
- "Blood leads. Print it."
- "What's the angle here?"
- "Will this sell papers?"
- "It is important to respect the victims."

Article Title: {title}
Article Content: {content}

Respond ONLY with valid JSON. The JSON object MUST have exactly these keys:
{{
    "factual": "50-100 word factual version...",
    "sensationalist": "50-100 word sensationalist version...",
    "propaganda": "50-100 word propaganda version...",
    "tags": ["TAG1", "TAG2"],
    "sentiment": "positive|negative|neutral",
    "location_city": "City Name",
    "country_code": "XX",
    "assistant_comment": "One cynical QUESTION (max 15 words) referencing specific article details, focused on profit/circulation/impact",
    "audience_scores": {{
        "factual": {{
            "elite": 0,
            "working_class": 0,
            "patriots": 0,
            "syndicate": 0,
            "technocrats": 0,
            "faithful": 0,
            "resistance": 0,
            "doomers": 0
        }},
        "sensationalist": {{
            "elite": 0,
            "working_class": 0,
            "patriots": 0,
            "syndicate": 0,
            "technocrats": 0,
            "faithful": 0,
            "resistance": 0,
            "doomers": 0
        }},
        "propaganda": {{
            "elite": 0,
            "working_class": 0,
            "patriots": 0,
            "syndicate": 0,
            "technocrats": 0,
            "faithful": 0,
            "resistance": 0,
            "doomers": 0
        }}
    }}
}}"""
        
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are the Editor-in-Chief of a dystopian tabloid. You are cynical, profit-driven, and focused solely on circulation numbers and public impact. You view tragedy as opportunity and chaos as content. You MUST respond with valid JSON only. Do not include any text before or after the JSON object. The JSON must be properly formatted with all strings in double quotes. The JSON MUST contain exactly these keys: 'factual', 'sensationalist', 'propaganda', 'tags', 'sentiment', 'location_city', 'country_code', 'assistant_comment', 'audience_scores'. CRITICAL: All three variant keys (factual, sensationalist, propaganda) are REQUIRED and must be UNIQUE and DIFFERENT from each other. Each variant must have different wording, tone, and emphasis. DO NOT copy the same text for multiple variants. The 'assistant_comment' must be ONE short cynical QUESTION (max 15 words) that references SPECIFIC details from the article (names, places, events, numbers). It must be relevant to THIS specific article, not generic. Focus on circulation, political fallout, or what angle will sell. NEVER provide moral lessons, ethical guidance, or mention 'journalistic integrity' or 'supporting victims' sincerely. Be cynical and profit-focused. The 'audience_scores' must be an object with three keys: 'factual', 'sensationalist', 'propaganda'. Each variant key must contain an object with all 8 faction keys: 'elite', 'working_class', 'patriots', 'syndicate', 'technocrats', 'faithful', 'resistance', 'doomers'. Each faction value must be an integer from -10 to +10 representing how that faction would react to that specific variant of the story."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Handle different response formats
            if isinstance(response, dict):
                result_text = response.get("message", {}).get("content", "")
                if not result_text:
                    result_text = response.get("response", "")
            else:
                result_text = str(response)
            
            # Clean the response text - remove markdown code blocks if present
            result_text = result_text.strip()
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            elif result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()
            
            # Try multiple strategies to extract JSON
            result = None
            json_errors = []
            
            # Strategy 1: Try to find JSON object with regex (improved to handle nested objects)
            # Match from first { to last } (handling nested braces)
            brace_count = 0
            start_idx = result_text.find('{')
            if start_idx != -1:
                end_idx = start_idx
                for i in range(start_idx, len(result_text)):
                    if result_text[i] == '{':
                        brace_count += 1
                    elif result_text[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = i + 1
                            break
                if end_idx > start_idx:
                    json_str = result_text[start_idx:end_idx]
                    try:
                        result = json.loads(json_str)
                    except json.JSONDecodeError as e:
                        json_errors.append(f"Brace matching failed: {e}")
            
            # Fallback: Try original regex approach
            if result is None:
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', result_text, re.DOTALL)
                if json_match:
                    try:
                        result = json.loads(json_match.group())
                    except json.JSONDecodeError as e:
                        json_errors.append(f"Regex match failed: {e}")
            
            # Strategy 2: Try parsing the whole response
            if result is None:
                try:
                    result = json.loads(result_text)
                except json.JSONDecodeError as e:
                    json_errors.append(f"Full parse failed: {e}")
            
            # Strategy 3: Try to fix common JSON issues
            if result is None:
                try:
                    # Fix common issues: unquoted keys, trailing commas
                    fixed_text = result_text
                    # Remove trailing commas before closing braces/brackets
                    fixed_text = re.sub(r',(\s*[}\]])', r'\1', fixed_text)
                    # Try to quote unquoted keys (simple case)
                    fixed_text = re.sub(r'(\w+):', r'"\1":', fixed_text)
                    result = json.loads(fixed_text)
                except (json.JSONDecodeError, Exception) as e:
                    json_errors.append(f"Fix attempt failed: {e}")
            
            # Strategy 4: Try to extract fields manually with regex
            if result is None:
                try:
                    # Extract fields using regex as last resort
                    # Use non-greedy matching with DOTALL to handle multiline strings
                    # Match until we find the closing quote (handling escaped quotes)
                    factual_match = re.search(r'"factual"\s*:\s*"((?:[^"\\]|\\.)*)"', result_text, re.DOTALL)
                    sensationalist_match = re.search(r'"sensationalist"\s*:\s*"((?:[^"\\]|\\.)*)"', result_text, re.DOTALL)
                    propaganda_match = re.search(r'"propaganda"\s*:\s*"((?:[^"\\]|\\.)*)"', result_text, re.DOTALL)
                    tags_match = re.search(r'"tags"\s*:\s*\[(.*?)\]', result_text, re.DOTALL)
                    sentiment_match = re.search(r'"sentiment"\s*:\s*"([^"]*)"', result_text)
                    location_match = re.search(r'"location_city"\s*:\s*"([^"]*)"', result_text)
                    country_code_match = re.search(r'"country_code"\s*:\s*"([^"]*)"', result_text)
                    assistant_comment_match = re.search(r'"assistant_comment"\s*:\s*"([^"]*)"', result_text)
                    # Try to extract audience_scores object (can be nested JSON)
                    audience_scores_match = re.search(r'"audience_scores"\s*:\s*(\{[^}]*\})', result_text, re.DOTALL)
                    
                    result = {}
                    if factual_match:
                        factual_text = factual_match.group(1)
                        # Unescape JSON string (handle \\n, \\", etc.)
                        factual_text = factual_text.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                        result["factual"] = factual_text
                    if sensationalist_match:
                        sensationalist_text = sensationalist_match.group(1)
                        # Unescape JSON string
                        sensationalist_text = sensationalist_text.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                        result["sensationalist"] = sensationalist_text
                    if propaganda_match:
                        propaganda_text = propaganda_match.group(1)
                        # Unescape JSON string
                        propaganda_text = propaganda_text.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                        result["propaganda"] = propaganda_text
                    if tags_match:
                        # Try to parse tags array
                        try:
                            result["tags"] = json.loads(f"[{tags_match.group(1)}]")
                        except:
                            # Fallback: extract tag strings
                            tag_strings = re.findall(r'"([^"]+)"', tags_match.group(1))
                            result["tags"] = tag_strings if tag_strings else []
                    if sentiment_match:
                        result["sentiment"] = sentiment_match.group(1)
                    if location_match:
                        result["location_city"] = location_match.group(1)
                    if country_code_match:
                        result["country_code"] = country_code_match.group(1)
                    if assistant_comment_match:
                        result["assistant_comment"] = assistant_comment_match.group(1)
                except Exception as e:
                    json_errors.append(f"Regex extraction failed: {e}")
            
            # Validate and structure the response with safety net for missing variants
            if result and isinstance(result, dict):
                # Prepare fallback content (use original content, truncated if needed)
                fallback_content = content[:200] if len(content) > 200 else content
                if not fallback_content or fallback_content.strip() == "":
                    fallback_content = f"News report: {title}. {content[:150]}"
                
                # Extract variants with validation
                factual = result.get("factual", "").strip()
                sensationalist = result.get("sensationalist", "").strip()
                propaganda = result.get("propaganda", "").strip()
                
                # Debug: Log variant lengths and first 50 chars to see if they're different
                print(f"DEBUG: Article '{title[:50]}...' variants:")
                print(f"  Factual length: {len(factual)}, preview: {factual[:50]}...")
                print(f"  Sensationalist length: {len(sensationalist)}, preview: {sensationalist[:50]}...")
                print(f"  Propaganda length: {len(propaganda)}, preview: {propaganda[:50]}...")
                
                # Check if variants are identical (which shouldn't happen)
                # If they are, we need to regenerate or use fallbacks
                variants_identical = False
                if factual and sensationalist and factual.strip() == sensationalist.strip():
                    print(f"ERROR: Factual and Sensationalist variants are IDENTICAL for article '{title[:50]}...'")
                    variants_identical = True
                if factual and propaganda and factual.strip() == propaganda.strip():
                    print(f"ERROR: Factual and Propaganda variants are IDENTICAL for article '{title[:50]}...'")
                    variants_identical = True
                if sensationalist and propaganda and sensationalist.strip() == propaganda.strip():
                    print(f"ERROR: Sensationalist and Propaganda variants are IDENTICAL for article '{title[:50]}...'")
                    variants_identical = True
                
                # If variants are identical, regenerate them with different fallbacks
                if variants_identical and factual:
                    print(f"WARNING: Regenerating variants because they are identical")
                    # Use the factual as base but modify for other variants
                    base_text = factual.strip()
                    if not sensationalist or sensationalist.strip() == factual.strip():
                        # Create a more dramatic version
                        sensationalist = f"BREAKING: {base_text[:50]}... SHOCKING DEVELOPMENT! This dramatic turn of events has sent shockwaves through the community. Details are still emerging, but sources confirm this is a major story that will have far-reaching consequences."
                    if not propaganda or propaganda.strip() == factual.strip():
                        # Create a more positive/government-friendly version
                        propaganda = f"Official Statement: {base_text[:50]}... Authorities are working diligently to address this matter. Officials have confirmed that proper protocols are being followed and the situation is under control. The government is committed to transparency and public safety."
                
                # Safety Net: Ensure all three variants exist
                # If factual is missing or empty, use original content
                if not factual:
                    factual = fallback_content
                    print(f"Warning: 'factual' variant missing for article '{title[:50]}...', using fallback")
                
                # If sensationalist is missing or empty, DON'T use factual - generate a different version
                if not sensationalist:
                    print(f"Warning: 'sensationalist' variant missing for article '{title[:50]}...', generating fallback")
                    # Create a more dramatic version as fallback
                    sensationalist = f"BREAKING: {factual[:50]}... [DRAMATIC UPDATE] This shocking development has sent shockwaves through the community!"
                
                # If propaganda is missing or empty, DON'T use factual - generate a different version
                if not propaganda:
                    print(f"Warning: 'propaganda' variant missing for article '{title[:50]}...', generating fallback")
                    # Create a more positive/government-friendly version as fallback
                    propaganda = f"Official Report: {factual[:50]}... [POSITIVE SPIN] Authorities are working diligently to address this matter and ensure public safety."
                
                # Build processed_variants - guaranteed to have all three
                processed_variants = {
                    "factual": factual,
                    "sensationalist": sensationalist,
                    "propaganda": propaganda,
                }
                
                # Validate tags
                tags = result.get("tags", [])
                if not isinstance(tags, list):
                    tags = ["GENERAL"]
                if not tags:
                    tags = ["GENERAL"]
                
                # Validate sentiment
                sentiment = result.get("sentiment", "neutral")
                if sentiment not in ["positive", "negative", "neutral"]:
                    sentiment = "neutral"
                
                # Validate location
                location_city = result.get("location_city", "Unknown")
                if not location_city or location_city == "":
                    location_city = "Unknown"
                
                # Validate country code (NEW)
                country_code = result.get("country_code", "XX")
                if not country_code or country_code == "":
                    country_code = "XX"
                # Ensure it's 2 characters or "GLOBAL"
                country_code = country_code.upper()
                if country_code != "GLOBAL" and len(country_code) != 2:
                    country_code = "XX"
                
                # Validate assistant_comment
                assistant_comment = result.get("assistant_comment", "").strip()
                if not assistant_comment or assistant_comment == "":
                    assistant_comment = "This looks like a solid lead."
                
                # Validate audience_scores (now per variant)
                audience_scores = result.get("audience_scores", {})
                if not isinstance(audience_scores, dict):
                    audience_scores = {}
                
                # Ensure all 3 variants are present with valid scores
                required_variants = ["factual", "sensationalist", "propaganda"]
                required_factions = ["elite", "working_class", "patriots", "syndicate", "technocrats", "faithful", "resistance", "doomers"]
                validated_scores = {}
                
                for variant in required_variants:
                    variant_scores = audience_scores.get(variant, {})
                    if not isinstance(variant_scores, dict):
                        variant_scores = {}
                    
                    validated_variant_scores = {}
                    for faction in required_factions:
                        score = variant_scores.get(faction, 0)
                        try:
                            score = int(score)
                            # Clamp to -10 to 10 range
                            score = max(-10, min(10, score))
                        except (ValueError, TypeError):
                            score = 0
                        validated_variant_scores[faction] = score
                    
                    validated_scores[variant] = validated_variant_scores
                
                # Final validation: ensure all three variants are present and non-empty
                assert "factual" in processed_variants and processed_variants["factual"], "factual variant must exist"
                assert "sensationalist" in processed_variants and processed_variants["sensationalist"], "sensationalist variant must exist"
                assert "propaganda" in processed_variants and processed_variants["propaganda"], "propaganda variant must exist"
                
                return {
                    "processed_variants": processed_variants,
                    "tags": tags,
                    "sentiment": sentiment,
                    "location_city": location_city,
                    "country_code": country_code,
                    "assistant_comment": assistant_comment,
                    "audience_scores": validated_scores,
                }
            else:
                # If all strategies failed, log errors and use fallback
                print(f"All JSON parsing strategies failed for article '{title[:50]}...'")
                print(f"Response text (first 500 chars): {result_text[:500]}")
                print(f"Errors: {json_errors}")
                raise ValueError("Could not parse JSON from Ollama response")
            
        except Exception as e:
            print(f"Error processing article '{title[:50]}...' with Ollama: {e}")
            # Fallback response if Ollama fails - MUST include all three variants
            fallback_content = content[:200] if len(content) > 200 else content
            if not fallback_content or fallback_content.strip() == "":
                fallback_content = f"News report: {title}. {content[:150]}"
            
            # Ensure all three variants exist in fallback - use fallback_content for all
            return {
                "processed_variants": {
                    "factual": fallback_content,
                    "sensationalist": fallback_content,
                    "propaganda": fallback_content,
                },
                "tags": ["GENERAL"],
                "sentiment": "neutral",
                "location_city": "Unknown",
                "country_code": "XX",
                "assistant_comment": "This looks like a solid lead.",
                "audience_scores": {
                    "elite": 0,
                    "working_class": 0,
                    "patriots": 0,
                    "syndicate": 0,
                    "technocrats": 0,
                    "faithful": 0,
                    "resistance": 0,
                    "doomers": 0,
                },
            }
    
    @staticmethod
    def extract_country_code(title: str, content: str, model: str = None) -> str:
        """
        Extract the ISO 3166-1 alpha-2 country code from an article using Ollama.
        
        Args:
            title: Article title
            content: Article content/summary
            model: Ollama model name (defaults to DEFAULT_MODEL)
            
        Returns:
            ISO 3166-1 alpha-2 country code (e.g., "US", "NL", "JP", "GB") or "XX" if unknown
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        prompt = f"""Read the following news article and identify the PRIMARY country mentioned or implied.
Then provide ONLY the ISO 3166-1 alpha-2 country code for that country.

Examples of country codes:
- United States = US
- United Kingdom = GB
- Netherlands = NL
- France = FR
- Japan = JP
- China = CN
- Russia = RU
- Germany = DE
- India = IN
- Brazil = BR
- Canada = CA
- Australia = AU
- Greenland = GL
- Iceland = IS

If the article mentions a nationality (like "American", "British", "Dutch", "French"), return the code for that country.
If the article is about global/worldwide topics (mentions "global", "worldwide", "world", "international", "everywhere"), return "GLOBAL".
If no country is clearly mentioned or implied, return "XX".

Return ONLY the two-letter country code (e.g., "US", "NL", "GLOBAL", "XX"), nothing else.

Article Title: {title}
Article Content: {content}

Country Code:"""
        
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a location extraction tool. You identify the primary country in news articles and return its ISO 3166-1 alpha-2 code. Return only the two-letter code (e.g., 'US', 'GB', 'NL', 'GLOBAL', 'XX') or nothing else."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Handle different response formats
            if isinstance(response, dict):
                result_text = response.get("message", {}).get("content", "")
                if not result_text:
                    result_text = response.get("response", "")
            else:
                result_text = str(response)
            
            # Clean up the result
            country_code = result_text.strip().upper()
            # Remove any extra characters
            country_code = "".join(c for c in country_code if c.isalpha())
            
            # Validate: should be 2-6 characters (including "GLOBAL" and "XX")
            if len(country_code) == 2 or country_code == "GLOBAL":
                return country_code
            
            # If invalid, return "XX"
            return "XX"
        except Exception as e:
            print(f"Error extracting country code with Ollama: {e}")
            return "XX"
    
    @staticmethod
    def check_ollama_available(model: str = None) -> bool:
        """
        Check if Ollama is available and the model exists.
        
        Args:
            model: Model name to check (defaults to DEFAULT_MODEL)
            
        Returns:
            True if Ollama is available, False otherwise
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        try:
            models_response = ollama.list()
            # Handle different response formats
            if isinstance(models_response, dict):
                models_list = models_response.get("models", [])
            else:
                models_list = models_response if isinstance(models_response, list) else []
            
            model_names = [m.get("name") if isinstance(m, dict) else str(m) for m in models_list]
            return model in model_names
        except Exception as e:
            print(f"Error checking Ollama models: {e}")
            return False

