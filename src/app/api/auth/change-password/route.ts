/**
 * Self-service de changement de mot de passe.
 * POST /api/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 *
 * Exige une session active. Vérifie le mot de passe actuel avant
 * d'appliquer le nouveau (anti hijack de session). Rate-limit pour
 * limiter la force brute sur le currentPassword.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi, hashPassword, verifyPassword } from "@/lib/auth-utils"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"

const MIN_PASSWORD_LENGTH = 12

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  // Rate-limit par IP + email pour empêcher le brute-force sur currentPassword
  const ip = getClientIP(request)
  const rateLimitError = checkRateLimit(
    `change-password:${ip}:${session!.user.email}`,
    { windowMs: 15 * 60 * 1000, max: 10 }
  )
  if (rateLimitError) return rateLimitError

  try {
    const body = await request.json().catch(() => ({}))
    const { currentPassword, newPassword } = body

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Mot de passe actuel requis" },
        { status: 400 }
      )
    }
    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "Nouveau mot de passe requis" },
        { status: 400 }
      )
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères` },
        { status: 400 }
      )
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit être différent de l'actuel" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { id: true, password: true },
    })
    if (!user || !user.password) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    }

    const valid = await verifyPassword(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect" },
        { status: 401 }
      )
    }

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    })

    return NextResponse.json({ success: true, message: "Mot de passe modifié" })
  } catch (err) {
    console.error("POST /api/auth/change-password error:", err)
    return NextResponse.json(
      { error: "Erreur lors du changement de mot de passe" },
      { status: 500 }
    )
  }
}
