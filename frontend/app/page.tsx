"use client";

import { useEffect, useState } from "react";
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
import GridEditor from "@/components/GridEditor";
import AssistantAvatar from "@/components/AssistantAvatar";
import EditableTitle from "@/components/EditableTitle";
import { useEditorReactions } from "@/hooks/useEditorReactions";
import { useGame } from "@/context/GameContext";
import { Loader2, AlertCircle, Map as MapIcon, LayoutGrid, RefreshCw, ShoppingBag } from "lucide-react";
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
  const [dailyEdition, setDailyEdition] = useState<DailyEdition | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string>("");
  const [gridState, setGridState] = useState<any[]>(
    Array(16).fill(null).map(() => ({
      articleId: null,
      variant: null,
      isAd: false,
    }))
  );
  const [activeDragItem, setActiveDragItem] = useState<Article | null>(null);
  const [gridStats, setGridStats] = useState<{ cash: number; credibility: number }>({
    cash: 0,
    credibility: 50,
  });
  const [isShopOpen, setIsShopOpen] = useState(false);

  const placedItems = gridState.filter((c: any) => c && (c.articleId || c.isAd));
  const editor = useEditorReactions(placedItems, gridStats);
  const { newspaperName, setNewspaperName } = useGame();

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
    // reset grid since IDs/content can change after a fresh ingest
    setGridState(
      Array(16).fill(null).map(() => ({
        articleId: null,
        variant: null,
        isAd: false,
      }))
    );
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
    } else if (activeId.startsWith("grid-item-")) {
      // Handle grid item drag - find the article or ad being dragged
      const cellIndex = parseInt(activeId.replace("grid-item-", ""), 10);
      const cell = gridState[cellIndex];
      
      if (cell?.articleId) {
        const article = dailyEdition?.articles.find((a) => a.id === cell.articleId);
        if (article) {
          setActiveDragItem(article);
        }
      } else if (cell?.isAd && cell.adId) {
        // For ads, we could show a preview too, but for now just use the article preview
        // You might want to create a separate preview for ads
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

    // Scenario A: Wire to Grid (existing logic)
    if (activeId.startsWith("article-") && overId.startsWith("cell-")) {
      const articleId = parseInt(activeId.replace("article-", ""), 10);
      const cellIndex = parseInt(overId.replace("cell-", ""));
      
      // Update grid state
      const newGrid = [...gridState];
      newGrid[cellIndex] = {
        articleId,
        variant: "factual",
        isAd: false,
      };
      setGridState(newGrid);
      return;
    }

    // Scenario B: Grid to Grid (reordering/swapping)
    if (activeId.startsWith("grid-item-") && overId.startsWith("cell-")) {
      const sourceIndex = parseInt(activeId.replace("grid-item-", ""), 10);
      const targetIndex = parseInt(overId.replace("cell-", ""), 10);
      
      // If dragging to the same cell, do nothing
      if (sourceIndex === targetIndex) return;
      
      const newGrid = [...gridState];
      const sourceCell = newGrid[sourceIndex];
      const targetCell = newGrid[targetIndex];
      
      // Swap the items
      newGrid[sourceIndex] = targetCell;
      newGrid[targetIndex] = sourceCell;
      
      setGridState(newGrid);
    }
  };

  const handleGridChange = (grid: any[]) => {
    setGridState(grid);
  };

  // Filter articles to only show those NOT currently placed on the grid
  const availableArticles = dailyEdition?.articles.filter((article) => {
    // Check if this article is in any grid cell
    return !gridState.some((cell) => cell.articleId === article.id);
  }) || [];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-screen h-screen flex bg-[#2a1810] overflow-hidden">
        {/* Sidebar - The Wire */}
        <Wire
          articles={availableArticles}
          selectedArticleId={selectedArticleId}
          onArticleSelect={handleArticleSelect}
          viewMode={viewMode}
        />

        {/* Main Content Area */}
        <div className="flex-1 relative flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a0f08] bg-opacity-90 border-b border-[#8b6f47] p-4 paper-texture z-[1000]">
            <div className="flex items-center justify-between">
              <div>
                <EditableTitle
                  value={newspaperName}
                  onChange={setNewspaperName}
                  className="text-2xl font-bold text-[#e8dcc6] font-serif"
                />
                <p className="text-sm text-[#8b6f47] mt-1">
                  {viewMode === "map" ? "The War Room" : "Front Page Editor"}
                </p>
                <p className="text-sm text-[#8b6f47] mt-1">
                  Edition: {new Date(dailyEdition.date).toLocaleDateString()} •{" "}
                  {dailyEdition.articles.length} scoop{dailyEdition.articles.length !== 1 ? "s" : ""} • Mood:{" "}
                  {dailyEdition.global_mood || "Unknown"}
                </p>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={handleRefreshScoops}
                  disabled={isRefreshing}
                  className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                    isRefreshing
                      ? "bg-[#3a2418] text-[#8b6f47] opacity-60 cursor-not-allowed"
                      : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                  }`}
                  title="Trigger ingest and reload latest scoops"
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>{isRefreshing ? "Processing..." : "Fetch new scoops"}</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode("map");
                    setSelectedArticleId(null); // Clear selection when switching to map view
                  }}
                  className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                    viewMode === "map"
                      ? "bg-[#d4af37] text-[#1a0f08]"
                      : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Map
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                    viewMode === "grid"
                      ? "bg-[#d4af37] text-[#1a0f08]"
                      : "bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020]"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Grid
                </button>
                <button
                  onClick={() => setIsShopOpen(true)}
                  className="px-4 py-2 rounded transition-colors flex items-center gap-2 bg-[#3a2418] text-[#8b6f47] hover:bg-[#4a3020] border border-red-600/50 hover:border-red-500"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Shop
                </button>
              </div>
            </div>
            {refreshError && (
              <p className="text-xs text-red-400 mt-2">
                {refreshError}
              </p>
            )}
            {refreshProgress && (
              <div className="mt-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-[#d4af37] animate-spin" />
                <p className="text-xs text-[#d4af37] font-serif">
                  {refreshProgress}
                </p>
              </div>
            )}
          </div>

          {/* Progress Overlay */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-[#1a0f08] bg-opacity-95 z-[2000] flex items-center justify-center paper-texture">
              <div className="text-center max-w-md p-8">
                <Loader2 className="w-16 h-16 text-[#d4af37] animate-spin mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-[#e8dcc6] font-serif mb-4">
                  Fetching New Scoops
                </h2>
                {refreshProgress && (
                  <p className="text-lg text-[#d4af37] mb-2 font-serif">
                    {refreshProgress}
                  </p>
                )}
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
                <p className="text-sm text-[#8b6f47] mt-4 italic">
                  This may take a minute...
                </p>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "map" ? (
              <div className="w-full h-full">
                <Map
                  articles={dailyEdition?.articles || []}
                  selectedArticleId={selectedArticleId}
                  onArticleSelect={handleArticleSelect}
                />
              </div>
            ) : (
              <div className="w-full">
                <div className="px-4 pt-4">
                  <AssistantAvatar
                    message={editor.message}
                    mood={editor.mood}
                    isTalking={editor.isTalking}
                  />
                </div>
                <div className="w-full">
                  <GridEditor
                    articles={dailyEdition?.articles || []}
                    onGridChange={handleGridChange}
                    initialGrid={gridState}
                    onStatsChange={setGridStats}
                  />
                </div>
              </div>
            )}
          </div>
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
      <h3 className="font-bold text-sm mb-2 line-clamp-2 font-serif text-[#e8dcc6]">
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
