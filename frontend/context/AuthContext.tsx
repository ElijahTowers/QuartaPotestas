"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getPocketBase } from "@/lib/pocketbase";

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pb = getPocketBase();

  // Load auth state on mount
  useEffect(() => {
    // Check if user is already authenticated
    const authData = pb.authStore.model;
    if (authData) {
      setUser(authData);
    }
    setIsLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
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
      const userData = await pb.collection("users").create({
        email,
        password,
        passwordConfirm,
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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        register,
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

