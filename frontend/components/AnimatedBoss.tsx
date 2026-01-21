import React from 'react';

// Ensure these mood types align with your existing Assistant component's props
export type BossMood = 'neutral' | 'happy' | 'angry';

interface AnimatedBossProps {
  mood: BossMood;
}

const AnimatedBoss: React.FC<AnimatedBossProps> = ({ mood }) => {
  // Base container: The dark circular office window/spotlight
  // Uses Tailwind for fixed size, rounding, dark background, and an inset shadow for depth.
  const containerBase = "relative w-28 h-28 rounded-full overflow-hidden bg-gray-950 border-4 border-gray-800 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]";

  // Determine atmospheric effects variables based on the current mood
  // Default state (neutral): Cold blue monitor light, slow smoke, slow glow.
  let lightingClass = "bg-blue-500/20 animate-flicker";
  let smokeClass = "animate-smoke-slow";
  let glowClass = "animate-glow-slow";
  let containerShake = "";

  if (mood === 'happy') {
    // Happy state: Greedy green/gold glow.
    lightingClass = "bg-green-500/30 animate-pulse";
  } else if (mood === 'angry') {
    // Angry state: Alarming red light, fast nervous smoke, intense glow, and screen shaking.
    lightingClass = "bg-red-600/50 animate-pulse";
    smokeClass = "animate-smoke-fast";
    glowClass = "animate-glow-fast";
    containerShake = "animate-shake";
  }

  return (
    <div className={`${containerBase} ${containerShake}`}>
        {/* 1. Atmospheric Lighting Overlay */}
        {/* Sits on top with mix-blend-overlay to colorize everything underneath */}
        <div className={`absolute inset-0 z-20 mix-blend-overlay transition-colors duration-500 ${lightingClass}`}></div>

        {/* 2. THE BOSS SILHOUETTE */}
        {/* An abstract black rounded shape positioned at the bottom to suggest head/shoulders */}
        <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-24 h-20 bg-black rounded-t-[3rem] z-10 shadow-lg"></div>

        {/* 3. THE CIGARETTE ELEMENTS */}
        <div className="absolute bottom-8 left-14 z-30 pointer-events-none">
            {/* The Smoke: A blurry oval that rises and fades using the CSS animation */}
            <div className={`absolute -top-4 left-0 w-6 h-8 bg-gray-400/20 rounded-full blur-md ${smokeClass}`}></div>
            {/* The Cigarette Butt: A tiny angled grey line */}
            <div className="w-4 h-1 bg-gray-300 rotate-12"></div>
            {/* The Glowing Cherry: The tip that pulses with color */}
            <div className={`absolute top-0 right-0 translate-x-1 -translate-y-0.5 w-2 h-2 rounded-full ${glowClass}`}></div>
        </div>
    </div>
  );
};

export default AnimatedBoss;

