"""
Geo Service for converting location names to coordinates.
"""
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from typing import Tuple, Optional
import time


class GeoService:
    """Service for geocoding city names to latitude/longitude coordinates."""
    
    def __init__(self):
        """Initialize the geocoder."""
        self.geolocator = Nominatim(user_agent="quarta_potestas")
    
    def get_coordinates(
        self,
        city_name: str,
        max_retries: int = 3
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Convert city name to latitude and longitude coordinates.
        
        Args:
            city_name: Name of the city or region
            max_retries: Maximum number of retry attempts
            
        Returns:
            Tuple of (latitude, longitude) or (None, None) if not found
        """
        if not city_name or city_name == "Unknown":
            return None, None
        
        # First check if it's a known region in our fallback dictionary
        # Known regions that should use fallback coordinates instead of geocoding
        # Check fallback first to avoid incorrect geocoding results
        region_coords = self.get_country_center_fallback(city_name)
        if region_coords[0] is not None and region_coords[1] is not None:
            # Verify it's actually a region (not a city that happens to match)
            known_regions = [
                "North Africa", "Middle East", "Southeast Asia", "Sub-Saharan Africa", 
                "Central America", "South America", "Eastern Europe", "Western Europe",
                "Scandinavia", "Balkans", "Caribbean", "Global", "World", "Worldwide"
            ]
            city_lower = city_name.lower()
            # Check if it matches a known region name
            for region in known_regions:
                if region.lower() == city_lower:
                    print(f"  Using fallback coordinates for region: {region}")
                    return region_coords
            # Also check for partial matches (e.g., "North Africa" in "North African")
            for region in known_regions:
                if region.lower() in city_lower or city_lower in region.lower():
                    # Only use if it's a clear match (not just a word that happens to be in the region name)
                    if len(region.split()) > 1 or city_lower.startswith(region.lower()) or city_lower.endswith(region.lower()):
                        print(f"  Using fallback coordinates for region: {region} (matched from: {city_name})")
                        return region_coords
        
        # For regular cities, try geocoding
        for attempt in range(max_retries):
            try:
                location = self.geolocator.geocode(city_name, timeout=10)
                if location:
                    return location.latitude, location.longitude
                else:
                    return None, None
                    
            except (GeocoderTimedOut, GeocoderServiceError) as e:
                if attempt < max_retries - 1:
                    time.sleep(1)  # Wait before retry
                    continue
                else:
                    print(f"Geocoding error for {city_name}: {e}")
                    return None, None
            except Exception as e:
                print(f"Unexpected geocoding error for {city_name}: {e}")
                return None, None
        
        return None, None
    
    @staticmethod
    def get_fallback_coordinates(city_name: str) -> Tuple[Optional[float], Optional[float]]:
        """
        Get fallback coordinates for common cities (for when geocoding fails).
        
        Args:
            city_name: Name of the city
            
        Returns:
            Tuple of (latitude, longitude) or (None, None)
        """
        # Common city coordinates fallback
        fallback_cities = {
            "San Francisco": (37.7749, -122.4194),
            "New York": (40.7128, -74.0060),
            "London": (51.5074, -0.1278),
            "Paris": (48.8566, 2.3522),
            "Tokyo": (35.6762, 139.6503),
            "Berlin": (52.5200, 13.4050),
            "Moscow": (55.7558, 37.6173),
            "Beijing": (39.9042, 116.4074),
            "Washington": (38.9072, -77.0369),
            "Cape Canaveral": (28.3922, -80.6077),
        }
        
        city_lower = city_name.lower()
        for city, coords in fallback_cities.items():
            if city_lower in city_name.lower() or city_name.lower() in city_lower:
                return coords
        
        return None, None
    
    def get_country_center(self, country_name: str) -> Tuple[Optional[float], Optional[float]]:
        """
        Get the center coordinates of a country.
        
        Args:
            country_name: Name of the country
            
        Returns:
            Tuple of (latitude, longitude) for the country center, or (None, None) if not found
        """
        if not country_name or country_name == "Unknown":
            return None, None
        
        # First check fallback dictionary (especially important for regions like "North Africa")
        fallback_coords = self.get_country_center_fallback(country_name)
        if fallback_coords[0] is not None and fallback_coords[1] is not None:
            # For known regions, use fallback directly to avoid incorrect geocoding
            known_regions = [
                "North Africa", "Middle East", "Southeast Asia", "Sub-Saharan Africa", 
                "Central America", "South America", "Eastern Europe", "Western Europe",
                "Scandinavia", "Balkans", "Caribbean", "Global", "World", "Worldwide"
            ]
            country_lower = country_name.lower()
            for region in known_regions:
                if region.lower() == country_lower:
                    print(f"  Using fallback for region: {region}")
                    return fallback_coords
        
        # Try geocoding the country name
        for attempt in range(3):
            try:
                # Try with country name directly
                location = self.geolocator.geocode(country_name, timeout=10)
                if location:
                    return location.latitude, location.longitude
                
                # Try with "country" suffix if it's not already there
                if "country" not in country_name.lower():
                    location = self.geolocator.geocode(f"{country_name} country", timeout=10)
                    if location:
                        return location.latitude, location.longitude
                
                return None, None
                    
            except (GeocoderTimedOut, GeocoderServiceError) as e:
                if attempt < 2:
                    time.sleep(1)
                    continue
                else:
                    print(f"Geocoding error for country {country_name}: {e}")
                    return self.get_country_center_fallback(country_name)
            except Exception as e:
                print(f"Unexpected geocoding error for country {country_name}: {e}")
                return self.get_country_center_fallback(country_name)
        
        return self.get_country_center_fallback(country_name)
    
    @staticmethod
    def get_country_center_fallback(country_name: str) -> Tuple[Optional[float], Optional[float]]:
        """
        Get fallback center coordinates for common countries.
        
        Args:
            country_name: Name of the country
            
        Returns:
            Tuple of (latitude, longitude) for the country center, or (None, None)
        """
        # Country center coordinates (approximate geographic centers)
        country_centers = {
            "United States": (39.8283, -98.5795),
            "USA": (39.8283, -98.5795),
            "US": (39.8283, -98.5795),
            "America": (39.8283, -98.5795),
            "United Kingdom": (54.7024, -3.2766),
            "UK": (54.7024, -3.2766),
            "Britain": (54.7024, -3.2766),
            "France": (46.6034, 1.8883),
            "Germany": (51.1657, 10.4515),
            "Italy": (41.8719, 12.5674),
            "Spain": (40.4637, -3.7492),
            "China": (35.8617, 104.1954),
            "Japan": (36.2048, 138.2529),
            "India": (20.5937, 78.9629),
            "Russia": (61.5240, 105.3188),
            "Canada": (56.1304, -106.3468),
            "Australia": (25.2744, 133.7751),
            "Brazil": (14.2350, -51.9253),
            "Mexico": (23.6345, -102.5528),
            "Argentina": (38.4161, -63.6167),
            "South Africa": (30.5595, 22.9375),
            "Egypt": (26.0975, 31.2357),
            "Nigeria": (9.0820, 8.6753),
            "Kenya": (0.0236, 37.9062),
            "Saudi Arabia": (23.8859, 45.0792),
            "Turkey": (38.9637, 35.2433),
            "Iran": (32.4279, 53.6880),
            "Iraq": (33.2232, 43.6793),
            "Israel": (31.0461, 34.8516),
            "Pakistan": (30.3753, 69.3451),
            "Bangladesh": (23.6850, 90.3563),
            "Indonesia": (0.7893, 113.9213),
            "Thailand": (15.8700, 100.9925),
            "Vietnam": (14.0583, 108.2772),
            "Philippines": (12.8797, 121.7740),
            "South Korea": (35.9078, 127.7669),
            "North Korea": (40.3399, 127.5101),
            "Poland": (51.9194, 19.1451),
            "Ukraine": (48.3794, 31.1656),
            "Greece": (39.0742, 21.8243),
            "Netherlands": (52.1326, 5.2913),
            "Belgium": (50.5039, 4.4699),
            "Switzerland": (46.8182, 8.2275),
            "Austria": (47.5162, 14.5501),
            "Sweden": (60.1282, 18.6435),
            "Norway": (60.4720, 8.4689),
            "Denmark": (56.2639, 9.5018),
            "Finland": (61.9241, 25.7482),
            "Greenland": (71.7069, -42.6043),
            "Iceland": (64.9631, -19.0208),
            "Norway": (60.4720, 8.4689),
            "Sweden": (60.1282, 18.6435),
            "Global": (0, 0),  # Center of world map for global/worldwide articles
            "World": (0, 0),
            "Worldwide": (0, 0),
            # Regions
            "North Africa": (28.0339, 1.6596),  # Geographic center of North Africa (Algeria/Tunisia region)
            "Middle East": (29.2985, 42.5503),  # Geographic center of Middle East
            "Southeast Asia": (1.3521, 103.8198),  # Geographic center of Southeast Asia
            "Sub-Saharan Africa": (0.0236, 37.9062),  # Kenya region as center
            "Central America": (12.2650, -85.2072),  # Geographic center
            "South America": (-14.2350, -51.9253),  # Geographic center
            "Eastern Europe": (50.0647, 19.9450),  # Poland region
            "Western Europe": (50.5039, 4.4699),  # Belgium region
            "Scandinavia": (64.9631, -19.0208),  # Iceland as center
            "Balkans": (44.0165, 21.0059),  # Serbia region
            "Caribbean": (18.2208, -66.5901),  # Puerto Rico region
        }
        
        country_lower = country_name.lower()
        # Direct match
        if country_name in country_centers:
            return country_centers[country_name]
        
        # Partial match
        for country, coords in country_centers.items():
            if country_lower in country.lower() or country.lower() in country_lower:
                return coords
        
        return None, None

