"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getPocketBase } from "@/lib/pocketbase";
import { useAuth } from "./AuthContext";

interface TutorialStep {
  id: string;
  page: string; // Route path where this step should be shown
  target: string; // data-tutorial attribute value
  message: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "map",
    page: "/",
    target: "map",
    message: "Welcome to The War Room. This map shows breaking news from around the world.",
  },
  {
    id: "wire",
    page: "/",
    target: "wire",
    message: "The Wire picks up scoops from your informants. Click or tap to read details.",
  },
  {
    id: "grid-tab",
    page: "/",
    target: "grid-tab",
    message: "Switch to the Editor to build your newspaper front page.",
  },
  {
    id: "editor-wire",
    page: "/editor",
    target: "editor-wire",
    message: "Drag scoops from The Wire onto your newspaper layout.",
  },
  {
    id: "grid-layout",
    page: "/editor",
    target: "grid-layout",
    message: "Your front page has 6 slots: 1 headline + 2 sub-leads + 3 briefs.",
  },
  {
    id: "variant-selector",
    page: "/editor",
    target: "variant-selector",
    message: "Choose how to spin each story: Factual, Sensationalist, or Propaganda.",
  },
  {
    id: "ad-button",
    page: "/editor",
    target: "ad-button",
    message: "Place Ads to make money. Balance news with revenue.",
  },
  {
    id: "publish-button",
    page: "/editor",
    target: "publish-button",
    message: "Fill all 6 slots in your newspaper (articles or ads), then hit Publish to print your edition.",
  },
  {
    id: "hub-tab",
    page: "/hub",
    target: "hub-tab",
    message: "The Hub is your executive desk. Manage your empire here.",
  },
  {
    id: "treasury",
    page: "/hub",
    target: "treasury",
    message: "Track your cash flow and recent transactions.",
  },
  {
    id: "audience-radar",
    page: "/hub",
    target: "audience-radar",
    message: "Monitor how different factions react to your editorial choices.",
  },
  {
    id: "shop-button",
    page: "/hub",
    target: "shop-button",
    message: "Buy upgrades in the Shop to expand your operation.",
  },
];

interface TutorialContextType {
  currentStep: number;
  isActive: boolean;
  hasCompleted: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  skipTutorial: () => void;
  endTutorial: () => Promise<void>;
  getCurrentStepForPath: (pathname: string) => TutorialStep | null;
  isCurrentStepTab: () => boolean;
  handleTabClick: (tabId: string) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [hasCompleted, setHasCompleted] = useState<boolean>(false);
  const { user, isAuthenticated } = useAuth();
  const pb = getPocketBase();

  // Load completion status from user record
  useEffect(() => {
    if (user && isAuthenticated) {
      const completed = user.tutorial_completed === true;
      setHasCompleted(completed);
    }
  }, [user, isAuthenticated]);

  // Auto-trigger for new users
  useEffect(() => {
    if (user && isAuthenticated && !hasCompleted && !isActive) {
      // Wait a bit for the page to load, then start tutorial
      const timer = setTimeout(() => {
        setCurrentStep(0);
        setIsActive(true);
      }, 2000); // 2 second delay

      return () => clearTimeout(timer);
    }
  }, [user, isAuthenticated, hasCompleted, isActive]);

  const startTutorial = () => {
    // Reset to first step
    setCurrentStep(0);
    setIsActive(true);
    // Note: Tutorial will show when user navigates to the page for step 0
    // or we could navigate them there, but for now we'll let them navigate manually
  };

  const nextStep = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Tutorial complete
      endTutorial();
    }
  };

  const skipTutorial = () => {
    endTutorial();
  };

  const endTutorial = async () => {
    setIsActive(false);
    setHasCompleted(true);
    setCurrentStep(0);

    // Save completion status to PocketBase
    if (user && isAuthenticated) {
      try {
        await pb.collection("users").update(user.id, {
          tutorial_completed: true,
        });
      } catch (error) {
        console.error("Failed to save tutorial completion:", error);
      }
    }
  };

  // Check if current step is a tab that needs to be clicked
  const isCurrentStepTab = (): boolean => {
    if (!isActive || currentStep >= TUTORIAL_STEPS.length) {
      return false;
    }
    const step = TUTORIAL_STEPS[currentStep];
    // Tab steps end with "-tab"
    return step.id.endsWith("-tab");
  };

  // Handle tab click - if it's the current tutorial step, advance to next step
  const handleTabClick = (tabId: string) => {
    if (!isActive || currentStep >= TUTORIAL_STEPS.length) {
      return;
    }
    const step = TUTORIAL_STEPS[currentStep];
    // Check if the clicked tab matches the current step target
    if (step.target === tabId) {
      // Wait for navigation to complete, then advance to next step
      // The next step will show on the new page after navigation
      setTimeout(() => {
        nextStep();
      }, 500); // Longer delay to ensure page navigation completes
    }
  };

  // Get current step data based on current route
  const getCurrentStepForPath = (pathname: string): TutorialStep | null => {
    if (!isActive || currentStep >= TUTORIAL_STEPS.length) {
      return null;
    }

    const step = TUTORIAL_STEPS[currentStep];
    
    // Normalize pathname (remove trailing slash, query params, hash)
    const normalizedPath = pathname.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
    const normalizedStepPage = step.page.replace(/\/$/, '') || '/';
    
    // Check if current step matches the current page
    if (normalizedStepPage === normalizedPath) {
      return step;
    }

    // If step is for a different page, return null (tutorial will pause)
    return null;
  };

  // Listen for newspaper published event to advance tutorial from step 8
  // This must be after nextStep is defined
  useEffect(() => {
    const handlePublish = () => {
      // Only advance if we're on step 8 (publish-button step, index 7)
      if (isActive && currentStep === 7) {
        // Wait a bit for the publish to complete, then advance
        setTimeout(() => {
          nextStep();
        }, 1000);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('newspaper-published', handlePublish);
      return () => {
        window.removeEventListener('newspaper-published', handlePublish);
      };
    }
  }, [isActive, currentStep, nextStep]);

  const value: TutorialContextType = {
    currentStep,
    isActive,
    hasCompleted,
    startTutorial,
    nextStep,
    skipTutorial,
    endTutorial,
    getCurrentStepForPath,
    isCurrentStepTab,
    handleTabClick,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}

// Export helper to get step data for a specific pathname
export function getTutorialStepForPath(pathname: string, stepIndex: number): TutorialStep | null {
  if (stepIndex >= TUTORIAL_STEPS.length) {
    return null;
  }
  const step = TUTORIAL_STEPS[stepIndex];
  return step.page === pathname ? step : null;
}

