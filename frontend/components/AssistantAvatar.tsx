import React from "react";

type Mood = "neutral" | "angry" | "happy";

interface AssistantAvatarProps {
  message: string;
  mood: Mood;
  isTalking: boolean;
}

function moodEmoji(mood: Mood): string {
  switch (mood) {
    case "happy":
      return "🤑";
    case "angry":
      return "🤬";
    case "neutral":
    default:
      return "🚬";
  }
}

export default function AssistantAvatar({ message, mood, isTalking }: AssistantAvatarProps) {
  const emoji = moodEmoji(mood);
  const ringClass =
    mood === "happy"
      ? "border-green-500"
      : mood === "angry"
        ? "border-red-600"
        : "border-[#8b6f47]";

  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-20 h-20 rounded-full border-2 ${ringClass} bg-[#2a1810] flex items-center justify-center shadow-lg`}
        aria-label="Editor in Chief avatar"
      >
        <span className={`text-4xl leading-none ${isTalking ? "shake-talk" : ""}`}>
          {emoji}
        </span>
      </div>

      <div className="relative max-w-[520px]">
        <div className="bg-[#2a1810] border-2 border-[#8b6f47] rounded-lg px-4 py-3 shadow-lg paper-texture">
          <p className="text-sm text-[#e8dcc6] font-mono">{message}</p>
        </div>
        {/* bubble tail */}
        <div className="absolute left-[-8px] top-6 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-[#8b6f47]" />
        <div className="absolute left-[-6px] top-6 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-r-[7px] border-r-[#2a1810]" />
      </div>
    </div>
  );
}

