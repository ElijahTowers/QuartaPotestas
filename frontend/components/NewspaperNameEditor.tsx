"use client";

import { useState, useEffect } from "react";
import { useGame } from "@/context/GameContext";
import { Edit2, Check, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function NewspaperNameEditor() {
  const { newspaperName, setNewspaperName } = useGame();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(newspaperName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when global newspaperName changes
  useEffect(() => {
    if (!isEditing) {
      setName(newspaperName);
    }
  }, [newspaperName, isEditing]);

  const handleSave = async () => {
    // Clear previous error
    setError(null);
    
    const trimmedName = name.trim().toUpperCase();
    
    if (!trimmedName) {
      setError("Newspaper name cannot be empty");
      toast.error("Newspaper name cannot be empty");
      return;
    }

    if (trimmedName === newspaperName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await setNewspaperName(trimmedName);
      toast.success("Newspaper name updated successfully!");
      setIsEditing(false);
      setError(null);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update newspaper name";
      setError(errorMessage);
      toast.error(errorMessage);
      // Keep editing mode open so user can fix the issue
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(newspaperName);
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="bg-[#f9f6f0] p-6 rounded shadow-2xl border-2 border-[#8b6f47] relative">
      {/* Aged paper texture */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none rounded"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="relative z-10">
        <p className="text-sm text-[#8b6f47] mb-2 font-mono uppercase tracking-wider">
          Publication Name
        </p>
        
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                } else if (e.key === "Escape") {
                  handleCancel();
                }
              }}
              className={`flex-1 px-3 py-2 bg-white border rounded text-[#1a0f08] font-serif text-2xl font-bold focus:outline-none focus:ring-1 ${
                error 
                  ? "border-red-600 focus:border-red-600 focus:ring-red-600" 
                  : "border-[#8b6f47] focus:border-[#d4af37] focus:ring-[#d4af37]"
              }`}
              placeholder="Enter newspaper name"
              autoFocus
              disabled={isSaving}
              maxLength={50}
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-2 bg-green-700 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-[#1a0f08] font-serif flex-1">
              {newspaperName}
            </p>
            <button
              onClick={() => {
                setName(newspaperName);
                setError(null);
                setIsEditing(true);
              }}
              className="p-2 bg-[#8b6f47] hover:bg-[#a68a5a] text-white rounded transition-colors"
              title="Edit newspaper name"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {isEditing && error ? (
          <p className="text-xs text-red-700 mt-2 font-semibold">
            ⚠️ {error}
          </p>
        ) : (
          <p className="text-xs text-[#8b6f47] mt-2 italic">
            {isEditing 
              ? "Press Enter to save, Escape to cancel (max 50 characters)"
              : "Click edit to change your newspaper's name"}
          </p>
        )}
      </div>
    </div>
  );
}

