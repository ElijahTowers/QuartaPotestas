"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type Phase = "sealed" | "opening" | "revealing" | "selection" | "outro";
type OutroStage = "discard" | "stamp" | "intake";

export interface CardPackOpeningProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim?: (card: { id: string; name: string; image: string }) => void;
  packImageSrc?: string; // e.g. "/Trading_Cards/Pack_Art/Pack_1.png"
  cardBackSrc?: string; // e.g. "/Trading_Cards/Card_Back_1.png"
}

type SfxName = "pack_hover" | "pack_rip" | "cards_slide" | "flip" | "claim";

function dispatchSfx(name: SfxName) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("card-pack-sfx", { detail: { name } }));
}

const DEFAULT_PACK = "/Trading_Cards/Pack_Art/Pack_1.png";
const DEFAULT_BACK = "/Trading_Cards/Card_Back_1.png";

// Mock card pool (paths under frontend/public/Trading_Cards)
const cards = [
  { id: "euro_correspondent", name: "Euro Correspondent", image: "/Trading_Cards/Euro_Correspondent.png" },
  { id: "mandatory_advising", name: "Mandatory Advising", image: "/Trading_Cards/Mandatory_Advising.png" },
  { id: "financial_watchdog", name: "Financial Watchdog", image: "/Trading_Cards/Financial_Watchdog.jpg" },
];

function sample3<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

// Stamp overlay component
function AssetStamp({ isVisible }: { isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ scale: 2.5, opacity: 0, rotate: -12 }}
          animate={{ 
            scale: [2.5, 1.1, 1],
            opacity: [0, 1, 1],
            rotate: [-12, -12, -12],
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.4,
            times: [0, 0.3, 1],
            ease: [0.34, 1.56, 0.64, 1], // Bounce effect
          }}
        >
          <motion.div
            className="relative px-8 py-6 border-4 border-red-800 bg-red-900/20"
            style={{
              borderStyle: "dashed",
              borderWidth: "6px",
              clipPath: "polygon(2% 0%, 98% 0%, 100% 2%, 100% 98%, 98% 100%, 2% 100%, 0% 98%, 0% 2%)",
            }}
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 0.15,
              repeat: 2,
              ease: "easeInOut",
            }}
          >
            <div className="text-red-800 font-black text-2xl md:text-3xl tracking-wider uppercase font-mono text-center">
              ASSET
              <br />
              ACQUIRED
            </div>
            {/* Grunge texture overlay */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
                mixBlendMode: "multiply",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card3D({
  frontSrc,
  backSrc,
  revealed,
  selected,
  dimmed,
  angle,
  x,
  y,
  zIndex,
  onClick,
  outroStage,
  isDiscarded,
  isIntaking,
}: {
  frontSrc: string;
  backSrc: string;
  revealed: boolean;
  selected: boolean;
  dimmed: boolean;
  angle: number;
  x: number;
  y: number;
  zIndex: number;
  onClick: () => void;
  outroStage?: OutroStage | null;
  isDiscarded?: boolean;
  isIntaking?: boolean;
}) {
  // Calculate animation values based on outro stage
  const getAnimationProps = () => {
    if (typeof window === "undefined") {
      // SSR fallback
      return { x, y, rotate: angle, scale: 1 };
    }

    if (isDiscarded) {
      // Stage 1: Brutal discard - drop off screen
      return {
        y: window.innerHeight + 200,
        opacity: 0,
        rotate: angle + (Math.random() * 30 - 15), // Random rotation
        scale: 0.3,
      };
    }
    
    if (isIntaking) {
      // Stage 3: Mechanical intake - shrink to bottom-left corner of viewport
      // Calculate position relative to viewport center (where cards are)
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      const targetX = -viewportCenterX + 80; // 80px from left edge
      const targetY = viewportCenterY - 80; // 80px from bottom edge
      return {
        x: targetX,
        y: targetY,
        scale: 0.15,
        opacity: 0,
        rotate: 0,
      };
    }
    
    if (outroStage === "stamp" && selected) {
      // Stage 2: Move to center and scale up
      // Center more precisely to ensure full visibility when scaled
      // Position higher to account for scale and ensure card is fully visible
      return {
        x: 0,
        y: -100, // Move higher to center better and ensure full visibility
        rotate: 0,
        scale: 1.2, // Slightly smaller scale to ensure it fits within viewport
        zIndex: 100,
      };
    }
    
    // Default fan position
    return {
      x,
      y,
      rotate: angle,
      scale: selected ? 1.05 : 1,
    };
  };

  const animProps = getAnimationProps();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={[
        "relative w-[200px] h-[300px] md:w-[220px] md:h-[330px] rounded-lg outline-none",
        "shadow-2xl border border-[#8b6f47]/70 bg-black/20",
        "focus:ring-2 focus:ring-[#d4af37]/70",
        dimmed && !isDiscarded ? "opacity-35 saturate-50" : "opacity-100",
      ].join(" ")}
      style={{ zIndex: animProps.zIndex || zIndex }}
      initial={{ x: 0, y: 0, rotate: 0, scale: 0.98, opacity: 0 }}
      animate={{
        x: animProps.x,
        y: animProps.y,
        rotate: animProps.rotate,
        opacity: animProps.opacity !== undefined ? animProps.opacity : 1,
        scale: animProps.scale,
        filter: dimmed && !isDiscarded ? "brightness(0.55)" : "brightness(1)",
      }}
      whileHover={{
        scale: (dimmed || isDiscarded || isIntaking) ? animProps.scale : 1.12,
        zIndex: 60,
      }}
      transition={
        isDiscarded
          ? { 
              type: "tween",
              duration: 0.6,
              ease: [0.55, 0.085, 0.68, 0.53], // Fast drop
            }
          : isIntaking
          ? {
              type: "tween",
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94], // Smooth intake with slight acceleration
            }
          : outroStage === "stamp" && selected
          ? {
              type: "spring",
              stiffness: 200,
              damping: 20,
            }
          : { type: "spring", stiffness: 260, damping: 22 }
      }
      style={{
        ...(isIntaking && {
          transformOrigin: "center center",
        }),
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-lg [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ transformOrigin: "50% 100%" }}
      >
        {/* Back face */}
        <div className="absolute inset-0 rounded-lg overflow-hidden [backface-visibility:hidden]">
          <img src={backSrc} alt="Card back" className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/40" />
        </div>
        {/* Front face */}
        <div className="absolute inset-0 rounded-lg overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <img src={frontSrc} alt="Card" className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/50" />
        </div>
      </motion.div>
      
      {/* Stamp overlay - only on selected card during stamp stage */}
      {selected && outroStage === "stamp" && (
        <AssetStamp isVisible={true} />
      )}
    </motion.button>
  );
}

