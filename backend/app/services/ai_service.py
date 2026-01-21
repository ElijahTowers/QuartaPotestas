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
            Dictionary with processed_variants, tags, sentiment, location_city
        """
        if model is None:
            model = AIService.DEFAULT_MODEL
        
        prompt = f"""You are an editor at a satirical newspaper. Given the following news article, create THREE distinct variants of the same story.

CRITICAL REQUIREMENT: You MUST provide ALL THREE variants. The JSON response MUST contain exactly these keys: "factual", "sensationalist", "propaganda". Each variant must be 50-100 words.

1. FACTUAL: Write a dry, boring, objective news report. Just the facts. No emotion. (50-100 words)
2. SENSATIONALIST: Write a fear-mongering, clickbait version. Make it dramatic and alarming. Use exclamation marks and urgent language. (50-100 words)
3. PROPAGANDA: Write a version that praises the government/institutions. Make it positive and supportive. Emphasize progress and success. (50-100 words)

Additionally, extract:
- TOPIC_TAGS: List of topic tags (e.g., ["WAR", "TECH", "ECONOMY", "POLITICS", "CLIMATE", "HEALTH"])
- SENTIMENT: Overall sentiment (positive/negative/neutral)
- LOCATION_CITY: The primary city mentioned in the article (or "Unknown" if none)

Article Title: {title}
Article Content: {content}

Respond ONLY with valid JSON. The JSON object MUST have exactly these keys:
{{
    "factual": "50-100 word factual version...",
    "sensationalist": "50-100 word sensationalist version...",
    "propaganda": "50-100 word propaganda version...",
    "tags": ["TAG1", "TAG2"],
    "sentiment": "positive|negative|neutral",
    "location_city": "City Name"
}}"""
        
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a skilled editor who can rewrite news articles in different styles. You MUST respond with valid JSON only. Do not include any text before or after the JSON object. The JSON must be properly formatted with all strings in double quotes. The JSON MUST contain exactly these keys: 'factual', 'sensationalist', 'propaganda', 'tags', 'sentiment', 'location_city'. All three variant keys (factual, sensationalist, propaganda) are REQUIRED and must not be empty."
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
            
            # Strategy 1: Try to find JSON object with regex
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
                    factual_match = re.search(r'"factual"\s*:\s*"([^"]*)"', result_text, re.DOTALL)
                    sensationalist_match = re.search(r'"sensationalist"\s*:\s*"([^"]*)"', result_text, re.DOTALL)
                    propaganda_match = re.search(r'"propaganda"\s*:\s*"([^"]*)"', result_text, re.DOTALL)
                    tags_match = re.search(r'"tags"\s*:\s*\[(.*?)\]', result_text, re.DOTALL)
                    sentiment_match = re.search(r'"sentiment"\s*:\s*"([^"]*)"', result_text)
                    location_match = re.search(r'"location_city"\s*:\s*"([^"]*)"', result_text)
                    
                    result = {}
                    if factual_match:
                        result["factual"] = factual_match.group(1)
                    if sensationalist_match:
                        result["sensationalist"] = sensationalist_match.group(1)
                    if propaganda_match:
                        result["propaganda"] = propaganda_match.group(1)
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
                
                # Safety Net: Ensure all three variants exist
                # If factual is missing or empty, use original content
                if not factual:
                    factual = fallback_content
                    print(f"Warning: 'factual' variant missing for article '{title[:50]}...', using fallback")
                
                # If sensationalist is missing or empty, use factual as fallback
                if not sensationalist:
                    sensationalist = factual
                    print(f"Warning: 'sensationalist' variant missing for article '{title[:50]}...', using factual as fallback")
                
                # If propaganda is missing or empty, use factual as fallback
                if not propaganda:
                    propaganda = factual
                    print(f"Warning: 'propaganda' variant missing for article '{title[:50]}...', using factual as fallback")
                
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
                
                # Final validation: ensure all three variants are present and non-empty
                assert "factual" in processed_variants and processed_variants["factual"], "factual variant must exist"
                assert "sensationalist" in processed_variants and processed_variants["sensationalist"], "sensationalist variant must exist"
                assert "propaganda" in processed_variants and processed_variants["propaganda"], "propaganda variant must exist"
                
                return {
                    "processed_variants": processed_variants,
                    "tags": tags,
                    "sentiment": sentiment,
                    "location_city": location_city,
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
            }
    
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

