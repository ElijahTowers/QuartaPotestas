import { useEffect, useMemo, useState } from "react";

type Mood = "neutral" | "angry" | "happy";

interface EditorStats {
  cash: number;
  credibility: number;
}

export function useEditorReactions(
  placedItems: unknown[],
  stats: EditorStats
): { message: string; mood: Mood; isTalking: boolean } {
  const reaction = useMemo(() => {
    if (stats.cash > 2000) {
      return {
        mood: "happy" as const,
        message: "We're rich! Print whatever you want!",
      };
    }

    if (stats.credibility < 20) {
      return {
        mood: "angry" as const,
        message: "Nobody trusts us! We are a joke!",
      };
    }

    if (!placedItems || placedItems.length === 0) {
      return {
        mood: "neutral" as const,
        message:
          "Drag scoops from The Wire on the left to build your page. Don't forget to add Ads for money!",
      };
    }

    return {
      mood: "neutral" as const,
      message: "Keep pushing. We need more scoops.",
    };
  }, [placedItems, stats.cash, stats.credibility]);

  const [isTalking, setIsTalking] = useState(false);

  useEffect(() => {
    setIsTalking(true);
    const t = setTimeout(() => setIsTalking(false), 2000);
    return () => clearTimeout(t);
  }, [reaction.message]);

  return { ...reaction, isTalking };
}


