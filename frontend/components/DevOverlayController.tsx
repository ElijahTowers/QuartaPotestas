"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const ADMIN_EMAIL = "lowiehartjes@gmail.com";

/**
 * Controls the Next.js development overlay visibility
 * Only shows it when the admin user is logged in
 */
export default function DevOverlayController() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.email === ADMIN_EMAIL;

  useEffect(() => {
    // Only run in development mode
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Add/remove body class based on admin status
    if (isAdmin) {
      document.body.classList.add("admin-user");
    } else {
      document.body.classList.remove("admin-user");
    }

    // More aggressive approach: find and hide all possible overlay elements
    const hideOverlay = () => {
      // Try multiple strategies to find the overlay
      const strategies = [
        // Strategy 1: Find by data attributes
        () => {
          const elements = document.querySelectorAll('[data-nextjs-dialog], [data-nextjs-toast]');
          elements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (!isAdmin) {
              htmlEl.style.display = "none";
              htmlEl.style.visibility = "hidden";
              htmlEl.style.opacity = "0";
              htmlEl.style.pointerEvents = "none";
            } else {
              htmlEl.style.display = "";
              htmlEl.style.visibility = "";
              htmlEl.style.opacity = "";
              htmlEl.style.pointerEvents = "";
            }
          });
        },
        // Strategy 2: Find by class names containing dev overlay indicators
        () => {
          const allDivs = document.querySelectorAll('div');
          allDivs.forEach((div) => {
            const htmlDiv = div as HTMLElement;
            const className = htmlDiv.className || "";
            const id = htmlDiv.id || "";
            
            // Check if it looks like a dev overlay
            if (
              className.includes("__next-dev") ||
              className.includes("next-dev") ||
              id.includes("__next") ||
              htmlDiv.textContent?.includes("Route") ||
              htmlDiv.textContent?.includes("Bundler") ||
              htmlDiv.textContent?.includes("Turbopack") ||
              htmlDiv.textContent?.includes("Route Info")
            ) {
              // Additional check: is it positioned fixed/absolute and small?
              const style = window.getComputedStyle(htmlDiv);
              if (
                (style.position === "fixed" || style.position === "absolute") &&
                (htmlDiv.textContent?.includes("Route") || 
                 htmlDiv.textContent?.includes("Bundler") ||
                 htmlDiv.textContent?.includes("Turbopack"))
              ) {
                if (!isAdmin) {
                  htmlDiv.style.display = "none !important";
                  htmlDiv.style.visibility = "hidden !important";
                  htmlDiv.style.opacity = "0 !important";
                  htmlDiv.style.pointerEvents = "none !important";
                  htmlDiv.setAttribute("data-hidden-by-dev-controller", "true");
                } else {
                  if (htmlDiv.getAttribute("data-hidden-by-dev-controller")) {
                    htmlDiv.style.display = "";
                    htmlDiv.style.visibility = "";
                    htmlDiv.style.opacity = "";
                    htmlDiv.style.pointerEvents = "";
                    htmlDiv.removeAttribute("data-hidden-by-dev-controller");
                  }
                }
              }
            }
          });
        },
        // Strategy 3: Find by specific text content
        () => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let node;
          while ((node = walker.nextNode())) {
            if (
              node.textContent?.includes("Route") &&
              node.textContent?.includes("Bundler") &&
              node.textContent?.includes("Turbopack")
            ) {
              let parent = node.parentElement;
              // Go up the tree to find the container
              while (parent && parent !== document.body) {
                const style = window.getComputedStyle(parent);
                if (style.position === "fixed" || style.position === "absolute") {
                  if (!isAdmin) {
                    parent.style.display = "none !important";
                    parent.style.visibility = "hidden !important";
                    parent.setAttribute("data-hidden-by-dev-controller", "true");
                  } else {
                    if (parent.getAttribute("data-hidden-by-dev-controller")) {
                      parent.style.display = "";
                      parent.style.visibility = "";
                      parent.removeAttribute("data-hidden-by-dev-controller");
                    }
                  }
                  break;
                }
                parent = parent.parentElement;
              }
            }
          }
        },
      ];

      strategies.forEach((strategy) => {
        try {
          strategy();
        } catch (e) {
          console.warn("DevOverlayController strategy failed:", e);
        }
      });
    };

    // Hide/show immediately
    hideOverlay();

    // Use MutationObserver to catch dynamically injected overlay
    const observer = new MutationObserver(() => {
      hideOverlay();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "data-nextjs-dialog", "data-nextjs-toast"],
    });

    // Also check periodically as a fallback
    const interval = setInterval(hideOverlay, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      // Cleanup body class
      document.body.classList.remove("admin-user");
    };
  }, [isAdmin]);

  return null;
}

