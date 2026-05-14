/**
 * DEV2 audit Larcher - P0 #2 — RGPD
 *
 * POST /api/cookie-consent
 *   Enregistre le choix de l'utilisateur ou visiteur sur les catégories
 *   de cookies. Durée de vie 13 mois max (CNIL — delib 2020-091).
 *
 * Body : {
 *   sessionId?: string,     // cookie technique anonyme côté navigateur
 *   analytics: boolean,
 *   marketing: boolean,
 *   personnalisation: boolean,
 * }
 *
 * On hash l'IP (SHA-256 + sel "gleba-cookie-2026") pour éviter de stocker
 * une donnée directement identifiante.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth-utils"
import { createHash } from "crypto"
import { getClientIP } from "@/lib/rate-limit"

const HASH_SALT = "gleba-cookie-2026"
const VALIDITY_DAYS = 395 // ≈ 13 mois

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + HASH_SALT).digest("hex").slice(0, 32)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const analytics = Boolean(body.analytics)
    const marketing = Boolean(body.marketing)
    const personnalisation = Boolean(body.personnalisation)
    const sessionId = body.sessionId || null

    const session = await getSession()
    const userId = session?.user?.id || null
    const ip = getClientIP(request)
    const ipHash = ip ? hashIp(ip) : null
    const userAgent = request.headers.get("user-agent") || null

    const expiresAt = new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000)

    const consent = await prisma.cookieConsent.create({
      data: {
        userId,
        sessionId,
        ipHash,
        userAgent,
        essentiel: true,
        analytics,
        marketing,
        personnalisation,
        expiresAt,
      },
    })

    return NextResponse.json({
      id: consent.id,
      expiresAt: consent.expiresAt.toISOString(),
    })
  } catch (err) {
    console.error("POST /api/cookie-consent error:", err)
    return NextResponse.json(
      { error: "Erreur enregistrement consentement" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Récupère le consentement actif de la session/user courant
  const session = await getSession()
  const userId = session?.user?.id
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!userId && !sessionId) {
    return NextResponse.json({ consent: null })
  }

  const now = new Date()
  const consent = await prisma.cookieConsent.findFirst({
    where: {
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(sessionId ? [{ sessionId }] : []),
      ],
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ consent })
}
