"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Database, Server, Brain, Cloud, Globe } from "lucide-react";

interface ServiceStatus {
  name: string;
  url: string;
  status: "checking" | "online" | "offline" | "error";
  responseTime?: number;
  icon: React.ReactNode;
  description: string;
}

export default function ServiceStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAllServices();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkAllServices, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkService = async (service: Omit<ServiceStatus, "status" | "responseTime">): Promise<ServiceStatus> => {
    const startTime = Date.now();
    
    try {
      // Special handling for different service types
      if (service.name === "PocketBase") {
        // Check PocketBase - try to access the API root
        try {
          const response = await fetch(`${service.url}/api/health`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });
          
          if (response.ok || response.status === 404) {
            // 404 is OK - means PocketBase is responding
            const responseTime = Date.now() - startTime;
            return { ...service, status: "online", responseTime };
          } else {
            return { ...service, status: "offline" };
          }
        } catch (error: any) {
          // If health endpoint doesn't exist, try root endpoint
          try {
            const response = await fetch(`${service.url}/`, {
              method: "GET",
              signal: AbortSignal.timeout(5000),
            });
            const responseTime = Date.now() - startTime;
            return { ...service, status: response.ok ? "online" : "offline", responseTime };
          } catch {
            return { ...service, status: "offline" };
          }
        }
      } else if (service.name === "FastAPI Backend") {
        // Check FastAPI health endpoint
        let healthUrl: string;
        if (service.url.includes("localhost") || service.url.includes("127.0.0.1") || service.url.startsWith("http://")) {
          // Direct connection
          healthUrl = `${service.url}/health`;
        } else {
          // Use Next.js proxy for production
          healthUrl = `/api/proxy/health`;
        }
        
        try {
          const response = await fetch(healthUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5000),
          });
          
          if (response.ok) {
            const responseTime = Date.now() - startTime;
            return { ...service, status: "online", responseTime };
          } else {
            return { ...service, status: "offline" };
          }
        } catch (error) {
          return { ...service, status: "offline" };
        }
      } else if (service.name === "Ollama AI") {
        // Check Ollama API
        const response = await fetch(`${service.url}/api/tags`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          const responseTime = Date.now() - startTime;
          return { ...service, status: "online", responseTime };
        } else {
          return { ...service, status: "offline" };
        }
      } else if (service.name === "Cloudflare Tunnel") {
        // If we're accessing via the custom domain, the tunnel is by definition online
        // (otherwise we wouldn't be able to see this page)
        const testUrl = typeof window !== "undefined" ? window.location.origin : "";
        if (testUrl.includes("quartapotestas.com")) {
          // Tunnel is online if we can access the site via custom domain
          // Try a quick health check to confirm connectivity
          try {
            const response = await fetch(`${testUrl}/api/health`, {
              method: "GET",
              signal: AbortSignal.timeout(5000),
            });
            const responseTime = Date.now() - startTime;
            // Even if health check fails, if we're on the domain, tunnel is working
            return { ...service, status: "online", responseTime: responseTime || 0 };
          } catch {
            // If we're on the domain, tunnel must be working (we loaded the page)
            return { ...service, status: "online", responseTime: 0 };
          }
        } else {
          // Not using Cloudflare tunnel (accessing via localhost)
          return { ...service, status: "offline", description: "Not configured (using localhost)" };
        }
      } else if (service.name === "Next.js Frontend") {
        // Frontend is always online if we can see this page
        const responseTime = Date.now() - startTime;
        return { ...service, status: "online", responseTime: 0 };
      } else {
        // Generic check
        try {
          const response = await fetch(service.url, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          });
          const responseTime = Date.now() - startTime;
          return { ...service, status: response.ok ? "online" : "offline", responseTime };
        } catch {
          return { ...service, status: "offline" };
        }
      }
    } catch (error) {
      return { ...service, status: "error" };
    }
  };

  const checkAllServices = async () => {
    setIsChecking(true);
    
    // Determine service URLs based on current environment
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    
    const isProduction = hostname === "quartapotestas.com" || hostname === "www.quartapotestas.com";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    
    // PocketBase URL
    const pbUrl = isProduction 
      ? "https://db.quartapotestas.com"
      : isLocalhost
      ? "http://127.0.0.1:8090"
      : `http://${hostname}:8090`;
    
    // FastAPI Backend URL
    const apiUrl = isProduction
      ? "https://quartapotestas.com/api/proxy" // Will use Next.js proxy
      : isLocalhost
      ? "http://localhost:8000"
      : `http://${hostname}:8000`;
    
    // Ollama URL (default local, can be overridden via env)
    const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
    
    const servicesToCheck: Omit<ServiceStatus, "status" | "responseTime">[] = [
      {
        name: "PocketBase",
        url: pbUrl,
        icon: <Database className="w-5 h-5" />,
        description: "Database service for user data, articles, and published editions",
      },
      {
        name: "FastAPI Backend",
        url: apiUrl || "http://localhost:8000",
        icon: <Server className="w-5 h-5" />,
        description: "Backend API for article ingestion, publishing, and game logic",
      },
      {
        name: "Ollama AI",
        url: ollamaUrl,
        icon: <Brain className="w-5 h-5" />,
        description: "AI service for generating article variants and metadata",
      },
      {
        name: "Cloudflare Tunnel",
        url: isProduction ? "https://quartapotestas.com" : "",
        icon: <Cloud className="w-5 h-5" />,
        description: "Tunnel service for public access (production only)",
      },
      {
        name: "Next.js Frontend",
        url: typeof window !== "undefined" ? window.location.origin : "",
        icon: <Globe className="w-5 h-5" />,
        description: "Frontend application (this page)",
      },
    ];

    // Check all services in parallel
    const results = await Promise.all(
      servicesToCheck.map(service => checkService(service))
    );

    setServices(results);
    setIsChecking(false);
  };

  const getStatusIcon = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "online":
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "offline":
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "checking":
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
    }
  };

  const getStatusText = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "online":
        return "Online";
      case "offline":
        return "Offline";
      case "error":
        return "Error";
      case "checking":
        return "Checking...";
    }
  };

  const getStatusColor = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "online":
        return "text-green-400 border-green-400/30 bg-green-400/10";
      case "offline":
      case "error":
        return "text-red-400 border-red-400/30 bg-red-400/10";
      case "checking":
        return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    }
  };

  return (
    <div className="bg-[#f9f6f0] p-6 rounded shadow-2xl border-2 border-[#8b6f47] relative">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none rounded"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#1a0f08] font-serif flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-[#8b6f47]" />
            Service Status
          </h2>
          <button
            onClick={checkAllServices}
            disabled={isChecking}
            className="px-4 py-2 bg-[#8b6f47] text-[#f4e4bc] rounded hover:bg-[#a68a5a] transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Refresh"
            )}
          </button>
        </div>

        <div className="space-y-3">
          {services.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#8b6f47] animate-spin" />
            </div>
          ) : (
            services.map((service, index) => (
              <div
                key={index}
                className={`p-4 rounded border-2 ${getStatusColor(service.status)} transition-all`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {service.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-[#1a0f08] font-serif text-lg">
                        {service.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(service.status)}
                        <span className="text-sm font-mono">
                          {getStatusText(service.status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-[#8b6f47] mb-2">
                      {service.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-[#8b6f47]">
                      <code className="bg-[#8b6f47]/20 px-2 py-1 rounded font-mono break-all">
                        {service.url || "N/A"}
                      </code>
                      {service.status === "online" && service.responseTime && (
                        <span className="text-green-600 font-mono">
                          {service.responseTime}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-[#8b6f47]/30">
          <p className="text-xs text-[#8b6f47] text-center">
            Status automatically refreshes every 30 seconds. Last checked: {new Date().toLocaleTimeString("nl-NL")}
          </p>
        </div>
      </div>
    </div>
  );
}

