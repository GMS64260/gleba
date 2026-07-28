/**
 * POST /api/admin/impersonate
 *
 * Génère un jeton de CONSULTATION lecture seule d'un compte utilisateur.
 * Réservé aux admins. Renvoie une URL one-time (valable 2 min, usage unique) à
 * ouvrir dans une fenêtre de navigation privée : elle connecte la fenêtre comme
 * l'utilisateur cible (provider NextAuth "impersonation"), sans écraser la
 * session admin de la fenêtre normale. La session obtenue est en lecture seule
 * (imposée par le middleware).
 */

import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { getClientIP } from "@/lib/rate-limit"
import {
  genererJetonImpersonation,
  hashJeton,
  IMPERSONATION_TTL_MS,
} from "@/lib/impersonation"

export async function POST(request: Request) {
  const { session, error } = await requireAdminApi(request)
  if (error) return error

  const adminId = session!.user.id

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }
  const targetId = body.userId
  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json({ error: "userId requis" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, name: true, active: true },
  })
  if (!target) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
  }
  if (!target.active) {
    return NextResponse.json({ error: "Compte désactivé — consultation impossible" }, { status: 400 })
  }

  const raw = genererJetonImpersonation()
  await prisma.impersonationGrant.create({
    data: {
      tokenHash: await hashJeton(raw),
      adminId,
      targetId,
      expiresAt: new Date(Date.now() + IMPERSONATION_TTL_MS),
      ip: getClientIP(request),
    },
  })

  return NextResponse.json({
    url: `/impersonation/consume?token=${raw}`,
    expiresInSec: Math.round(IMPERSONATION_TTL_MS / 1000),
    target: { id: target.id, email: target.email, name: target.name },
  })
}