export default function CardPackOpening({
  isOpen,
  onClose,
  onClaim,
  packImageSrc = DEFAULT_PACK,
  cardBackSrc = DEFAULT_BACK,
}: CardPackOpeningProps) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [hand, setHand] = useState<typeof cards>([]);
  const [outroStage, setOutroStage] = useState<OutroStage | null>(null);

  const selectedCard = useMemo(() => hand.find((c) => c.id === picked) || null, [hand, picked]);

  useEffect(() => {
    if (!isOpen) return;
    // Reset on open
    setPhase("sealed");
    setPicked(null);
    setRevealed({});
    setHand(sample3(cards));
    setOutroStage(null);
  }, [isOpen]);

  useEffect(() => {
    if (phase !== "opening") return;
    dispatchSfx("cards_slide");
    const t = window.setTimeout(() => setPhase("revealing"), 650);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    // Flip one by one
    const ids = hand.map((c) => c.id);
    let i = 0;
    const flipOne = () => {
      if (i >= ids.length) {
        setPhase("selection");
        return;
      }
      const id = ids[i];
      dispatchSfx("flip");
      setRevealed((prev) => ({ ...prev, [id]: true }));
      i += 1;
      window.setTimeout(flipOne, 450);
    };
    const start = window.setTimeout(flipOne, 450);
    return () => window.clearTimeout(start);
  }, [phase, hand]);

  // Handle card selection - start outro sequence
  const handleSelectCard = (cardId: string) => {
    if (phase !== "selection") return;
    setPicked(cardId);
    setPhase("outro");
    setOutroStage("discard");
    dispatchSfx("claim");
  };

  // Stage 1: Discard non-selected cards
  useEffect(() => {
    if (outroStage !== "discard" || !picked) return;
    const timer = window.setTimeout(() => {
      setOutroStage("stamp");
    }, 600); // Wait for discard animation
    return () => window.clearTimeout(timer);
  }, [outroStage, picked]);

  // Stage 2: Show stamp
  useEffect(() => {
    if (outroStage !== "stamp" || !picked) return;
    const timer = window.setTimeout(() => {
      setOutroStage("intake");
    }, 1200); // Show stamp for 1.2s
    return () => window.clearTimeout(timer);
  }, [outroStage, picked]);

  // Stage 3: Intake animation, then claim
  useEffect(() => {
    if (outroStage !== "intake" || !picked || !selectedCard) return;
    const timer = window.setTimeout(() => {
      onClaim?.(selectedCard);
      onClose();
    }, 800); // Wait for intake animation
    return () => window.clearTimeout(timer);
  }, [outroStage, picked, selectedCard, onClaim, onClose]);

  if (!isOpen) return null;

  const canClaim = phase === "selection" && picked !== null;

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center" onClick={onClose}>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0.35)), url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.16'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className={`relative w-full max-w-6xl mx-4 bg-[#0a0503] border border-[#8b6f47]/60 rounded-xl shadow-2xl ${outroStage === "stamp" ? "overflow-visible" : "overflow-hidden"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#8b6f47]/40 bg-gradient-to-r from-black via-[#120b08] to-black">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-[#8b6f47] font-mono">Asset Seizure</p>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-[#e8dcc6]">Booster Pack</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-white/5 text-[#e8dcc6] hover:text-[#d4af37] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className={`relative min-h-[600px] p-6 md:p-10 ${outroStage === "stamp" ? "overflow-visible" : "overflow-hidden"}`}>
          <div className="absolute inset-0 pointer-events-none opacity-25">
            <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(212,175,55,0.12),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(232,220,198,0.06),transparent_55%)]" />
          </div>

          {/* Phase 1: sealed pack */}
          <AnimatePresence>
            {(phase === "sealed" || phase === "opening") && (
              <motion.div
                key="pack"
                className="relative z-10 flex items-center justify-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <motion.button
                  type="button"
                  onClick={() => {
                    dispatchSfx("pack_rip");
                    setPhase("opening");
                  }}
                  className="relative"
                  animate={
                    phase === "sealed"
                      ? { scale: [1, 1.02, 1] }
                      : { y: 40, opacity: 0, scale: 0.95 }
                  }
                  transition={
                    phase === "sealed"
                      ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.55, ease: "easeInOut" }
                  }
                  whileHover={{
                    rotate: [0, -8, 8, -6, 6, -4, 4, 0],
                    transition: { duration: 0.55 },
                  }}
                  onHoverStart={() => dispatchSfx("pack_hover")}
                >
                  <img
                    src={packImageSrc}
                    alt="Sealed pack"
                    draggable={false}
                    className="w-[240px] md:w-[280px] drop-shadow-[0_30px_50px_rgba(0,0,0,0.7)] select-none"
                  />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/35 rounded" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase 2/3/4: cards */}
          <div className={`relative z-10 flex items-center justify-center pt-2 ${outroStage === "stamp" ? "overflow-visible" : ""}`}>
            <AnimatePresence>
              {(phase === "revealing" || phase === "selection" || phase === "outro") && hand.length === 3 && (
                <motion.div
                  key="hand"
                  className="relative flex items-center justify-center min-w-fit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Fan positions */}
                  {hand.map((c, idx) => {
                    const fan = [
                      { x: -150, y: 10, r: -12 },
                      { x: 0, y: -5, r: 0 },
                      { x: 150, y: 10, r: 12 },
                    ][idx];

                    const isPicked = picked === c.id;
                    const dimmed = picked !== null && !isPicked && outroStage === null;
                    const isRevealed = !!revealed[c.id];
                    const clickable = phase === "selection" && isRevealed;
                    const isDiscarded = outroStage !== null && !isPicked;
                    const isIntaking = outroStage === "intake" && isPicked;

                    return (
                      <Card3D
                        key={c.id}
                        frontSrc={c.image}
                        backSrc={cardBackSrc}
                        revealed={isRevealed}
                        selected={isPicked}
                        dimmed={dimmed}
                        angle={fan.r}
                        x={fan.x}
                        y={fan.y}
                        zIndex={50 + idx}
                        onClick={() => {
                          if (!clickable) return;
                          handleSelectCard(c.id);
                        }}
                        outroStage={outroStage}
                        isDiscarded={isDiscarded}
                        isIntaking={isIntaking}
                      />
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer actions */}
          <div className="relative z-10 mt-10 flex flex-col items-center gap-4">
            {phase === "sealed" && (
              <p className="text-sm text-[#8b6f47] font-mono">
                Click the pack to break the seal.
              </p>
            )}
            {phase === "selection" && (
              <p className="text-sm text-[#8b6f47] font-mono">
                Pick one asset. The rest gets shredded.
              </p>
            )}
            {phase === "outro" && outroStage === "discard" && (
              <p className="text-sm text-red-800 font-mono animate-pulse">
                DISPOSING OF REJECTED ASSETS...
              </p>
            )}
            {phase === "outro" && outroStage === "stamp" && (
              <p className="text-sm text-[#8b6f47] font-mono">
                PROCESSING ACQUISITION...
              </p>
            )}
            {phase === "outro" && outroStage === "intake" && (
              <p className="text-sm text-[#8b6f47] font-mono">
                ARCHIVING ASSET...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


