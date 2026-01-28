import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Merriweather } from "next/font/google";
import { GameProvider } from "@/context/GameContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  weight: ["300", "400", "700", "900"],
  variable: "--font-merriweather",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quarta Potestas - The War Room",
  description: "Satirical Newspaper Simulation Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${merriweather.variable} antialiased`}
      >
        <AuthProvider>
          <GameProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "#1a0f08",
                  color: "#e6d5ac",
                  border: "1px solid #8b6f47",
                  fontFamily: "Georgia, serif",
                },
                success: {
                  iconTheme: {
                    primary: "#4ade80",
                    secondary: "#1a0f08",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#1a0f08",
                  },
                },
              }}
            />
          </GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
