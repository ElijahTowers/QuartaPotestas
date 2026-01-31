"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getPocketBase } from "@/lib/pocketbase";

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string) => Promise<void>;
  enterGuestMode: () => void;
  updateUsername: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pb = getPocketBase();

  // Load auth state on mount
  useEffect(() => {
    // Check if user is in guest mode
    const guestMode = localStorage.getItem("guestMode") === "true";
    if (guestMode) {
      setIsGuest(true);
      setIsLoading(false);
      return;
    }

    // Check if user is already authenticated
    const authData = pb.authStore.model;
    if (authData && pb.authStore.token) {
      // Always fetch fresh user data from server to ensure we have latest username
      // This ensures username updates are visible after refresh
      pb.collection("users").getOne(authData.id)
        .then((freshUserData) => {
          setUser(freshUserData);
          // Update auth store with fresh data
          pb.authStore.save(pb.authStore.token, freshUserData);
        })
        .catch((error) => {
          console.error("Failed to refresh user data:", error);
          // Fallback to cached data if refresh fails
          setUser(authData);
        });
    } else {
      setUser(authData);
    }
    setIsLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
      // Clear guest mode if user logs in
      if (model) {
        setIsGuest(false);
        localStorage.removeItem("guestMode");
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const authData = await pb.collection("users").authWithPassword(email, password);
      setUser(authData.record);
    } catch (error: any) {
      throw new Error(error.message || "Failed to login");
    }
  };

  const register = async (email: string, password: string, passwordConfirm: string) => {
    try {
      // Generate default username from email
      const generateDefaultUsername = (email: string): string => {
        const base = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
        const random = Math.floor(Math.random() * 1000);
        return `${base}${random}`;
      };

      const defaultUsername = generateDefaultUsername(email);

      const userData = await pb.collection("users").create({
        email,
        password,
        passwordConfirm,
        username: defaultUsername,
      });
      // Auto-login after registration
      await login(email, password);
    } catch (error: any) {
      throw new Error(error.message || "Failed to register");
    }
  };

  const logout = async () => {
    pb.authStore.clear();
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem("guestMode");
  };

  const enterGuestMode = () => {
    setIsGuest(true);
    localStorage.setItem("guestMode", "true");
    // Clear any existing auth
    pb.authStore.clear();
    setUser(null);
  };

  const updateUsername = async (username: string) => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Client-side validation (backend will also validate)
    if (!username || username.trim().length === 0) {
      throw new Error("Username cannot be empty");
    }

    if (username.length < 3) {
      throw new Error("Username must be at least 3 characters");
    }

    if (username.length > 30) {
      throw new Error("Username must be less than 30 characters");
    }

    // Only allow alphanumeric and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error("Username can only contain letters, numbers, and underscores");
    }

    try {
      // Use backend API endpoint which enforces uniqueness
      const { updateUsername: updateUsernameAPI } = await import("@/lib/api");
      await updateUsernameAPI(username.trim());
      
      // Refresh user data from PocketBase
      const updatedUser = await pb.collection("users").getOne(user.id);
      
      // Update both local state and PocketBase auth store
      setUser(updatedUser);
      
      // Update PocketBase auth store so it persists across refreshes
      if (pb.authStore.token && pb.authStore.model) {
        // Save the updated user data to auth store
        pb.authStore.save(pb.authStore.token, updatedUser);
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to update username");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuest,
        isLoading,
        login,
        logout,
        register,
        enterGuestMode,
        updateUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

