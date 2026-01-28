"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { InfluenceLayer } from "./map/InfluenceLayer";
import L from "leaflet";
import type { Article } from "@/types/api";
import { MapPin, Globe } from "lucide-react";

// Single source of truth for initial/world view
const INITIAL_VIEW = {
  center: [20, 0] as [number, number], // Center of world
  zoom: 1.5, // Zoom level for world view (wider to show Greenland and all continents)
};

// Fix for default marker icons in Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface MapProps {
  articles: Article[];
  selectedArticleId: string | null;
  onArticleSelect: (articleId: string | number) => void;
}

// Component to apply sepia filter to map
function MapStyle() {
  const map = useMap();
  
  useEffect(() => {
    const mapContainer = map.getContainer();
    if (mapContainer) {
      mapContainer.classList.add("sepia-map");
      
      return () => {
        mapContainer.classList.remove("sepia-map");
      };
    }
  }, [map]);
  
  return null;
}

// Component to pan map to selected article and open popup
function PanToSelected({
  selectedArticleId, 
  articles,
  markerRefs
}: { 
  selectedArticleId: string | null;  // Changed from number to string (PocketBase ID)
  articles: Article[];
  markerRefs: React.MutableRefObject<globalThis.Map<string, L.Marker>>;  // Changed from number to string
}) {
  const map = useMap();
  const lastPannedId = useRef<string | null>(null); // Track last panned article ID
  
  // List of known regions that should show wider view
  const knownRegions = [
    "North Africa", "Middle East", "Southeast Asia", "Sub-Saharan Africa",
    "Central America", "South America", "Eastern Europe", "Western Europe",
    "Scandinavia", "Balkans", "Caribbean", "Global", "World", "Worldwide"
  ];
  
  const isRegion = (locationCity: string | null): boolean => {
    if (!locationCity) return false;
    const locationLower = locationCity.toLowerCase();
    return knownRegions.some(region => region.toLowerCase() === locationLower);
  };
  
  useEffect(() => {
    console.log(`[PanToSelected] Effect triggered with selectedArticleId: ${selectedArticleId}`);
    
    // Safety check: ensure map is still valid
    if (!map || !map.getContainer) {
      console.log(`[PanToSelected] Map not available, returning early`);
      return;
    }
    
    if (selectedArticleId === null) {
      console.log(`[PanToSelected] selectedArticleId is null, returning early`);
      lastPannedId.current = null; // Reset when selection is cleared
      return;
    }
    
    // Prevent re-panning if we already panned to this article
    if (lastPannedId.current === selectedArticleId) {
      console.log(`[PanToSelected] Already panned to this article, skipping`);
      return;
    }
    
    const selectedArticle = articles.find(
      (article) => article.id === selectedArticleId
    );
    
    console.log(`[PanToSelected] Found article:`, selectedArticle ? {
      id: selectedArticle.id,
      title: selectedArticle.original_title,
      location_city: selectedArticle.location_city,
      location_lat: selectedArticle.location_lat,
      location_lon: selectedArticle.location_lon
    } : 'NOT FOUND');
    
    if (!selectedArticle) {
      console.log(`[PanToSelected] Article not found in articles array`);
      return;
    }
    
    // Check if article is global/unknown (by location_city or coordinates)
    const locationCity = selectedArticle.location_city?.trim().toLowerCase() || "";
    const isGlobalByCity = locationCity === "global" || 
                           locationCity === "world" ||
                           locationCity === "worldwide" ||
                           locationCity === "unknown";
    
    // Also check if coordinates are (0, 0) - this is the global pin location
    const isGlobalByCoords = selectedArticle.location_lat === 0 && selectedArticle.location_lon === 0;
    const isGlobal = isGlobalByCity || isGlobalByCoords;
    
    console.log(`[PanToSelected] Location check - locationCity: "${locationCity}", isGlobalByCity: ${isGlobalByCity}, isGlobalByCoords: ${isGlobalByCoords}, isGlobal: ${isGlobal}`);
    
    if (isGlobal) {
      // For global/unknown articles, pan to the global pin location (0, 0)
      const globalPinLocation: [number, number] = [0, 0];
      const globalZoom = 2; // Zoom level to clearly see the global pin
      
      console.log(`[PanToSelected] Global/Unknown article detected: "${selectedArticle.location_city}" - panning to global pin at [0, 0]`);
      
      // Mark this article as panned to prevent re-panning
      lastPannedId.current = selectedArticleId;
      
      // Pan immediately to the global pin location (no animation for instant feedback)
      map.setView(globalPinLocation, globalZoom, { animate: false });
      console.log(`[PanToSelected] setView called with [0, 0], zoom: ${globalZoom}`);
      
      // For global articles, open popup immediately (no delay since we use setView with animate: false)
      // Use requestAnimationFrame to ensure map has updated, then try immediately
      requestAnimationFrame(() => {
        let retryCount = 0;
        const maxRetries = 10; // Reduced retries for faster failure
        const retryDelay = 10; // Much shorter delay (10ms instead of 100ms)
        
        const openPopupWhenReady = () => {
          retryCount++;
          const markerRef = markerRefs.current.get(selectedArticleId);
          
          if (markerRef && markerRef.getPopup) {
            try {
              // Double-check map is still valid
              if (!map || !map.getContainer) {
                return;
              }
              
              const popup = markerRef.getPopup();
              if (popup) {
                // Check if popup is already open to avoid unnecessary calls
                const isOpen = markerRef.isPopupOpen ? markerRef.isPopupOpen() : false;
                if (!isOpen) {
                  markerRef.openPopup();
                  console.log(`[PanToSelected] ✅ Popup opened immediately for global article ${selectedArticleId}`);
                }
              }
            } catch (error) {
              console.warn(`[PanToSelected] Failed to open popup:`, error);
            }
          } else {
            // Marker not ready yet, retry with very short delay
            if (retryCount < maxRetries) {
              setTimeout(openPopupWhenReady, retryDelay);
            } else {
              console.warn(`[PanToSelected] ⚠️ Marker not found for global article ${selectedArticleId} after ${maxRetries} attempts`);
            }
          }
        };
        
        // Start trying to open the popup immediately
        openPopupWhenReady();
      });
      
      // No cleanup needed - requestAnimationFrame and short timeouts complete quickly
      return; // Exit early for global articles to prevent non-global handling
    }
    
    // For non-global articles, we need coordinates (check for null/undefined, not falsy, since 0 is valid)
    if (selectedArticle.location_lat === null || selectedArticle.location_lat === undefined ||
        selectedArticle.location_lon === null || selectedArticle.location_lon === undefined) {
      console.log(`[PanToSelected] Article has no coordinates: lat=${selectedArticle.location_lat}, lon=${selectedArticle.location_lon}`);
      return;
    }
    
    // Only check for regional if it's not global
    const isRegional = isRegion(selectedArticle.location_city);
    
    let zoomLevel: number;
    let centerLat: number;
    let centerLon: number;
    
    if (isRegional) {
      zoomLevel = 4; // Wider zoom for regions
      centerLat = selectedArticle.location_lat;
      centerLon = selectedArticle.location_lon;
      console.log(`[PanToSelected] Regional article detected: "${selectedArticle.location_city}" - zooming to region view`);
    } else {
      zoomLevel = 6; // Closer zoom for specific cities
      centerLat = selectedArticle.location_lat;
      centerLon = selectedArticle.location_lon;
      console.log(`[PanToSelected] City article detected: "${selectedArticle.location_city}" - zooming to city view`);
    }
    
    // Mark this article as panned to prevent re-panning
    lastPannedId.current = selectedArticleId;
    
    // Pan to the selected marker with smooth animation
    map.flyTo(
      [centerLat, centerLon],
      zoomLevel,
      {
        duration: 1.0, // Animation duration in seconds
      }
    );
    console.log(`[PanToSelected] flyTo called with [${centerLat}, ${centerLon}], zoom: ${zoomLevel}`);
    
    // Open the popup after a short delay to allow the map to pan
    // Wait for marker to be available in markerRefs (it's added asynchronously)
    let retryCount = 0;
    const maxRetries = 30; // Try for up to 3 seconds (30 * 100ms)
    
    const openPopupWhenReady = () => {
      retryCount++;
      const markerRef = markerRefs.current.get(selectedArticleId);
      
      console.log(`[PanToSelected] Attempting to open popup (attempt ${retryCount}/${maxRetries}) for article ${selectedArticleId}`);
      console.log(`[PanToSelected] Marker refs available:`, Array.from(markerRefs.current.keys()));
      console.log(`[PanToSelected] Marker found:`, markerRef ? 'YES' : 'NO');
      
      if (markerRef && markerRef.getPopup) {
        try {
          // Double-check map is still valid
          if (!map || !map.getContainer) {
            console.log(`[PanToSelected] Map not valid, aborting popup open`);
            return;
          }
          
          const popup = markerRef.getPopup();
          if (popup) {
            // Check if popup is already open to avoid unnecessary calls
            const isOpen = markerRef.isPopupOpen ? markerRef.isPopupOpen() : false;
            console.log(`[PanToSelected] Popup exists, isOpen: ${isOpen}`);
            if (!isOpen) {
              markerRef.openPopup();
              console.log(`[PanToSelected] ✅ Popup opened successfully for article ${selectedArticleId}`);
            } else {
              console.log(`[PanToSelected] Popup already open, skipping`);
            }
          } else {
            console.log(`[PanToSelected] No popup found on marker`);
          }
        } catch (error) {
          console.warn(`[PanToSelected] Failed to open popup:`, error);
        }
      } else {
        // Marker not ready yet, retry after a short delay
        if (retryCount < maxRetries) {
          console.log(`[PanToSelected] Marker not ready, retrying in 100ms...`);
          setTimeout(openPopupWhenReady, 100);
        } else {
          console.warn(`[PanToSelected] ⚠️ Max retries reached, marker not found for article ${selectedArticleId}`);
        }
      }
    };
    
    // Start trying to open popup after map pan animation completes
    const timeoutId = setTimeout(openPopupWhenReady, 1200);
    
    return () => clearTimeout(timeoutId);
  }, [selectedArticleId, articles, map, markerRefs]);
  
  return null;
}

