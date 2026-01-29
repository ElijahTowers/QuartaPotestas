"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Edit2, Check, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function UsernameEditor() {
  const { user, updateUsername } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when user changes
  useEffect(() => {
    if (!isEditing) {
      setUsername(user?.username || "");
    }
  }, [user?.username, isEditing]);

  const handleSave = async () => {
    // Clear previous error
    setError(null);
    
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError("Username cannot be empty");
      toast.error("Username cannot be empty");
      return;
    }

    if (trimmedUsername === user?.username) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateUsername(trimmedUsername);
      toast.success("Username updated successfully!");
      setIsEditing(false);
      setError(null);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update username";
      setError(errorMessage);
      toast.error(errorMessage);
      // Keep editing mode open so user can fix the issue
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setUsername(user?.username || "");
    setIsEditing(false);
    setError(null);
  };

  if (!user) return null;

  const displayUsername = user.username || user.email?.split("@")[0] || "User";

  return (
    <div className="bg-[#f9f6f0] p-4 rounded shadow-lg border-2 border-[#8b6f47] relative">
      {/* Aged paper texture */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none rounded"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="relative z-10">
        <p className="text-sm text-[#8b6f47] mb-2 font-mono uppercase tracking-wider">
          Username
        </p>
        
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                } else if (e.key === "Escape") {
                  handleCancel();
                }
              }}
              className={`flex-1 px-3 py-2 bg-white border rounded text-[#1a0f08] font-serif focus:outline-none focus:ring-1 ${
                error 
                  ? "border-red-600 focus:border-red-600 focus:ring-red-600" 
                  : "border-[#8b6f47] focus:border-[#d4af37] focus:ring-[#d4af37]"
              }`}
              placeholder="Enter username"
              autoFocus
              disabled={isSaving}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
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
            <p className="text-xl font-bold text-[#1a0f08] font-serif flex-1">
              {displayUsername}
            </p>
            <button
              onClick={() => {
                setUsername(user.username || user.email?.split("@")[0] || "");
                setError(null);
                setIsEditing(true);
              }}
              className="p-2 bg-[#8b6f47] hover:bg-[#a68a5a] text-white rounded transition-colors"
              title="Edit username"
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
              ? "Letters, numbers, and underscores only (3-30 characters)"
              : "Click edit to change your username"}
          </p>
        )}
      </div>
    </div>
  );
}

