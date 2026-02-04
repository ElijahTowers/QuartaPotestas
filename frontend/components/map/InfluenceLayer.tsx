"use client";

import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "@/context/AuthContext";

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: any;
  id?: string;
}

interface GeoJSONData {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// Mapping from 3-letter ISO codes (ISO 3166-1 alpha-3) to 2-letter ISO codes (ISO 3166-1 alpha-2)
// This is needed because the GeoJSON uses 3-letter codes in feature.id
const ISO3_TO_ISO2: Record<string, string> = {
  "AFG": "AF", "ALB": "AL", "DZA": "DZ", "ASM": "AS", "AND": "AD", "AGO": "AO", "AIA": "AI", "ATA": "AQ",
  "ATG": "AG", "ARG": "AR", "ARM": "AM", "ABW": "AW", "AUS": "AU", "AUT": "AT", "AZE": "AZ", "BHS": "BS",
  "BHR": "BH", "BGD": "BD", "BRB": "BB", "BLR": "BY", "BEL": "BE", "BLZ": "BZ", "BEN": "BJ", "BMU": "BM",
  "BTN": "BT", "BOL": "BO", "BIH": "BA", "BWA": "BW", "BVT": "BV", "BRA": "BR", "IOT": "IO", "BRN": "BN",
  "BGR": "BG", "BFA": "BF", "BDI": "BI", "KHM": "KH", "CMR": "CM", "CAN": "CA", "CPV": "CV", "CYM": "KY",
  "CAF": "CF", "TCD": "TD", "CHL": "CL", "CHN": "CN", "CXR": "CX", "CCK": "CC", "COL": "CO", "COM": "KM",
  "COG": "CG", "COD": "CD", "COK": "CK", "CRI": "CR", "CIV": "CI", "HRV": "HR", "CUB": "CU", "CYP": "CY",
  "CZE": "CZ", "DNK": "DK", "DJI": "DJ", "DMA": "DM", "DOM": "DO", "ECU": "EC", "EGY": "EG", "SLV": "SV",
  "GNQ": "GQ", "ERI": "ER", "EST": "EE", "ETH": "ET", "FLK": "FK", "FRO": "FO", "FJI": "FJ", "FIN": "FI",
  "FRA": "FR", "GUF": "GF", "PYF": "PF", "ATF": "TF", "GAB": "GA", "GMB": "GM", "GEO": "GE", "DEU": "DE",
  "GHA": "GH", "GIB": "GI", "GRC": "GR", "GRL": "GL", "GRD": "GD", "GLP": "GP", "GUM": "GU", "GTM": "GT",
  "GGY": "GG", "GIN": "GN", "GNB": "GW", "GUY": "GY", "HTI": "HT", "HMD": "HM", "VAT": "VA", "HND": "HN",
  "HKG": "HK", "HUN": "HU", "ISL": "IS", "IND": "IN", "IDN": "ID", "IRN": "IR", "IRQ": "IQ", "IRL": "IE",
  "IMN": "IM", "ISR": "IL", "ITA": "IT", "JAM": "JM", "JPN": "JP", "JEY": "JE", "JOR": "JO", "KAZ": "KZ",
  "KEN": "KE", "KIR": "KI", "PRK": "KP", "KOR": "KR", "KWT": "KW", "KGZ": "KG", "LAO": "LA", "LVA": "LV",
  "LBN": "LB", "LSO": "LS", "LBR": "LR", "LBY": "LY", "LIE": "LI", "LTU": "LT", "LUX": "LU", "MAC": "MO",
  "MKD": "MK", "MDG": "MG", "MWI": "MW", "MYS": "MY", "MDV": "MV", "MLI": "ML", "MLT": "MT", "MHL": "MH",
  "MTQ": "MQ", "MRT": "MR", "MUS": "MU", "MYT": "YT", "MEX": "MX", "FSM": "FM", "MDA": "MD", "MCO": "MC",
  "MNG": "MN", "MNE": "ME", "MSR": "MS", "MAR": "MA", "MOZ": "MZ", "MMR": "MM", "NAM": "NA", "NRU": "NR",
  "NPL": "NP", "NLD": "NL", "NCL": "NC", "NZL": "NZ", "NIC": "NI", "NER": "NE", "NGA": "NG", "NIU": "NU",
  "NFK": "NF", "MNP": "MP", "NOR": "NO", "OMN": "OM", "PAK": "PK", "PLW": "PW", "PSE": "PS", "PAN": "PA",
  "PNG": "PG", "PRY": "PY", "PER": "PE", "PHL": "PH", "PCN": "PN", "POL": "PL", "PRT": "PT", "PRI": "PR",
  "QAT": "QA", "REU": "RE", "ROU": "RO", "RUS": "RU", "RWA": "RW", "SHN": "SH", "KNA": "KN", "LCA": "LC",
  "SPM": "PM", "VCT": "VC", "WSM": "WS", "SMR": "SM", "STP": "ST", "SAU": "SA", "SEN": "SN", "SRB": "RS",
  "SYC": "SC", "SLE": "SL", "SGP": "SG", "SVK": "SK", "SVN": "SI", "SLB": "SB", "SOM": "SO", "ZAF": "ZA",
  "SGS": "GS", "SSD": "SS", "ESP": "ES", "LKA": "LK", "SDN": "SD", "SUR": "SR", "SJM": "SJ", "SWZ": "SZ",
  "SWE": "SE", "CHE": "CH", "SYR": "SY", "TWN": "TW", "TJK": "TJ", "TZA": "TZ", "THA": "TH", "TLS": "TL",
  "TGO": "TG", "TKL": "TK", "TON": "TO", "TTO": "TT", "TUN": "TN", "TUR": "TR", "TKM": "TM", "TCA": "TC",
  "TUV": "TV", "UGA": "UG", "UKR": "UA", "ARE": "AE", "GBR": "GB", "USA": "US", "UMI": "UM", "URY": "UY",
  "UZB": "UZ", "VUT": "VU", "VEN": "VE", "VNM": "VN", "VGB": "VG", "VIR": "VI", "WLF": "WF", "ESH": "EH",
  "YEM": "YE", "ZMB": "ZM", "ZWE": "ZW",
};

export function InfluenceLayer() {
  const { user } = useAuth();
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [articleCounts, setArticleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Fetch GeoJSON data
  useEffect(() => {
    const fetchGeoJSON = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
        );
        const data = await response.json();
        setGeoData(data);
        
        // GeoJSON loaded successfully
      } catch (error) {
        console.error("Failed to fetch GeoJSON:", error);
      }
    };

    fetchGeoJSON();
  }, []);

  // Fetch articles and aggregate by country_code from backend API
  useEffect(() => {
    const fetchArticles = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get authentication token
        let token: string | null = null;
        try {
          const { getPocketBase } = await import("@/lib/pocketbase");
          const pb = getPocketBase();
          token = pb.authStore.token;
        } catch (e) {
          token = localStorage.getItem("token");
        }

        if (!token) {
          setLoading(false);
          return;
        }

        // Call backend API endpoint instead of direct PocketBase
        // Use the proper backend URL based on where we're accessing from
        let apiUrl: string;
        if (typeof window !== "undefined") {
          const hostname = window.location.hostname;
          // Use API proxy for production domain or Cloudflare tunnels
          if (hostname === "quartapotestas.com" || hostname === "www.quartapotestas.com" || hostname.includes("trycloudflare.com")) {
            apiUrl = "/api/proxy/influence";
          } else if (hostname === "localhost" || hostname === "127.0.0.1") {
            apiUrl = "http://localhost:8000/api/influence";
          } else {
            apiUrl = `http://${hostname}:8000/api/influence`;
          }
        } else {
          apiUrl = "http://localhost:8000/api/influence";
        }
        
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          credentials: "omit",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch influence stats: ${response.status}`);
        }

        const counts = await response.json();
        
        // Normalize country codes to uppercase for matching
        const normalizedCounts: Record<string, number> = {};
        for (const [code, count] of Object.entries(counts)) {
          normalizedCounts[code.toUpperCase()] = count as number;
        }
        
        setArticleCounts(normalizedCounts);
      } catch (error: any) {
        // Handle errors gracefully
        console.error("[InfluenceLayer] Failed to fetch articles:", error);
        setArticleCounts({}); // Set empty on error
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [user]);

  // Color scale function based on article count
  const getCountryColor = (countryCode: string): string => {
    const count = articleCounts[countryCode] || 0;

    if (count === 0) {
      return "transparent";
    } else if (count <= 2) {
      return "#e6d5ac"; // Faint Sepia/Paper
    } else if (count <= 5) {
      return "#d4a373"; // Rust/Orange
    } else if (count <= 10) {
      return "#a44a3f"; // Dark Red
    } else {
      return "#2f2f2f"; // Deep Black/Charcoal - Total Control
    }
  };

  // Helper function to extract and normalize country code from GeoJSON feature
  const getCountryCode = (feature: GeoJSONFeature): string => {
    // Try to extract country code from feature properties (prefer 2-letter codes)
    // Different GeoJSON sources use different property names
    let countryCode =
      feature.properties?.["ISO_A2"] ||
      feature.properties?.["iso_a2"] ||
      feature.properties?.["ISO2"] ||
      feature.properties?.["iso2"] ||
      feature.properties?.["ISO"] ||
      feature.properties?.["iso"] ||
      feature.id ||
      "XX";
    
    // Normalize to uppercase for matching
    countryCode = countryCode.toUpperCase();
    
    // If we got a 3-letter code (from feature.id), convert it to 2-letter code
    if (countryCode.length === 3 && ISO3_TO_ISO2[countryCode]) {
      countryCode = ISO3_TO_ISO2[countryCode];
    }
    
    return countryCode;
  };

  // Style function for GeoJSON
  const style = (feature: GeoJSONFeature | undefined) => {
    if (!feature) return {};

    const countryCode = getCountryCode(feature);
    const count = articleCounts[countryCode] || 0;
    const color = getCountryColor(countryCode);

    return {
      fillColor: color,
      weight: 1,
      opacity: 0.7,
      color: "#333",
      fillOpacity: count === 0 ? 0 : 0.7,
      dashArray: "3",
    };
  };

  // Helper function to get smart center for popup positioning
  // For MultiPolygon countries (like USA with Alaska/Hawaii), finds the largest polygon (main landmass)
  const getSmartCenter = (feature: GeoJSONFeature, layer: L.Layer): L.LatLng => {
    const geometry = feature.geometry;
    
    // Check if it's a MultiPolygon (countries with multiple disconnected territories)
    if (geometry.type === "MultiPolygon") {
      const coordinates = geometry.coordinates as number[][][][];
      
      // Find the largest polygon by coordinate count (largest = main landmass)
      let largestPolygon: number[][][] | null = null;
      let maxCoordinateCount = 0;
      
      for (const polygonGroup of coordinates) {
        for (const polygon of polygonGroup) {
          const coordinateCount = polygon.length;
          if (coordinateCount > maxCoordinateCount) {
            maxCoordinateCount = coordinateCount;
            largestPolygon = [polygon]; // Wrap in array to match Polygon format
          }
        }
      }
      
      if (largestPolygon && largestPolygon[0]) {
        // Convert GeoJSON coordinates [lng, lat] to Leaflet LatLng [lat, lng]
        const latLngs = largestPolygon[0].map((coord: number[]) => 
          L.latLng(coord[1], coord[0])
        );
        
        // Create a temporary polygon to get its bounds center
        const tempPolygon = L.polygon(latLngs);
        return tempPolygon.getBounds().getCenter();
      }
    }
    
    // For simple Polygon or if MultiPolygon processing failed, use layer bounds center
    if (layer.getBounds) {
      return layer.getBounds().getCenter();
    }
    
    // Fallback: return a default center (shouldn't happen)
    return L.latLng(0, 0);
  };

  // Hover and popup function
  const onEachFeature = (
    feature: GeoJSONFeature,
    layer: L.Layer
  ) => {
    const countryCode = getCountryCode(feature);
    const countryName = feature.properties?.name || countryCode;
    const count = articleCounts[countryCode] || 0;

    const popupText = `<div style="text-align: center; font-family: serif;">
      <strong>${countryName}</strong><br/>
      ${count} Published Article${count !== 1 ? "s" : ""}
    </div>`;

    // Bind popup with autoPan disabled to prevent map from panning when popup opens
    // className makes popup transparent to mouse events to prevent hover flickering
    layer.bindPopup(popupText, {
      autoPan: false, // Disable automatic panning when popup opens
      autoPanPadding: [0, 0], // No padding needed since we're not auto-panning
      className: "no-pointer-events-popup", // Make popup transparent to mouse events
    });

    // Track timeout for delayed popup close and popup state
    let closeTimeout: NodeJS.Timeout | null = null;
    let isPopupOpen = false;

    // Add hover effect
    layer.on("mouseover", function () {
      // Cancel any pending close operation
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      
      (layer as any).setStyle({
        fillOpacity: 0.9,
        weight: 2,
      });
      
      // Get smart center (main landmass for MultiPolygon countries)
      const center = getSmartCenter(feature, layer);
      
      // Open popup at the smart center position
      layer.openPopup(center);
      isPopupOpen = true;
    });

    layer.on("mouseout", function (e: L.LeafletMouseEvent) {
      // Reset style immediately to prevent countries from staying highlighted
      (layer as any).setStyle({
        fillOpacity: count === 0 ? 0 : 0.7,
        weight: 1,
      });
      
      // Add a delay before closing popup to allow mouse to move over popup
      // This prevents flickering when mouse moves from country to popup
      closeTimeout = setTimeout(() => {
        // Double-check that popup is still open and mouse hasn't re-entered
        if (isPopupOpen) {
          layer.closePopup();
          isPopupOpen = false;
        }
        closeTimeout = null;
      }, 300); // 300ms delay - gives time to move mouse to popup
    });

    // Also listen to popup close event to update state
    layer.on("popupclose", function () {
      isPopupOpen = false;
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
    });
  };

  if (!geoData) {
    return null; // Waiting for GeoJSON to load
  }

  // Create a key based on articleCounts to force re-render when counts change
  // This ensures all countries reset to base style (weight: 1) when data updates
  const geoJsonKey = JSON.stringify(articleCounts);

  return (
    <GeoJSON
      key={geoJsonKey}
      data={geoData}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}
