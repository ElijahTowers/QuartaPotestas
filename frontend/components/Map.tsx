"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { Article } from "@/types/api";
import { MapPin, Globe } from "lucide-react";

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
  selectedArticleId: number | null;
  onArticleSelect: (articleId: number) => void;
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
  selectedArticleId: number | null; 
  articles: Article[];
  markerRefs: React.MutableRefObject<globalThis.Map<number, L.Marker>>;
}) {
  const map = useMap();
  
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
    if (selectedArticleId === null) {
      console.log(`[PanToSelected] selectedArticleId is null, returning early`);
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
    
    // For global articles, we don't need coordinates - we'll use (0, 0)
    const locationCity = selectedArticle.location_city?.trim().toLowerCase() || "";
    const isGlobal = locationCity === "global" || 
                     locationCity === "world" ||
                     locationCity === "worldwide";
    
    console.log(`[PanToSelected] Location check - locationCity: "${locationCity}", isGlobal: ${isGlobal}`);
    
    if (isGlobal) {
      // For global articles, use the same view as World View button
      const zoomLevel = 1.5; // World view for global articles (wider to show Greenland and all continents)
      const centerLat = 20; // Center of world (same as World View button)
      const centerLon = 0;
      console.log(`[PanToSelected] Global article detected: "${selectedArticle.location_city}" - zooming to world view (${centerLat}, ${centerLon}) at zoom ${zoomLevel}`);
      
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
      const markerRef = markerRefs.current.get(selectedArticleId);
      if (markerRef) {
        setTimeout(() => {
          markerRef.openPopup();
        }, 600); // Wait 600ms for the pan animation to start
      }
      return;
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
    const markerRef = markerRefs.current.get(selectedArticleId);
    if (markerRef) {
      setTimeout(() => {
        markerRef.openPopup();
      }, 600); // Wait 600ms for the pan animation to start
    }
  }, [selectedArticleId, articles, map, markerRefs]);
  
  return null;
}

// Component to initialize/reset map to world view
function InitializeWorldView({ selectedArticleId }: { selectedArticleId: number | null }) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const lastSelectedId = useRef<number | null>(null);
  
  const resetToWorldView = () => {
    map.flyTo(
      [20, 0], // Center of world
      1.5, // Zoom level for world view (wider to show Greenland and all continents)
      {
        duration: 1.0,
      }
    );
  };
  
  // On initial mount, always go to world view
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      lastSelectedId.current = selectedArticleId;
      resetToWorldView();
    }
  }, []); // Only run on mount
  
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

// Component to reset map view to world view (button)
function ResetMapView() {
  const map = useMap();
  
  const resetToWorldView = () => {
    map.flyTo(
      [20, 0], // Center of world
      1.5, // Zoom level for world view (wider to show Greenland and all continents)
      {
        duration: 1.0,
      }
    );
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
  onArticleSelect: (articleId: number) => void;
  markerRefs: React.MutableRefObject<globalThis.Map<number, L.Marker>>;
}) {
  const markerRef = useRef<L.Marker>(null);
  
  useEffect(() => {
    if (markerRef.current) {
      markerRefs.current.set(article.id, markerRef.current);
      
      return () => {
        markerRefs.current.delete(article.id);
      };
    }
  }, [article.id, markerRefs]);
  
  const isGlobal = article.location_city?.toLowerCase() === "global";
  
  return (
    <Marker
      ref={markerRef}
      position={[article.location_lat!, article.location_lon!]}
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

export default function Map(props: MapProps) {
  // Destructure with defaults to prevent undefined errors
  const { 
    articles = [], 
    selectedArticleId = null, 
    onArticleSelect = () => {} 
  } = props || {};
  
  // Store marker refs to control popups programmatically
  // Use global Map to avoid naming conflict with component name
  const markerRefs = useRef<globalThis.Map<number, L.Marker>>(new globalThis.Map());
  
  // Safety check: ensure articles is an array
  const safeArticles = articles || [];

  // Filter articles with valid coordinates
  const articlesWithCoords = safeArticles.filter(
    (article) => article.location_lat !== null && article.location_lon !== null
  );

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
    <div className="w-full h-full relative">
      <MapContainer
        center={[20, 0]}
        zoom={1.5}
        minZoom={2}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        className="sepia-map"
      >
        <MapStyle />
        <InitializeWorldView selectedArticleId={selectedArticleId} />
        <ResetMapView />
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
      </MapContainer>
    </div>
  );
}

