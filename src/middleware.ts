/**
 * Middleware de protection des routes
 */

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Routes publiques
  const publicRoutes = ["/login", "/register", "/mot-de-passe-oublie", "/reset-password", "/roadmap", "/robots.txt", "/sitemap.xml", "/manifest.json", "/feedback"]
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  // Routes API publiques (auth NextAuth + MCP avec bearer token + feedback par token)
  const isAuthApi = pathname.startsWith("/api/auth")
  const isMcpApi = pathname.startsWith("/api/mcp")
  const isFeedbackTokenApi = /^\/api\/feedback\/[^/]+$/.test(pathname)

  // Boutiques publiques : /boutique/[slug] (pas /boutique seul qui est admin)
  // et /api/boutique/public/*
  const isPublicBoutiquePage = /^\/boutique\/[^/]+/.test(pathname) && pathname !== "/boutique"
  const isPublicBoutiqueApi = pathname.startsWith("/api/boutique/public/")

  // Si route publique ou API auth/MCP/feedback, laisser passer
  if (isPublicRoute || isAuthApi || isMcpApi || isFeedbackTokenApi || isPublicBoutiquePage || isPublicBoutiqueApi) {
    // Si connecté et sur login, rediriger vers home
    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/", req.nextUrl))
    }
    return NextResponse.next()
  }

  // Si non connecté, rediriger vers login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Routes admin
  const adminRoutes = ["/admin"]
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route))

  if (isAdminRoute && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Matcher tout sauf les fichiers statiques
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
