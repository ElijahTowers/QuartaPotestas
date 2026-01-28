"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "@/lib/api";
import { Loader2, Mail, Newspaper } from "lucide-react";

export default function ResetRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await requestPasswordReset(email);
      setDone(true);
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
              RESET ACCESS
            </h1>
          </div>
          <p className="text-[#8b6f47] text-sm font-mono">
            Vraag een nieuwe toegangscode aan
          </p>
        </div>

        <div className="bg-[#1a0f08] border-2 border-[#8b6f47] rounded-lg p-6 shadow-2xl">
          {done ? (
            <div className="space-y-4 text-sm text-[#e8dcc6] font-serif">
              <p>
                Als dit e-mailadres bij ons bekend is, sturen we een resetlink naar de inbox.
              </p>
              <p className="text-[#8b6f47]">
                Check je e-mail en volg de instructies om een nieuw wachtwoord in te stellen.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full mt-4 py-2 bg-[#8b6f47] hover:bg-[#a68a5a] text-[#e8dcc6] font-serif font-bold rounded transition-colors"
              >
                Terug naar login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-serif text-[#e8dcc6] mb-2"
                >
                  Registratie e-mailadres
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#8b6f47]" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#2a1810] border border-[#8b6f47] rounded text-[#e8dcc6] placeholder-[#8b6f47] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-colors"
                    placeholder="journalist@example.com"
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
                    <span>Verzoek versturen...</span>
                  </>
                ) : (
                  <span>Stuur resetlink</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


