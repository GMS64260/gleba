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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        // Sécurité (audit 2026-07, #20) : une réinitialisation de mot de passe
        // révoque le token API MCP (glb_). Sans cela, un attaquant ayant généré
        // un token conservait un accès permanent malgré le changement de mdp.
        apiToken: null,
      },
    })

    return NextResponse.json({ ok: true, message: "Mot de passe modifié avec succès" })
  } catch (err) {
    console.error("POST /api/auth/reset-password:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