// Component to disable keyboard and scroll panning, allow only drag panning
function PanningController() {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    // Disable keyboard navigation
    map.keyboard.disable();
    
    // Disable scroll zoom panning
    map.scrollWheelZoom.disable();
    
    // Disable box zoom (shift+click drag)
    if (map.boxZoom) {
      map.boxZoom.disable();
    }
    
    // Disable double-click zoom
    if (map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
    
    // Keep dragging enabled (it's enabled by default) - this is the only way to pan
    map.dragging.enable();
    
    return () => {
      // Re-enable on unmount if needed
      try {
        map.keyboard.enable();
        map.scrollWheelZoom.enable();
        if (map.boxZoom) map.boxZoom.enable();
        if (map.doubleClickZoom) map.doubleClickZoom.enable();
      } catch (e) {
        // Map might be unmounted
      }
    };
  }, [map]);
  
  return null;
}

// Component to initialize/reset map to world view
function InitializeWorldView({ selectedArticleId }: { selectedArticleId: string | null }) {  // Changed from number to string
  const map = useMap();
  const hasInitialized = useRef(false);
  const lastSelectedId = useRef<string | null>(null);  // Changed from number to string
  
  const resetToWorldView = () => {
    // Use setView (same as initial load and World View button) to ensure exact match
    map.setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom, { animate: false });
  };
  
  // On initial mount, explicitly set the view to ensure it matches World View button exactly
  useEffect(() => {
    if (!hasInitialized.current && map) {
      hasInitialized.current = true;
      lastSelectedId.current = selectedArticleId;
      
      // Explicitly set the view using setView (same method as World View button, but without animation)
      // This ensures the initial view matches exactly what the World View button sets
      map.setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom, { animate: false });
      
      console.log(`[InitializeWorldView] 🎯 Explicitly set initial view to:`, {
        center: INITIAL_VIEW.center,
        zoom: INITIAL_VIEW.zoom
      });
      
      // Log the actual view after a short delay to verify
      setTimeout(() => {
        if (map) {
          const center = map.getCenter();
          const zoom = map.getZoom();
          console.log(`[InitializeWorldView] 📍 ACTUAL INITIAL VIEW (on page refresh):`, {
            center: [center.lat, center.lng],
            zoom: zoom,
            expected: {
              center: INITIAL_VIEW.center,
              zoom: INITIAL_VIEW.zoom
            },
            difference: {
              center: [
                Math.abs(center.lat - INITIAL_VIEW.center[0]),
                Math.abs(center.lng - INITIAL_VIEW.center[1])
              ],
              zoom: Math.abs(zoom - INITIAL_VIEW.zoom)
            }
          });
        }
      }, 100);
    }
  }, [map]); // Run when map is available
  
  // When selectedArticleId becomes null (e.g., clicking Map button), reset to world view
  // Only reset if we previously had a selection and now it's null
  useEffect(() => {
    if (hasInitialized.current && lastSelectedId.current !== null && selectedArticleId === null) {
      resetToWorldView();
    }
    lastSelectedId.current = selectedArticleId;
  }, [selectedArticleId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  return null;
}

// Component to log the initial view when map is ready
function LogInitialView() {
  const map = useMap();
  const hasLogged = useRef(false);
  
  useEffect(() => {
    if (!hasLogged.current && map) {
      // Wait a bit for map to be fully initialized
      const timeoutId = setTimeout(() => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        console.log(`[LogInitialView] 📍 MAP CONTAINER INITIAL VIEW (on page refresh):`, {
          center: [center.lat, center.lng],
          zoom: zoom,
          expected: {
            center: INITIAL_VIEW.center,
            zoom: INITIAL_VIEW.zoom
          },
          difference: {
            center: [
              Math.abs(center.lat - INITIAL_VIEW.center[0]),
              Math.abs(center.lng - INITIAL_VIEW.center[1])
            ],
            zoom: Math.abs(zoom - INITIAL_VIEW.zoom)
          }
        });
        hasLogged.current = true;
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [map]);
  
  return null;
}

// Component to reset map view to world view (button)
function ResetMapView() {
  const map = useMap();
  
  const resetToWorldView = () => {
    // Log current view before reset
    const beforeCenter = map.getCenter();
    const beforeZoom = map.getZoom();
    console.log(`[ResetMapView] 🔄 BEFORE World View button click:`, {
      center: [beforeCenter.lat, beforeCenter.lng],
      zoom: beforeZoom
    });
    
    // Log what we're setting it to
    console.log(`[ResetMapView] 🎯 Setting to INITIAL_VIEW:`, {
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom
    });
    
    // Use setView (same as initial load) to ensure exact match - no animation to avoid rounding differences
    map.setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom, { animate: false });
    
    // Log the view immediately after setting (no need to wait for animation)
    setTimeout(() => {
      const afterCenter = map.getCenter();
      const afterZoom = map.getZoom();
      console.log(`[ResetMapView] ✅ AFTER World View button click:`, {
        center: [afterCenter.lat, afterCenter.lng],
        zoom: afterZoom,
        expected: {
          center: INITIAL_VIEW.center,
          zoom: INITIAL_VIEW.zoom
        },
        difference: {
          center: [
            Math.abs(afterCenter.lat - INITIAL_VIEW.center[0]),
            Math.abs(afterCenter.lng - INITIAL_VIEW.center[1])
          ],
          zoom: Math.abs(afterZoom - INITIAL_VIEW.zoom)
        }
      });
    }, 50); // Small delay just to ensure the view is set
  };
  
  return (
    <button
      onClick={resetToWorldView}
      className="absolute top-4 right-4 z-[1000] bg-[#1a0f08] border border-[#8b6f47] text-[#e8dcc6] px-3 py-2 rounded hover:bg-[#2a1810] hover:border-[#d4af37] transition-colors flex items-center gap-2 shadow-lg paper-texture"
      title="Zoom out to world view"
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-serif">World View</span>
    </button>
  );
}

// Custom marker icon with sepia styling (moved outside component for reuse)
function createCustomIcon(isSelected: boolean, isGlobal: boolean = false) {
  // Special icon for global/worldwide articles
  if (isGlobal) {
    return L.divIcon({
      className: "custom-marker global-marker",
      html: `
        <div style="
          background-color: ${isSelected ? "#4a90e2" : "#2c5aa0"};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid ${isSelected ? "#6bb3ff" : "#1a3d6b"};
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            color: white;
            font-size: 16px;
            font-weight: bold;
          ">🌍</div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
  
  // Regular article marker
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${isSelected ? "#d4af37" : "#8b6f47"};
        width: 24px;
        height: 24px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid ${isSelected ? "#f4e8d0" : "#2a1810"};
        box-shadow: 0 2px 4px rgba(0,0,0,0.4);
      ">
        <div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: white;
          font-size: 12px;
          font-weight: bold;
        ">📰</div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

// Individual marker component that can be controlled
function MarkerWithPopup({
  article,
  isSelected,
  onArticleSelect,
  markerRefs,
}: {
  article: Article;
  isSelected: boolean;
  onArticleSelect: (articleId: string) => void;  // Changed from number to string
  markerRefs: React.MutableRefObject<globalThis.Map<string, L.Marker>>;  // Changed from number to string
}) {
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();
  
  useEffect(() => {
    if (!markerRef.current || !map) {
      return;
    }

    // Wait for marker to be fully initialized with Leaflet
    // Use a more robust check that waits for Leaflet's internal state
    const checkAndAddMarker = () => {
      const marker = markerRef.current;
      if (!marker) {
        console.log(`[MarkerWithPopup] Marker ref is null for article ${article.id}`);
        return false;
      }

      try {
        // Check if marker is fully initialized by Leaflet
        // _leaflet_pos is set when marker is added to map and positioned
        const markerAny = marker as any;
        
        // Basic check: marker has getLatLng method (means it's a valid Leaflet marker)
        const hasGetLatLng = typeof marker.getLatLng === 'function';
        const hasLeafletId = markerAny?._leaflet_id !== undefined;
        const hasMap = markerAny?._map !== null && markerAny?._map !== undefined;
        
        console.log(`[MarkerWithPopup] Checking marker ${article.id}: hasGetLatLng=${hasGetLatLng}, hasLeafletId=${hasLeafletId}, hasMap=${hasMap}`);
        
        // Simplified check: just need getLatLng and leaflet_id (map might not be set immediately)
        if (hasGetLatLng && hasLeafletId) {
          // Marker is fully initialized and positioned
          markerRefs.current.set(article.id, marker);
          console.log(`[MarkerWithPopup] ✅ Successfully registered marker for article ${article.id}`);
          console.log(`[MarkerWithPopup] Total markers registered: ${markerRefs.current.size}`);
          return true;
        }
        return false;
      } catch (error) {
        // Marker not ready yet or error accessing properties
        console.warn(`[MarkerWithPopup] Error checking marker ${article.id}:`, error);
        return false;
      }
    };

    // Try multiple times with increasing delays
    let attempts = 0;
    const maxAttempts = 20; // Increased from 10 to 20
    
    const tryAddMarker = () => {
      attempts++;
      console.log(`[MarkerWithPopup] Attempt ${attempts}/${maxAttempts} to register marker for article ${article.id}`);
      if (checkAndAddMarker() || attempts >= maxAttempts) {
        if (attempts >= maxAttempts) {
          console.warn(`[MarkerWithPopup] ⚠️ Max attempts reached for article ${article.id}, marker not registered`);
        }
        return;
      }
      // Retry with exponential backoff
      setTimeout(tryAddMarker, 50 * attempts);
    };

    // Start checking after initial delay
    const timeoutId = setTimeout(tryAddMarker, 100);
    
    return () => {
      clearTimeout(timeoutId);
      // Clean up: remove from refs when component unmounts
      const currentMarker = markerRefs.current.get(article.id);
      if (currentMarker === markerRef.current) {
        markerRefs.current.delete(article.id);
      }
    };
  }, [article.id, markerRefs, map]);
  
  // Safety check: ensure coordinates are valid numbers
  if (article.location_lat === null || article.location_lat === undefined ||
      article.location_lon === null || article.location_lon === undefined ||
      isNaN(article.location_lat) || isNaN(article.location_lon)) {
    return null;
  }
  
  const isGlobal = article.location_city?.toLowerCase() === "global";
  
  return (
    <Marker
      ref={markerRef}
      position={[article.location_lat, article.location_lon]}
      icon={createCustomIcon(isSelected, isGlobal)}
      eventHandlers={{
        click: () => {
          onArticleSelect(article.id);
        },
      }}
    >
      <Popup>
        <div className="text-sm text-[#2a1810] min-w-[200px]">
          <h3 className="font-bold mb-2 font-serif">{article.original_title}</h3>
          {article.location_city && (
            <p className="text-xs text-gray-600 mb-2">
              {isGlobal ? "🌍" : "📍"} {article.location_city}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mb-2">
            {article.tags.topic_tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 italic">{article.tags.sentiment}</p>
        </div>
      </Popup>
    </Marker>
  );
}

// Component to fit map bounds to show all markers with extra top padding
function BoundsController({ 
  articles, 
  selectedArticleId 
}: { 
  articles: Article[];
  selectedArticleId: string | null;  // Changed from number to string
}) {
  const map = useMap();
  const hasFittedBounds = useRef(false);
  
  useEffect(() => {
    // DISABLED: Don't fit bounds on initial load to ensure initial view matches World View button
    // The initial view should always be the world view (INITIAL_VIEW), not the bounds of all markers
    // This ensures consistency between page refresh and World View button
    
    // If you want to re-enable bounds fitting, uncomment the code below:
    /*
    // Only fit bounds on initial load when no article is selected
    // This prevents interference with manual panning/zooming
    if (!map || articles.length === 0 || selectedArticleId !== null) {
      return;
    }
    
    // Only fit bounds once on initial load
    if (hasFittedBounds.current) {
      return;
    }
    
    // Filter articles with valid coordinates
    const articlesWithCoords = articles.filter(
      (article) => 
        article.location_lat !== null && 
        article.location_lat !== undefined &&
        article.location_lon !== null && 
        article.location_lon !== undefined &&
        !isNaN(article.location_lat) &&
        !isNaN(article.location_lon)
    );
    
    if (articlesWithCoords.length === 0) {
      return;
    }
    
    // Wait a bit for map to be fully ready
    const timeoutId = setTimeout(() => {
      try {
        // Create bounds from all marker positions
        const bounds = L.latLngBounds(
          articlesWithCoords.map((article) => [
            article.location_lat!,
            article.location_lon!
          ])
        );
        
        // Fit bounds with extra padding at the top to ensure northern markers (like Greenland) are fully visible
        map.fitBounds(bounds, {
          paddingTopLeft: [50, 150],  // [x, y] -> Adds 150px buffer at the top
          paddingBottomRight: [50, 50] // [x, y] -> Normal buffer at bottom/right
        });
        
        hasFittedBounds.current = true;
      } catch (error) {
        console.warn("Failed to fit bounds:", error);
      }
    }, 500); // Small delay to ensure map is ready
    
    return () => clearTimeout(timeoutId);
    */
  }, [map, articles]); // Removed selectedArticleId - only fit bounds on mount/article changes, not on selection
  
  // Reset hasFittedBounds when articles change significantly
  useEffect(() => {
    hasFittedBounds.current = false;
  }, [articles.length]);
  
  return null;
}

// Component to wait for map to be ready before rendering markers
function MapReady({ children }: { children: React.ReactNode }) {
  const map = useMap();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!map) {
      return;
    }

    let mounted = true;
    let retryCount = 0;
    const maxRetries = 20; // Max 2 seconds of retries

    // Wait for map to be fully ready
    const checkReady = () => {
      if (!mounted || retryCount >= maxRetries) {
        if (retryCount >= maxRetries) {
          console.warn("MapReady: Max retries reached, proceeding anyway");
          if (mounted) setIsReady(true);
        }
        return;
      }

      retryCount++;

      try {
        // Check if map container exists and is ready
        const container = map.getContainer();
        if (!container) {
          setTimeout(checkReady, 100);
          return;
        }

        // Check if map has valid size (means it's rendered)
        const size = map.getSize();
        if (size && size.x > 0 && size.y > 0) {
          // Map is rendered, wait longer for Leaflet internals to be fully ready
          // This ensures _leaflet_pos and other internal properties are set
          setTimeout(() => {
            if (mounted) {
              setIsReady(true);
            }
          }, 300); // Increased delay to ensure Leaflet has fully initialized
          return;
        }
      } catch (error) {
        // Map not ready yet, try again
      }
      
      // Retry after a short delay
      setTimeout(checkReady, 100);
    };

    // Use whenReady if available, otherwise check manually
    if (map.whenReady) {
      map.whenReady(() => {
        if (mounted) {
          checkReady();
        }
      });
    } else {
      // Fallback: check after initial delay
      setTimeout(() => {
        if (mounted) {
          checkReady();
        }
      }, 100);
    }

    return () => {
      mounted = false;
    };
  }, [map]);

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}

export default function Map(props: MapProps) {
  // Destructure with defaults to prevent undefined errors
  const { 
    articles = [], 
    selectedArticleId = null, 
    onArticleSelect = () => {} 
  } = props || {};
  
  // Store marker refs to control popups programmatically
  // Use global Map to avoid naming conflict with component name
  const markerRefs = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());  // Changed from number to string
  
  // Safety check: ensure articles is an array
  const safeArticles = articles || [];

  // Assign Global location (0, 0) to articles without coordinates or with "Unknown" location
  // This ensures unknown scoops appear on the global location pin
  const articlesWithCoords = safeArticles.map((article) => {
    const locationCity = article.location_city?.toLowerCase() || "";
    const isUnknown = locationCity === "unknown" || !locationCity;
    const hasNoCoords = article.location_lat === null || article.location_lat === undefined ||
                        article.location_lon === null || article.location_lon === undefined;
    
    // If article has no coordinates OR location is "Unknown", assign to Global location
    if (hasNoCoords || isUnknown) {
      console.log(`[Map] Assigning article "${article.original_title?.substring(0, 50)}" to Global location (was: ${article.location_city || 'null'}, coords: ${article.location_lat}, ${article.location_lon})`);
      return {
        ...article,
        location_lat: 0,
        location_lon: 0,
        location_city: "Global",
      };
    }
    return article;
  }).filter(
    // Filter out any articles that still don't have valid coordinates after assignment
    (article) => 
      article.location_lat !== null && 
      article.location_lat !== undefined &&
      article.location_lon !== null && 
      article.location_lon !== undefined &&
      !isNaN(article.location_lat) && 
      !isNaN(article.location_lon)
  );
  
  console.log(`[Map] Total articles: ${safeArticles.length}, Articles with coords: ${articlesWithCoords.length}`);
  console.log(`[Map] Articles assigned to Global:`, articlesWithCoords.filter(a => a.location_city === "Global" && a.location_lat === 0 && a.location_lon === 0).length);

  if (articlesWithCoords.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#2a1810] paper-texture">
        <div className="text-center text-[#e8dcc6]">
          <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No articles with location data</p>
          <p className="text-sm opacity-70 mt-2">Waiting for news from the wire...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full relative map-ocean-bg" 
      style={{ 
        minHeight: '100%',
        minWidth: '100%'
      }}
    >
      <MapContainer
        center={INITIAL_VIEW.center}
        zoom={INITIAL_VIEW.zoom}
        minZoom={1}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        className="sepia-map"
      >
        <MapStyle />
        <LogInitialView />
        <PanningController />
        <InitializeWorldView selectedArticleId={selectedArticleId} />
        <ResetMapView />
        <BoundsController 
          articles={articlesWithCoords} 
          selectedArticleId={selectedArticleId}
        />
        <PanToSelected 
          selectedArticleId={selectedArticleId} 
          articles={safeArticles}
          markerRefs={markerRefs}
        />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          noWrap={true}
        />
        <InfluenceLayer />
        <MapReady>
          {articlesWithCoords.map((article) => {
            const isSelected = selectedArticleId === article.id;
            return (
              <MarkerWithPopup
                key={article.id}
                article={article}
                isSelected={isSelected}
                onArticleSelect={onArticleSelect}
                markerRefs={markerRefs}
              />
            );
          })}
        </MapReady>
      </MapContainer>
    </div>
  );
}

