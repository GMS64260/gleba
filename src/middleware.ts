/**
 * Middleware de protection des routes
 */

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Routes publiques (DEV2 #2 : pages légales accessibles sans login)
  const publicRoutes = [
    "/login", "/register", "/mot-de-passe-oublie", "/reset-password",
    "/roadmap", "/robots.txt", "/sitemap.xml", "/manifest.json", "/feedback",
    // RGPD / LCEN : doivent rester accessibles sans authentification
    "/cgv", "/mentions-legales", "/confidentialite",
    // Pages cibles SEO (marketing)
    "/logiciel-maraichage", "/logiciel-micro-ferme", "/logiciel-permaculture",
    "/logiciel-verger", "/logiciel-elevage", "/calendrier-semis",
    "/assistant-ia-agricole",
  ]
  // La home "/" est publique (Server Component qui sert la landing aux non connectés
  // et l'app aux connectés). Cas dédié car `route + "/"` matche tout avec route = "/".
  const isHomePage = pathname === "/"
  const isPublicRoute = isHomePage || publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  // Routes API publiques (auth NextAuth + MCP avec bearer token + feedback par token)
  const isAuthApi = pathname.startsWith("/api/auth")
  const isMcpApi = pathname.startsWith("/api/mcp")
  const isFeedbackTokenApi = /^\/api\/feedback\/[^/]+$/.test(pathname)
  // DEV2 #2 — Consentement cookies doit pouvoir être enregistré
  // pour les visiteurs anonymes (avant connexion).
  const isCookieConsentApi = pathname === "/api/cookie-consent"

  // Boutiques publiques : /boutique/[slug] (pas /boutique seul qui est admin)
  // et /api/boutique/public/*
  const isPublicBoutiquePage = /^\/boutique\/[^/]+/.test(pathname) && pathname !== "/boutique"
  const isPublicBoutiqueApi = pathname.startsWith("/api/boutique/public/")

  // Si route publique ou API auth/MCP/feedback, laisser passer
  if (isPublicRoute || isAuthApi || isMcpApi || isFeedbackTokenApi || isCookieConsentApi || isPublicBoutiquePage || isPublicBoutiqueApi) {
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
