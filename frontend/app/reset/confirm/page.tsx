"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset } from "@/lib/api";
import { Loader2, Lock, Newspaper } from "lucide-react";

export default function ResetConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Ongeldige of ontbrekende resetlink.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(token, password, passwordConfirm);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Resetten van wachtwoord is mislukt.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2a1810] paper-texture">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Newspaper className="w-12 h-12 text-[#d4af37]" />
            <h1 className="text-3xl font-bold text-[#e8dcc6] font-serif tracking-wider">
              NIEUW WACHTWOORD
            </h1>
          </div>
          <p className="text-[#8b6f47] text-sm font-mono">
            Stel een nieuw toegangswachtwoord in
          </p>
        </div>

        <div className="bg-[#1a0f08] border-2 border-[#8b6f47] rounded-lg p-6 shadow-2xl">
          {done ? (
            <div className="space-y-4 text-sm text-[#e8dcc6] font-serif">
              <p>Je wachtwoord is bijgewerkt.</p>
              <p className="text-[#8b6f47]">
                Je kunt nu inloggen met je nieuwe wachtwoord.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full mt-4 py-2 bg-[#8b6f47] hover:bg-[#a68a5a] text-[#e8dcc6] font-serif font-bold rounded transition-colors"
              >
                Naar login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-400 bg-red-900/40 border border-red-700 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-serif text-[#e8dcc6] mb-2"
                >
                  Nieuw wachtwoord
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8b6f47]" />
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="passwordConfirm"
                  className="block text-sm font-serif text-[#e8dcc6] mb-2"
                >
                  Bevestig nieuw wachtwoord
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8b6f47]" />
                  <input
                    id="passwordConfirm"
                    type="password"
                    required
                    minLength={8}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#8b6f47] hover:bg-[#a68a5a] text-[#e8dcc6] font-serif font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Wachtwoord opslaan...</span>
                  </>
                ) : (
                  <span>Bevestig nieuw wachtwoord</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


