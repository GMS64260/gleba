/**
 * Middleware de protection des routes
 */

import { auth } from "@/lib/auth"
import {
  estSurfaceAdministration,
  motifInterdictionConsultation,
} from "@/lib/impersonation-policy"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const isAdminRoute = estSurfaceAdministration(pathname)

  // La racine reste une landing statique pour les visiteurs et les moteurs.
  // Une session active reçoit le tableau de bord par réécriture interne afin
  // de conserver l'URL historique `/` et tous les liens applicatifs existants.
  if (pathname === "/" && isLoggedIn) {
    return NextResponse.rewrite(new URL("/dashboard", req.nextUrl))
  }

  // Compatibilité des anciens justificatifs stockés sous public/uploads :
  // même authentifié, un utilisateur ne doit jamais lire le dossier d'un autre.
  const legacyJustificatif = /^\/uploads\/([^/]+)\/justificatifs\//.exec(pathname)
  if (legacyJustificatif && (!isLoggedIn || legacyJustificatif[1] !== req.auth?.user?.id)) {
    return new NextResponse(null, { status: 404 })
  }

  // Routes publiques (DEV2 #2 : pages légales accessibles sans login)
  const publicRoutes = [
    "/login", "/register", "/mot-de-passe-oublie", "/reset-password",
    "/communaute", "/referentiel", "/glossaire", "/licence",
    "/robots.txt", "/sitemap.xml", "/manifest.json",
    "/.well-known/assetlinks.json", "/feedback",
    "/1c943f7c7006d54211c7143b25a23aa8.txt",
    "/desabonnement",
    // Consultation admin : la page qui consomme le jeton d'impersonation doit
    // être atteignable SANS session (elle EST le point d'entrée qui connecte,
    // typiquement dans une fenêtre de navigation privée).
    "/impersonation",
    // RGPD / LCEN : doivent rester accessibles sans authentification
    "/cgv", "/mentions-legales", "/confidentialite",
    // Pages cibles SEO (marketing)
    "/logiciel-maraichage", "/logiciel-micro-ferme", "/logiciel-permaculture",
    "/logiciel-verger", "/logiciel-elevage", "/calendrier-semis",
    "/assistant-ia-agricole", "/logiciel-arboriculture",
    "/logiciel-elevage-volailles", "/planification-maraichage",
    "/logiciel-elevage-ovin", "/logiciel-elevage-caprin",
    "/logiciel-elevage-canin-felin", "/logiciel-elevage-equin",
    "/logiciel-elevage-nac",
    "/rotation-cultures-maraichage", "/itineraire-technique-maraichage",
    "/registre-phytosanitaire", "/referentiel",
    "/logiciel-potager",
  ]
  // La home publique est traitée à part car `route + "/"` matcherait tout
  // avec une route égale à "/".
  const isHomePage = pathname === "/"
  const isPublicRoute = isHomePage || publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))

  // Routes API publiques (auth NextAuth + MCP avec bearer token + feedback par token)
  const isAuthApi = pathname.startsWith("/api/auth")
  const isMcpApi = pathname.startsWith("/api/mcp")
  const isFeedbackTokenApi = /^\/api\/feedback\/[^/]+$/.test(pathname)
  // Désabonnement par token (public, sans authentification)
  const isUnsubscribeApi = /^\/api\/desabonnement\/[^/]+$/.test(pathname)
  // DEV2 #2 — Consentement cookies doit pouvoir être enregistré
  // pour les visiteurs anonymes (avant connexion).
  const isCookieConsentApi = pathname === "/api/cookie-consent"

  // Boutiques publiques : /boutique/[slug] (pas /boutique seul qui est admin)
  // et /api/boutique/public/*
  const isPublicBoutiquePage = /^\/boutique\/[^/]+/.test(pathname) && pathname !== "/boutique"
  const isPublicBoutiqueApi = pathname.startsWith("/api/boutique/public/")

  // API publiques en lecture seule (ex : Community Voice anonyme)
  const isPublicApi = pathname.startsWith("/api/public/")

  // La lecture seule doit être évaluée AVANT toute sortie publique. Une route
  // publique peut elle aussi écrire (consentement, commande boutique, feedback).
  if (req.auth?.user?.impersonatedBy) {
    const motif = motifInterdictionConsultation(pathname, req.method)
    if (motif) {
      if (motif === "ADMINISTRATION" && !pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/", req.nextUrl))
      }
      return NextResponse.json(
        { error: "Consultation admin — lecture seule. Action impossible." },
        { status: 403 },
      )
    }
  }

  // Si route publique ou API auth/MCP/feedback, laisser passer
  if (isPublicRoute || isAuthApi || isMcpApi || isFeedbackTokenApi || isUnsubscribeApi || isCookieConsentApi || isPublicBoutiquePage || isPublicBoutiqueApi || isPublicApi) {
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

  if (isAdminRoute && req.auth?.user?.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/", req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Les anciens justificatifs image seraient sinon exclus par l'extension.
    "/uploads/:path*",
    // Matcher tout sauf les fichiers statiques
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
