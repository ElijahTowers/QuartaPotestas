"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, animate } from "framer-motion";

export interface MorningReportProps {
  totalCash: number;
  cashBreakdown: { ads: number; bonuses: number; penalties: number };
  totalReaders: number;
  readerChange: number; // e.g., +5000 or -2000
  credibilityScore: number; // 0 to 100
  credibilityEvents: string[]; // e.g., ["Hypocrisy Detected: -15%"]
  onContinue: () => void; // Function to call when the user clicks "Start Next Day"
}

type SfxName =
  | "receipt_roll"
  | "typewriter"
  | "stamp"
  | "paper_slide"
  | "graph_draw"
  | "gauge_tick"
  | "gauge_thud";

function dispatchSfx(name: SfxName) {
  // Hook for later audio integration:
  // window.addEventListener("morning-report-sfx", (e) => { ... play e.detail.name ... })
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("morning-report-sfx", { detail: { name } }));
}

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString()}`;
}

function formatSigned(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString()}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useTypewriter(text: string, active: boolean, cps = 28) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) return;
    setOut("");
    dispatchSfx("typewriter");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, Math.max(12, Math.floor(1000 / cps)));
    return () => window.clearInterval(id);
  }, [text, active, cps]);
  return out;
}

function CountUp({
  value,
  duration = 0.9,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(format(0));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(format(Math.round(latest))),
    });
    return () => controls.stop();
  }, [mv, value, duration, format]);

  return <span>{display}</span>;
}

function Verdict({ score }: { score: number }) {
  const s = clamp(score, 0, 100);
  if (s >= 70) return { label: "TRUSTED SOURCE", color: "text-green-200 border-green-300/60" };
  if (s <= 30) return { label: "PROPAGANDA", color: "text-red-200 border-red-300/60" };
  return { label: "QUESTIONABLE", color: "text-amber-200 border-amber-300/60" };
}

export default function MorningReport(props: MorningReportProps) {
  const {
    totalCash,
    cashBreakdown,
    totalReaders,
    readerChange,
    credibilityScore,
    credibilityEvents,
    onContinue,
  } = props;

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [eventsFlashIndex, setEventsFlashIndex] = useState(0);

  const typeLine = useTypewriter("AD REVENUE...", step >= 1);

  const verdict = useMemo(() => Verdict({ score: credibilityScore }), [credibilityScore]);

  // Sequence timings
  useEffect(() => {
    dispatchSfx("receipt_roll");
    setStep(1);
    const t2 = window.setTimeout(() => {
      dispatchSfx("paper_slide");
      setStep(2);
    }, 1500);
    const t3 = window.setTimeout(() => {
      dispatchSfx("gauge_tick");
      setStep(3);
    }, 3000);
    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  // Stamp at end of receipt
  useEffect(() => {
    if (step !== 1) return;
    const t = window.setTimeout(() => dispatchSfx("stamp"), 1050);
    return () => window.clearTimeout(t);
  }, [step]);

  // Flash credibility events while gauge moves
  useEffect(() => {
    if (step < 3) return;
    if (!credibilityEvents || credibilityEvents.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setEventsFlashIndex(i % credibilityEvents.length);
      dispatchSfx("gauge_tick");
    }, 220);
    const stop = window.setTimeout(() => {
      window.clearInterval(id);
      dispatchSfx("gauge_thud");
    }, 1500);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [step, credibilityEvents]);

  const showContinue = step >= 3;

  const arrowUp = readerChange >= 0;
  const readerDeltaColor = arrowUp ? "text-green-300" : "text-red-300";

  const gaugeAngle = useMemo(() => {
    // Map 0..100 -> -90..90 (semi-circle, 180 degrees total)
    // 0% = -90deg (pointing Left)
    // 50% = 0deg (pointing Up)
    // 100% = 90deg (pointing Right)
    // Formula: rotation = (score / 100) * 180 - 90
    const s = clamp(credibilityScore, 0, 100);
    return (s / 100) * 180 - 90;
  }, [credibilityScore]);

  const graphPath = useMemo(() => {
    // Simple 2-point line based on change direction/magnitude
    // SVG viewBox: 0 0 200 80
    const mag = Math.min(1, Math.abs(readerChange) / 12000);
    const y1 = 55;
    const y2 = arrowUp ? 55 - mag * 35 : 55 + mag * 35;
    return `M 20 ${y1} L 180 ${y2}`;
  }, [readerChange, arrowUp]);

  const receiptTotalLabel = useMemo(() => {
    const totalLine = `TOTAL PROFIT: ${formatMoney(totalCash)}`;
    return totalLine;
  }, [totalCash]);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-[#0b0706] text-[#e8dcc6]">
      {/* Smoky desk + grain overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#0b0706] to-black/80" />
        <motion.div
          className="absolute -inset-24 opacity-30 mix-blend-screen"
          initial={{ opacity: 0.18 }}
          animate={{ opacity: [0.18, 0.26, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(212,175,55,0.10), rgba(0,0,0,0) 60%), radial-gradient(closest-side, rgba(232,220,198,0.06), rgba(0,0,0,0) 55%)",
          }}
        />
        <motion.div
          className="absolute inset-0 opacity-[0.08]"
          initial={{ opacity: 0.06 }}
          animate={{ opacity: [0.06, 0.1, 0.07] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0.35)), url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.16'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-[#8b6f47]">Morning Report</p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#e8dcc6]">
              The City Reads What You Print
            </h1>
          </div>
          <div className="text-right text-xs text-[#8b6f47] font-mono">
            <p>RESULTS LOG: 06:00</p>
            <p>OFFICE: EDITORIAL</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1) Cash receipt */}
          <motion.div
            className="relative md:col-span-1"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.div
              className="relative bg-[#f4e4bc] text-[#1a0f08] border border-[#8b6f47] shadow-2xl overflow-hidden"
              initial={{ y: -60 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="px-4 py-4 font-mono">
                <p className="text-[10px] tracking-[0.25em] uppercase">Ledger</p>
                <div className="mt-3">
                  <p className="text-xs">{typeLine}</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs">TOTAL CASH</span>
                    <span className="text-lg font-bold">
                      <CountUp value={totalCash} duration={0.95} format={formatMoney} />
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-xs border-t border-[#8b6f47]/60 pt-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Ads</span>
                    <span>{formatMoney(cashBreakdown.ads)}</span>
                  </div>
                  {cashBreakdown.bonuses !== 0 && (
                    <div className="flex justify-between">
                      <span>Bonuses</span>
                      <span>{formatMoney(cashBreakdown.bonuses)}</span>
                    </div>
                  )}
                  {cashBreakdown.penalties !== 0 && (
                    <div className="flex justify-between">
                      <span>Penalties</span>
                      <span>{formatMoney(cashBreakdown.penalties)}</span>
                    </div>
                  )}
                </div>

                <motion.div
                  className="mt-4 border-t-2 border-dashed border-[#1a0f08]/40 pt-3"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.05, duration: 0.25 }}
                >
                  <motion.div
                    className="inline-block px-3 py-1 border-2 border-[#1a0f08] font-bold tracking-wide"
                    initial={{ scale: 1.1, rotate: -6, opacity: 0 }}
                    animate={{ scale: [1.2, 1.0], rotate: [-6, -10, -7], opacity: 1 }}
                    transition={{ delay: 1.05, duration: 0.35, ease: "easeOut" }}
                    onAnimationComplete={() => dispatchSfx("stamp")}
                  >
                    {receiptTotalLabel}
                  </motion.div>
                </motion.div>
              </div>

              {/* receipt perforation */}
              <div className="h-2 w-full bg-[repeating-linear-gradient(90deg,rgba(26,15,8,0.35)_0px,rgba(26,15,8,0.35)_4px,transparent_4px,transparent_8px)] opacity-40" />
            </motion.div>
          </motion.div>

          {/* 2) Reader graph */}
          <motion.div
            className="relative md:col-span-1"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: step >= 2 ? 1 : 0.15 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 1.5 }}
          >
            <div className="bg-[#1a0f08] border border-[#8b6f47] paper-texture shadow-2xl">
              <div className="p-4">
                <p className="text-xs tracking-[0.25em] uppercase text-[#8b6f47] font-mono">
                  Circulation
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#8b6f47]">TOTAL READERS</p>
                    <p className="text-xl font-bold font-mono text-[#e8dcc6]">
                      {step >= 2 ? (
                        <CountUp value={totalReaders} duration={1.0} />
                      ) : (
                        totalReaders.toLocaleString()
                      )}
                    </p>
                  </div>
                  <div className={`text-right ${readerDeltaColor}`}>
                    <p className="text-xs text-[#8b6f47]">CHANGE</p>
                    <p className="text-xl font-bold font-mono">
                      {arrowUp ? "▲" : "▼"} {formatSigned(readerChange)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 bg-[#0f0a08] border border-[#8b6f47]/60 rounded p-3">
                  <svg viewBox="0 0 200 80" className="w-full h-20">
                    {/* grid lines */}
                    <g opacity="0.25" stroke="#8b6f47" strokeWidth="1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line key={`h-${i}`} x1="12" y1={14 + i * 14} x2="188" y2={14 + i * 14} />
                      ))}
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <line key={`v-${i}`} x1={20 + i * 28} y1="10" x2={20 + i * 28} y2="70" />
                      ))}
                    </g>

                    <motion.path
                      d={graphPath}
                      fill="none"
                      stroke={arrowUp ? "#86efac" : "#fca5a5"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: step >= 2 ? 1 : 0, opacity: step >= 2 ? 1 : 0 }}
                      transition={{ duration: 0.9, ease: "easeOut", delay: 1.65 }}
                      onAnimationStart={() => dispatchSfx("graph_draw")}
                    />
                    <circle cx="20" cy="55" r="3" fill="#d4af37" opacity="0.8" />
                    <circle cx="180" cy={arrowUp ? 55 - Math.min(1, Math.abs(readerChange) / 12000) * 35 : 55 + Math.min(1, Math.abs(readerChange) / 12000) * 35} r="3" fill="#d4af37" opacity="0.9" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 3) Credibility gauge */}
          <motion.div
            className="relative md:col-span-1"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: step >= 3 ? 1 : 0.15 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 3.0 }}
          >
            <div className="bg-[#1a0f08] border border-[#8b6f47] paper-texture shadow-2xl">
              <div className="p-4">
                <p className="text-xs tracking-[0.25em] uppercase text-[#8b6f47] font-mono">
                  Credibility
                </p>

                <div className="mt-4 flex items-center justify-center">
                  <div className="relative w-48 h-32">
                    <svg viewBox="0 0 200 140" className="w-full h-full">
                      {/* outer bezel */}
                      <path
                        d="M 20 120 A 80 80 0 0 1 180 120"
                        fill="none"
                        stroke="#d4af37"
                        strokeWidth="10"
                        opacity="0.35"
                      />
                      <path
                        d="M 30 120 A 70 70 0 0 1 170 120"
                        fill="none"
                        stroke="#8b6f47"
                        strokeWidth="6"
                        opacity="0.8"
                      />
                      {/* ticks */}
                      <g stroke="#8b6f47" strokeWidth="2" opacity="0.9">
                        {Array.from({ length: 9 }).map((_, i) => {
                          const a = (-120 + (i / 8) * 240) * (Math.PI / 180);
                          const x1 = 100 + Math.cos(a) * 58;
                          const y1 = 120 + Math.sin(a) * 58;
                          const x2 = 100 + Math.cos(a) * 68;
                          const y2 = 120 + Math.sin(a) * 68;
                          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
                        })}
                      </g>

                      {/* needle */}
                      <motion.g
                        // Pivot from bottom-center of the gauge (100, 120)
                        transformOrigin="100 120"
                        initial={{ rotate: -90 }}
                        animate={
                          step >= 3
                            ? { rotate: [ -90, gaugeAngle + 8, gaugeAngle - 4, gaugeAngle ] }
                            : { rotate: -90 }
                        }
                        transition={{ duration: 1.2, ease: "easeOut", delay: 3.1 }}
                        onAnimationStart={() => dispatchSfx("gauge_tick")}
                        onAnimationComplete={() => dispatchSfx("gauge_thud")}
                      >
                        {/* Needle pointing up initially (-90deg = 12 o'clock), rotates to correct angle */}
                        <line x1="100" y1="120" x2="165" y2="120" stroke="#e8dcc6" strokeWidth="3" strokeLinecap="round" />
                        <circle cx="100" cy="120" r="6" fill="#d4af37" />
                      </motion.g>

                      <text x="100" y="135" textAnchor="middle" fill="#8b6f47" fontSize="10">
                        0
                      </text>
                      <text x="24" y="58" textAnchor="middle" fill="#8b6f47" fontSize="10">
                        0
                      </text>
                      <text x="176" y="58" textAnchor="middle" fill="#8b6f47" fontSize="10">
                        100
                      </text>
                    </svg>

                    <motion.div
                      className={`absolute left-1/2 top-3 -translate-x-1/2 px-3 py-1 border-2 ${verdict.color} bg-black/35 font-bold tracking-[0.18em] text-[10px]`}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: step >= 3 ? [1.08, 1] : 0.95, opacity: step >= 3 ? 1 : 0 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: 4.25 }}
                    >
                      {verdict.label}
                    </motion.div>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-[#8b6f47] mb-1">SCORE</p>
                  <p className="text-xl font-bold font-mono text-[#e8dcc6]">
                    {step >= 3 ? <CountUp value={clamp(credibilityScore, 0, 100)} duration={1.0} /> : credibilityScore}
                    <span className="text-[#8b6f47]">%</span>
                  </p>
                </div>

                <div className="mt-3 min-h-[28px]">
                  <AnimatePresence mode="wait">
                    {step >= 3 && credibilityEvents.length > 0 && (
                      <motion.p
                        key={eventsFlashIndex}
                        className="text-xs font-mono text-[#d4af37]"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                      >
                        {credibilityEvents[eventsFlashIndex]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Continue */}
        <motion.div
          className="mt-10 flex justify-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showContinue ? 1 : 0, y: showContinue ? 0 : 10 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 4.6 }}
        >
          <button
            onClick={onContinue}
            disabled={!showContinue}
            className="px-6 py-3 bg-[#d4af37] text-[#1a0f08] font-bold rounded border border-[#8b6f47] hover:bg-[#e5c04a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            START NEXT DAY
          </button>
        </motion.div>
      </div>
    </div>
  );
}


