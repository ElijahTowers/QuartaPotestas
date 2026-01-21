"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DailyEdition, Article } from "@/types/api";
import { fetchLatestArticles, resetAndIngest } from "@/lib/api";
import Wire from "@/components/Wire";
import GameLayout from "@/components/GameLayout";
import Assistant from "@/components/Assistant";
import { Loader2, AlertCircle } from "lucide-react";
import ShopModal from "@/components/ShopModal";

// Dynamically import Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#2a1810]">
      <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
    </div>
  ),
});

type ViewMode = "map" | "grid";

export default function Home() {
  const router = useRouter();
  const [dailyEdition, setDailyEdition] = useState<DailyEdition | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string>("");
  const [activeDragItem, setActiveDragItem] = useState<Article | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [subtitleIndex, setSubtitleIndex] = useState(0);

  // Thematic subtitle messages
  const wireSubtitles = [
    "Triangulating signal sources...",
    "Bypassing Ministry firewalls...",
    "Listening to police scanners...",
    "Deciphering encrypted cables...",
    "Bribing field informants...",
    "Filtering state propaganda...",
  ];

  // Cycle through subtitles every 2.5 seconds when refreshing
  useEffect(() => {
    if (!isRefreshing) {
      setSubtitleIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setSubtitleIndex((prev) => (prev + 1) % wireSubtitles.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isRefreshing, wireSubtitles.length]);

  // Redirect to editor when grid mode is selected
  useEffect(() => {
    if (viewMode === "grid") {
      router.push('/editor');
    }
  }, [viewMode, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Minimum distance (in pixels) the pointer must move before drag activates
        // This allows clicks to register immediately while requiring intentional movement for drag
      },
    })
  );

  useEffect(() => {
    async function loadArticles() {
      try {
        setLoading(true);
        setError(null);
        const edition = await fetchLatestArticles();
        setDailyEdition(edition);
        // Do NOT auto-select - user must explicitly click to select
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load articles";
        setError(errorMessage);
        console.error("Error loading articles:", err);
        // Log more details for debugging
        if (err instanceof Error) {
          console.error("Error details:", {
            message: err.message,
            stack: err.stack,
          });
        }
      } finally {
        setLoading(false);
      }
    }

    loadArticles();
  }, []);

  const handleArticleSelect = (articleId: number) => {
    setSelectedArticleId(articleId);
  };

  const reloadLatest = async () => {
    const edition = await fetchLatestArticles();
    setDailyEdition(edition);
    // Do NOT auto-select - keep current selection (or null)
    // Grid functionality moved to /editor page
  };

  const handleRefreshScoops = async () => {
    try {
      setIsRefreshing(true);
      setRefreshError(null);
      setRefreshProgress("Deleting existing articles...");
      
      // Small delay to show the first message
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setRefreshProgress("Fetching new articles from RSS feed...");
      const result = await resetAndIngest();
      
      setRefreshProgress("Processing articles with AI...");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setRefreshProgress("Geocoding locations...");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setRefreshProgress("Loading new scoops...");
      await reloadLatest();
      
      setRefreshProgress("Complete!");
      // Clear progress message after a short delay
      setTimeout(() => {
        setRefreshProgress("");
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setRefreshError(msg);
      setRefreshProgress("");
      console.error("Failed to refresh scoops:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#2a1810] paper-texture">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mx-auto mb-4" />
          <p className="text-[#e8dcc6] text-lg">Loading the War Room...</p>
          <p className="text-[#8b6f47] text-sm mt-2">Fetching today's headlines</p>
        </div>
      </div>
    );
  }

  if (error || !dailyEdition) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#2a1810] paper-texture">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-[#e8dcc6] text-lg mb-2">Failed to load articles</p>
          <p className="text-[#8b6f47] text-sm">{error || "No daily edition found"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#8b6f47] text-[#e8dcc6] rounded hover:bg-[#a68a5a] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    
    // Extract article ID from the drag ID (format: "article-{id}" or "grid-item-{index}")
    if (activeId.startsWith("article-")) {
      const articleId = parseInt(activeId.replace("article-", ""), 10);
      const article = dailyEdition?.articles.find((a) => a.id === articleId);
      if (article) {
        setActiveDragItem(article);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Reset active drag item
    setActiveDragItem(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Grid drag & drop functionality moved to /editor page
  };

  // Filter articles - no grid filtering needed since grid moved to /editor
  const availableArticles = dailyEdition?.articles || [];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex overflow-hidden bg-[#2a1810]">
        {/* Left Panel - The Wire */}
        <div className="h-full flex flex-col bg-[#1a0f08] border-r-2 border-[#8b6f47] paper-texture overflow-hidden flex-shrink-0 w-80">
          {/* Header with Assistant */}
          <div className="bg-[#2a1810] border-b border-[#8b6f47] p-4 flex-shrink-0">
            <div className="mb-3">
              <Assistant mood="neutral" viewMode="map" />
            </div>
            {refreshError && (
              <p className="text-xs text-red-400 mb-2">{refreshError}</p>
            )}
            {refreshProgress && (
              <div className="mb-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-[#d4af37] animate-spin" />
                <p className="text-xs text-[#d4af37] font-serif">{refreshProgress}</p>
              </div>
            )}
          </div>

          {/* Wire Content */}
          <div className="flex-1 overflow-y-auto">
            <Wire
              articles={availableArticles}
              selectedArticleId={selectedArticleId}
              onArticleSelect={handleArticleSelect}
              viewMode={viewMode}
              showHeader={false}
            />
          </div>
        </div>

        {/* Main Content Area with GameLayout */}
        <div className="flex-1 relative">
          {/* Progress Overlay */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-[#1a0f08] bg-opacity-95 z-[2000] flex items-center justify-center paper-texture">
              <div className="text-center max-w-md p-8">
                <Loader2 className="w-16 h-16 text-[#d4af37] animate-spin mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-[#e8dcc6] font-serif mb-4 tracking-wider">
                  INTERCEPTING THE WIRE
                </h2>
                <p className="text-lg text-[#d4af37] mb-2 font-mono flex items-center justify-center gap-1">
                  <span>{wireSubtitles[subtitleIndex]}</span>
                  <span className="inline-block w-2 h-5 bg-[#d4af37] animate-cursor-blink" />
                </p>
                <div className="mt-6 w-full bg-[#2a1810] rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#d4af37] h-full transition-all duration-500"
                    style={{
                      width: refreshProgress.includes("Complete") ? "100%" : 
                             refreshProgress.includes("Loading") ? "90%" :
                             refreshProgress.includes("Geocoding") ? "70%" :
                             refreshProgress.includes("Processing") ? "50%" :
                             refreshProgress.includes("Fetching") ? "30%" : "10%"
                    }}
                  />
                </div>
                <p className="text-sm text-[#8b6f47] mt-4 italic font-mono">
                  Stand by for transmission...
                </p>
              </div>
            </div>
          )}

          <GameLayout
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              setViewMode(mode);
              if (mode === "map") {
                setSelectedArticleId(null);
              }
            }}
            onRefreshScoops={handleRefreshScoops}
            onOpenShop={() => setIsShopOpen(true)}
            isRefreshing={isRefreshing}
            refreshError={refreshError}
            refreshProgress={refreshProgress}
            editionInfo={{
              date: dailyEdition.date,
              articleCount: dailyEdition.articles.length,
              globalMood: dailyEdition.global_mood,
            }}
          >
            {viewMode === "map" && (
              <div className="w-full h-full map-ocean-bg">
                <Map
                  articles={dailyEdition?.articles || []}
                  selectedArticleId={selectedArticleId}
                  onArticleSelect={handleArticleSelect}
                />
              </div>
            )}
          </GameLayout>
        </div>
      </div>
      
      {/* Drag Overlay */}
      <DragOverlay
        style={{
          cursor: "grabbing",
          pointerEvents: "none",
        }}
        zIndex={9999}
      >
        {activeDragItem ? (
          <ArticleDragPreview article={activeDragItem} />
        ) : null}
      </DragOverlay>

      {/* Shop Modal */}
      <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
    </DndContext>
  );
}

// Component for the drag preview overlay
function ArticleDragPreview({ article }: { article: Article }) {
  return (
    <div
      className="w-64 p-3 rounded border bg-[#3a2418] border-[#8b6f47] shadow-2xl opacity-90 transform rotate-2"
      style={{
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      <h3 className="font-bold text-sm mb-2 font-serif text-[#e8dcc6]">
        {article.original_title}
      </h3>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {article.location_city && (
          <div className="flex items-center gap-1 text-xs text-[#8b6f47]">
            <span>{article.location_city}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-[#8b6f47]">
          <span className="capitalize">{article.tags.sentiment}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {article.tags.topic_tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-[#8b6f47] bg-opacity-30 text-[#d4af37] text-xs rounded border border-[#8b6f47]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
