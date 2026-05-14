/**
 * API Route publique - Demande de réinitialisation de mot de passe
 * POST /api/auth/forgot-password
 *
 * Génère un token de reset (valide 1h) et envoie un email avec le lien.
 * Pour des raisons de sécurité, retourne toujours un succès même si l'email n'existe pas.
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { sendMail, passwordResetEmail } from "@/lib/mail"

export async function POST(request: NextRequest) {
  // Rate limiting strict : 5 demandes par IP par heure (anti-spam)
  const ip = getClientIP(request)
  const rateLimitError = checkRateLimit(`forgot-password:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  })
  if (rateLimitError) return rateLimitError

  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Toujours retourner succès — ne pas révéler l'existence d'un compte
    if (!user || !user.active) {
      return NextResponse.json({
        ok: true,
        message: "Si un compte existe avec cette adresse, un email a été envoyé.",
      })
    }

    // Génération du token
    const token = randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1h

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expires,
      },
    })

    // Envoi email (non-bloquant si SMTP non configuré)
    try {
      const mailContent = passwordResetEmail(user.name, token)
      await sendMail({
        to: user.email,
        subject: mailContent.subject,
        html: mailContent.html,
      })
    } catch (err) {
      console.error("Erreur envoi email reset:", err)
      // On ne bloque pas — le token est en DB, l'admin peut le récupérer si besoin
    }

    return NextResponse.json({
      ok: true,
      message: "Si un compte existe avec cette adresse, un email a été envoyé.",
    })
  } catch (err) {
    console.error("POST /api/auth/forgot-password:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
