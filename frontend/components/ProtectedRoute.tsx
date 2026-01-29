"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowGuest?: boolean; // Allow guest access (read-only mode)
  requireAuth?: boolean; // Explicitly require authentication (no guest mode)
}

export default function ProtectedRoute({ 
  children, 
  allowGuest = false,
  requireAuth = false 
}: ProtectedRouteProps) {
  const { isAuthenticated, isGuest, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // If explicitly requiring auth, redirect guests
      if (requireAuth && isGuest) {
        router.push("/login");
        return;
      }
      
      // If not authenticated and not in guest mode (and guest not allowed), redirect to login
      if (!isAuthenticated && !isGuest && !allowGuest) {
        router.push("/login");
      }
    }
  }, [isAuthenticated, isGuest, isLoading, router, allowGuest, requireAuth]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#2a1810] paper-texture">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mx-auto mb-4" />
          <p className="text-[#e8dcc6] text-lg">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Allow access if authenticated OR (guest mode AND guest is allowed)
  const hasAccess = isAuthenticated || (isGuest && allowGuest);
  
  if (!hasAccess) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}

