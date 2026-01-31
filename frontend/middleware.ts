import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Force HTTPS in production
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") !== "https" &&
    !request.url.includes("localhost") &&
    !request.url.includes("127.0.0.1")
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  // Add security headers
  const response = NextResponse.next();
  
  // HSTS (HTTP Strict Transport Security)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // X-Frame-Options - Allow same-origin embedding (needed for NewspaperAnimation iframe)
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  
  // X-Content-Type-Options
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // Referrer-Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions-Policy
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

