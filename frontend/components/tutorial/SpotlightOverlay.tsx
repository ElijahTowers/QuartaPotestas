"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SpotlightOverlayProps {
  targetSelector: string | null; // data-tutorial attribute value
  isActive: boolean;
  children?: React.ReactNode; // Tooltip content
  tooltipPosition?: 'default' | 'top-right'; // Position of the tooltip
}

export default function SpotlightOverlay({
  targetSelector,
  isActive,
  children,
  tooltipPosition = 'default',
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [padding, setPadding] = useState(8);
  const [isSearching, setIsSearching] = useState(true);

  useEffect(() => {
    if (!isActive || !targetSelector) {
      setTargetRect(null);
      return;
    }

    const updateTargetRect = () => {
      const element = document.querySelector(`[data-tutorial="${targetSelector}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        // Only set if element is actually visible (has dimensions)
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          // Add some padding around the element
          setPadding(8);
          console.log(`[Tutorial] Found element "${targetSelector}" at:`, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
          return true; // Element found
        } else {
          console.warn(`[Tutorial] Element "${targetSelector}" found but has no dimensions`);
          setTargetRect(null);
          return false;
        }
      } else {
        setTargetRect(null);
        return false; // Element not found
      }
    };

    // Wait a bit for page to render, then try to find element
    const initialDelay = setTimeout(() => {
      updateTargetRect();
    }, 100);

    // Poll for element if not found immediately (for dynamic content)
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      pollCount++;
      if (pollCount > 200) {
        // Stop polling after 20 seconds (200 * 100ms) - longer for elements that appear after user action
        clearInterval(pollInterval);
        setIsSearching(false);
        console.warn(`[Tutorial] Could not find element with data-tutorial="${targetSelector}" after 20 seconds`);
        // Log all elements with data-tutorial for debugging
        const allTutorialElements = document.querySelectorAll('[data-tutorial]');
        console.log('[Tutorial] Found tutorial elements:', Array.from(allTutorialElements).map(el => ({
          selector: el.getAttribute('data-tutorial'),
          tag: el.tagName,
          className: el.className,
        })));
        return;
      }
      const found = updateTargetRect();
      if (found) {
        clearInterval(pollInterval);
        setIsSearching(false);
      }
    }, 100);

    // Update on scroll/resize
    window.addEventListener("scroll", updateTargetRect, true);
    window.addEventListener("resize", updateTargetRect);

    // Use MutationObserver to watch for element changes
    const observer = new MutationObserver(updateTargetRect);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tutorial"],
    });

    return () => {
      clearTimeout(initialDelay);
      clearInterval(pollInterval);
      window.removeEventListener("scroll", updateTargetRect, true);
      window.removeEventListener("resize", updateTargetRect);
      observer.disconnect();
      setIsSearching(true);
    };
  }, [isActive, targetSelector]);

  // Calculate tooltip position to keep it within viewport
  // Always call useMemo (Rules of Hooks) but only use result if targetRect exists
  const calculatedTooltipPosition = useMemo(() => {
    // If position is top-right, always position there (to the left of publish button)
    if (tooltipPosition === 'top-right') {
      return {
        right: '500px', // Position well to the left of publish button to avoid overlap
        top: '20px', // Same vertical position as button
        left: 'auto',
        maxWidth: '400px',
      };
    }
    if (!targetRect) {
      return { left: 0, top: 0, maxWidth: "300px" };
    }

    const tooltipWidth = 300; // max-width of tooltip
    const tooltipHeight = 250; // estimated height
    const spacing = 20;
    
    // Calculate spotlight cutout
    const cutout = {
      x: targetRect.left - padding,
      y: targetRect.top - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
    };
    
    // Check available space
    const spaceRight = window.innerWidth - (cutout.x + cutout.width);
    const spaceLeft = cutout.x;
    const spaceBottom = window.innerHeight - (cutout.y + cutout.height);
    const spaceTop = cutout.y;
    
    // Default: try right side
    let left = cutout.x + cutout.width + spacing;
    let top = cutout.y;
    
    // If not enough space on right, place on left
    if (spaceRight < tooltipWidth + spacing) {
      left = cutout.x - tooltipWidth - spacing;
      // Ensure it doesn't go off-screen
      if (left < 0) {
        left = Math.max(10, cutout.x + cutout.width / 2 - tooltipWidth / 2);
      }
    }
    
    // If not enough space on bottom, place above
    if (spaceBottom < tooltipHeight && spaceTop > tooltipHeight) {
      top = cutout.y - tooltipHeight - spacing;
    } else if (spaceBottom < tooltipHeight) {
      // Not enough space above or below, center vertically
      top = Math.max(10, cutout.y + cutout.height / 2 - tooltipHeight / 2);
    }
    
    // Ensure tooltip stays within viewport
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));
    
    return { left, top, maxWidth: `${tooltipWidth}px` };
  }, [targetRect, padding]);

  // Don't return null immediately - wait for element to appear or show loading state
  // For variant-selector and similar elements that require user action, keep searching
  if (!isActive) {
    return null;
  }

  // Special handling for publish step (step 8) - no overlay, just tooltip
  // This allows the user to interact with the editor freely
  // Position tooltip to the left of and below the publish button (which is at top-4 right-20)
  // Publish button: top-4 (16px), right-20 (80px), height ~60px
  // Tooltip position: left of button, below button
  if (targetSelector === "publish-button") {
    return (
      <AnimatePresence>
        {isActive && children && (
          <div
            className="fixed z-[9999] pointer-events-auto"
            style={{
              right: '500px', // Position well to the left of publish button to avoid overlap
              top: '20px', // Same vertical position as button
              maxWidth: '400px',
            }}
          >
            {children}
          </div>
        )}
      </AnimatePresence>
    );
  }

  // If we're still searching and haven't found the element yet, show overlay with tooltip
  // This prevents the tutorial from "closing" when the element isn't immediately visible
  if (!targetRect && isSearching) {
    // Keep the overlay visible while searching, show tooltip in center
    return (
      <AnimatePresence>
        {isActive && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[9998] pointer-events-none"
              style={{ isolation: "isolate", zIndex: 9998 }}
            >
              {/* Minimal overlay while waiting for element */}
              <div
                className="absolute inset-0 bg-black/40"
                style={{ pointerEvents: "auto" }}
              />
            </motion.div>
            
            {/* Tooltip container - positioned based on tooltipPosition prop */}
            {children && (
              <div
                className="fixed z-[9999] pointer-events-auto"
                style={
                  tooltipPosition === 'top-right'
                    ? {
                        right: '500px', // Position well to the left of publish button to avoid overlap
                        top: '20px', // Same vertical position as button
                        maxWidth: '400px',
                      }
                    : {
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '400px',
                      }
                }
              >
                {children}
              </div>
            )}
          </>
        )}
      </AnimatePresence>
    );
  }

  // If element not found after searching, still show overlay with tooltip
  // This is important for steps like variant-selector that require user action first
  if (!targetRect && !isSearching) {
    console.warn(`[Tutorial] Element "${targetSelector}" not found - showing tutorial anyway`);
    // Return overlay structure with tooltip area, but no highlight
    // The tooltip will be positioned in a default location
    return (
      <AnimatePresence>
        {isActive && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[9998] pointer-events-none"
              style={{ isolation: "isolate", zIndex: 9998 }}
            >
              {/* Minimal overlay when element not found */}
              <div
                className="absolute inset-0 bg-black/40"
                style={{ pointerEvents: "auto" }}
              />
            </motion.div>
            
            {/* Tooltip container - positioned based on tooltipPosition prop */}
            {children && (
              <div
                className="fixed z-[9999] pointer-events-auto"
                style={
                  tooltipPosition === 'top-right'
                    ? {
                        right: '500px', // Position well to the left of publish button to avoid overlap
                        top: '20px', // Same vertical position as button
                        maxWidth: '400px',
                      }
                    : {
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '400px',
                      }
                }
              >
                {children}
              </div>
            )}
          </>
        )}
      </AnimatePresence>
    );
  }

  // Calculate spotlight cutout
  const cutout = {
    x: targetRect.left - padding,
    y: targetRect.top - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  return (
    <AnimatePresence>
      {isActive && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9998] pointer-events-none"
            style={{ isolation: "isolate", zIndex: 9998 }}
          >
            {/* Dark overlay with cutout using CSS */}
            {/* Special handling for wire step - keep wire visible */}
            {targetSelector === "wire" ? (
            // Lighter overlay for wire step - don't darken the wire panel
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse ${cutout.width + 100}px ${cutout.height + 100}px at ${cutout.x + cutout.width / 2}px ${cutout.y + cutout.height / 2}px, transparent 0%, transparent 50%, rgba(0, 0, 0, 0.3) 80%)`,
                  pointerEvents: "auto",
                }}
              />
              {/* Only overlay the map area, not the wire panel */}
              <div
                className="absolute bg-black/30"
                style={{
                  left: cutout.x + cutout.width, // Start after the wire panel
                  top: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
            </>
          ) : (
            // Normal overlay for other steps
            <>
              <div
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  right: targetSelector?.endsWith("-tab") ? 64 : 0, // Leave space for sidebar on tab steps
                  bottom: 0,
                  background: `radial-gradient(ellipse ${cutout.width + 100}px ${cutout.height + 100}px at ${cutout.x + cutout.width / 2}px ${cutout.y + cutout.height / 2}px, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.85) 70%)`,
                  pointerEvents: "auto",
                }}
              />
              
              {/* Top overlay */}
              <div
                className="absolute bg-black/85"
                style={{
                  left: 0,
                  top: 0,
                  right: targetSelector?.endsWith("-tab") ? 64 : 0, // Leave space for sidebar on tab steps
                  height: cutout.y,
                  pointerEvents: "auto",
                }}
              />
              
              {/* Bottom overlay */}
              <div
                className="absolute bg-black/85"
                style={{
                  left: 0,
                  top: cutout.y + cutout.height,
                  right: targetSelector?.endsWith("-tab") ? 64 : 0, // Leave space for sidebar on tab steps
                  bottom: 0,
                  pointerEvents: "auto",
                }}
              />
              
              {/* Left overlay */}
              <div
                className="absolute bg-black/85"
                style={{
                  left: 0,
                  top: cutout.y,
                  width: cutout.x,
                  height: cutout.height,
                  pointerEvents: "auto",
                }}
              />
              
              {/* Right overlay - exclude tab buttons area for tab steps */}
              {targetSelector?.endsWith("-tab") ? (
                // For tab steps, don't overlay the right sidebar where tabs are
                <div
                  className="absolute bg-black/85"
                  style={{
                    left: cutout.x + cutout.width,
                    top: cutout.y,
                    right: 64, // Leave space for the 64px (w-16) sidebar
                    height: cutout.height,
                    pointerEvents: "auto",
                  }}
                />
              ) : (
                <div
                  className="absolute bg-black/85"
                  style={{
                    left: cutout.x + cutout.width,
                    top: cutout.y,
                    right: 0,
                    height: cutout.height,
                    pointerEvents: "auto",
                  }}
                />
              )}
            </>
          )}

            {/* Tooltip container - positioned relative to target with smart positioning */}
            {children && (
              <div
                className={tooltipPosition === 'top-right' ? "fixed" : "absolute"}
                style={{
                  pointerEvents: "auto",
                  ...calculatedTooltipPosition,
                }}
              >
                {children}
              </div>
            )}
          </motion.div>
          
          {/* Highlight border around target - rendered outside overlay container to be above sidebar */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed border-2 border-[#d4af37] rounded pointer-events-none z-[10000]"
            style={{
              left: `${cutout.x}px`,
              top: `${cutout.y}px`,
              width: `${cutout.width}px`,
              height: `${cutout.height}px`,
              boxShadow: "0 0 20px rgba(212, 175, 55, 0.5), inset 0 0 20px rgba(212, 175, 55, 0.2)",
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

