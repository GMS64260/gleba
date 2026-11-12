/**
 * API Route publique - Réinitialisation effective du mot de passe
 * POST /api/auth/reset-password
 *
 * Body: { token, password }
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { hashPassword } from "@/lib/auth-utils"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { REVOCATION_CHANGEMENT_MOT_DE_PASSE } from "@/lib/mot-de-passe-revocation"

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const rateLimitError = checkRateLimit(`reset-password:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 10,
  })
  if (rateLimitError) return rateLimitError

  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token requis" }, { status: 400 })
    }

    if (!password || typeof password !== "string" || password.length < 12) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 12 caractères" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { resetPasswordToken: token },
    })

    if (!user || !user.resetPasswordExpires) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 }
      )
    }

    if (user.resetPasswordExpires < new Date()) {
      // Nettoyage du token expiré
      await prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: null, resetPasswordExpires: null },
      })
      return NextResponse.json(
        { error: "Le lien a expiré. Veuillez demander un nouvel email." },
        { status: 400 }
      )
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "Compte désactivé" },
        { status: 403 }
      )
    }

    const newHash = await hashPassword(password)

    // Consommation atomique du jeton (SEC-01, revue Codex du 2026-11-12) :
    // l'écriture n'a lieu que si CE jeton est toujours posé et valable au
    // moment d'écrire. Un changement de mot de passe ou une autre
    // réinitialisation survenus depuis la lecture l'ont effacé : rien n'est
    // écrit. Révoque aussi le jeton d'API (audit 2026-07, #20).
    const { count } = await prisma.user.updateMany({
      where: {
        id: user.id,
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
        active: true,
      },
      data: { password: newHash, ...REVOCATION_CHANGEMENT_MOT_DE_PASSE },
    })
    if (count !== 1) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, message: "Mot de passe modifié avec succès" })
  } catch (err) {
    console.error("POST /api/auth/reset-password:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
