"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useTutorial } from "@/context/TutorialContext";
import SpotlightOverlay from "./SpotlightOverlay";
import TutorialTooltip from "./TutorialTooltip";

const TUTORIAL_STEPS = [
  { id: "map", page: "/", target: "map" },
  { id: "wire", page: "/", target: "wire" },
  { id: "grid-tab", page: "/", target: "grid-tab" },
  { id: "editor-wire", page: "/editor", target: "editor-wire" },
  { id: "grid-layout", page: "/editor", target: "grid-layout" },
  { id: "variant-selector", page: "/editor", target: "variant-selector" },
  { id: "ad-button", page: "/editor", target: "ad-button" },
  { id: "publish-button", page: "/editor", target: "publish-button" },
  { id: "hub-tab", page: "/hub", target: "hub-tab" },
  { id: "treasury", page: "/hub", target: "treasury" },
  { id: "audience-radar", page: "/hub", target: "audience-radar" },
  { id: "shop-button", page: "/hub", target: "shop-button" },
];

const TUTORIAL_MESSAGES = [
  "Welcome to The War Room. This map shows breaking news from around the world.",
  "The Wire picks up scoops from your informants. Click or tap to read details.",
  "Switch to the Editor to build your newspaper front page.",
  "Drag scoops from The Wire onto your newspaper layout.",
  "Your front page has 6 slots: 1 headline + 2 sub-leads + 3 briefs.",
  "Choose how to spin each story: Factual, Sensationalist, or Propaganda.",
  "Place Ads to make money. Balance news with revenue.",
  "Fill all 6 slots in your newspaper (articles or ads), then hit Send to Press to print your edition.",
  "The Hub is your executive desk. Manage your empire here.",
  "Track your cash flow and recent transactions.",
  "Monitor how different factions react to your editorial choices.",
  "Buy upgrades in the Shop to expand your operation.",
];

export default function Tutorial() {
  const pathname = usePathname();
  const { isActive, currentStep, getCurrentStepForPath, nextStep, skipTutorial } = useTutorial();

  const currentStepData = getCurrentStepForPath(pathname);

  // Debug logging
  React.useEffect(() => {
    if (isActive) {
      console.log("[Tutorial] Active:", {
        isActive,
        currentStep,
        pathname,
        currentStepData,
        expectedPage: TUTORIAL_STEPS[currentStep]?.page,
      });
    }
  }, [isActive, currentStep, pathname, currentStepData]);

  if (!isActive || !currentStepData) {
    return null;
  }

  // Step 3 (index 2) is the grid-tab step - hide buttons (user must click tab)
  // Step 8 (index 7) is the publish step - hide buttons and position top-right
  const isGridTabStep = currentStep === 2; // grid-tab is step 3 (index 2)
  const isPublishStep = currentStep === 7; // publish-button is step 8 (index 7)

  return (
    <SpotlightOverlay
      targetSelector={currentStepData.target}
      isActive={isActive}
      tooltipPosition={isPublishStep ? 'top-right' : 'default'}
    >
      <TutorialTooltip
        message={TUTORIAL_MESSAGES[currentStep]}
        currentStep={currentStep}
        totalSteps={TUTORIAL_STEPS.length}
        onNext={nextStep}
        onSkip={skipTutorial}
        hideButtons={isGridTabStep || isPublishStep}
        position={isPublishStep ? 'top-right' : 'default'}
      />
    </SpotlightOverlay>
  );
}

