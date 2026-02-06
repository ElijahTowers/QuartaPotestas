"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2, AlertCircle, Mail, Lock, Newspaper } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const { login, register, isAuthenticated, isLoading: authLoading, enterGuestMode } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated (use redirect param e.g. /monitor)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, authLoading, router, redirectTo]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2a1810] paper-texture py-8">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mx-auto mb-4" />
          <p className="text-[#e8dcc6] text-lg">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render form if already authenticated (will redirect via useEffect)
  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        router.push(redirectTo);
      } else {
        if (password !== passwordConfirm) {
          setError("Passwords do not match");
          setIsLoading(false);
          return;
        }
        await register(email, password, passwordConfirm);
        router.push(redirectTo);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#2a1810] paper-texture py-8 px-4">
      <div className="w-full max-w-md mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Newspaper className="w-12 h-12 text-[#d4af37]" />
            <h1 className="text-4xl font-bold text-[#e8dcc6] font-serif tracking-wider">
              QUARTA POTESTAS
            </h1>
          </div>
          <p className="text-[#8b6f47] text-sm font-mono">
            The War Room - Secure Access
          </p>
        </div>

        {/* Login/Register Form */}
        <div className="bg-[#1a0f08] border-2 border-[#8b6f47] rounded-lg p-6 shadow-2xl">
          {/* Toggle Login/Register */}
          <div className="flex gap-2 mb-6 border-b border-[#8b6f47]">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-serif transition-colors ${
                isLogin
                  ? "text-[#d4af37] border-b-2 border-[#d4af37]"
                  : "text-[#8b6f47] hover:text-[#a68a5a]"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-serif transition-colors ${
                !isLogin
                  ? "text-[#d4af37] border-b-2 border-[#d4af37]"
                  : "text-[#8b6f47] hover:text-[#a68a5a]"
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-serif text-[#e8dcc6] mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8b6f47]" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors"
                  placeholder="journalist@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-serif text-[#e8dcc6] mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8b6f47]" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Password Confirm Field (Register only) */}
            {!isLogin && (
              <div>
                <label
                  htmlFor="passwordConfirm"
                  className="block text-sm font-serif text-[#e8dcc6] mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8b6f47]" />
                  <input
                    id="passwordConfirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Submit + Forgot Password Row */}
            <div className="space-y-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#8b6f47] hover:bg-[#a68a5a] text-[#e8dcc6] font-serif font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isLogin ? "Logging in..." : "Registering..."}</span>
                  </>
                ) : (
                  <span>{isLogin ? "Access The War Room" : "Create Account"}</span>
                )}
              </button>
              {isLogin && (
                <p className="text-xs text-[#8b6f47] text-center font-mono">
                  <Link
                    href="/reset"
                    className="underline underline-offset-4 hover:text-[#d4af37] transition-colors"
                  >
                    Wachtwoord vergeten?
                  </Link>
                </p>
              )}
            </div>
          </form>

          {/* Pre-Alpha Disclaimer */}
          <div className="mt-6 p-3 bg-orange-900/20 border border-orange-700/50 rounded text-xs text-orange-200">
            <p className="font-bold mb-1 uppercase tracking-wider">⚠️ Pre-Alpha Build</p>
            <p className="text-orange-300/80">
              This site is in active development. Features may be incomplete or unstable. 
              Data may be reset during updates.
            </p>
          </div>

          {/* Browse as Guest Button */}
          <div className="mt-6 pt-4 border-t border-[#8b6f47]/30">
            <button
              type="button"
              onClick={() => {
                enterGuestMode();
                router.push("/");
              }}
              className="w-full py-2 bg-[#3a2418] hover:bg-[#4a3020] text-[#e8dcc6] font-serif text-sm rounded transition-colors border border-[#8b6f47]/50 hover:border-[#a68a5a]"
            >
              👁️ Browse as Guest (Read-Only)
            </button>
            <p className="mt-2 text-xs text-[#8b6f47] text-center font-mono">
              Explore the game without creating an account
            </p>
          </div>

          {/* Info Text */}
          <p className="mt-4 text-xs text-[#8b6f47] text-center font-mono">
            {isLogin
              ? "Enter your credentials to access the intelligence feed"
              : "Create an account to start intercepting the wire"}
          </p>
        </div>
      </div>
    </div>
  );
}

