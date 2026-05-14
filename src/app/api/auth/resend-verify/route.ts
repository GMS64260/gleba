/**
 * API Route publique - Renvoyer l'email de vérification
 * POST /api/auth/resend-verify { email }
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { sendMail, verifyEmailEmail } from "@/lib/mail"

export async function POST(request: NextRequest) {
  // Rate limiting : 3 renvois par IP par 15 min
  const ip = getClientIP(request)
  const rateLimitError = checkRateLimit(`resend-verify:${ip}`, {
    windowMs: 15 * 60 * 1000,
    max: 3,
  })
  if (rateLimitError) return rateLimitError

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Toujours retourner succes pour ne pas leaker l'existence du compte
    if (!user || user.emailVerified) {
      return NextResponse.json({ message: "Si ce compte existe, un email a été envoyé." })
    }

    // Generer un nouveau token
    const verifyToken = randomBytes(32).toString("hex")
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
    })

    const verify = verifyEmailEmail(user.name, verifyToken)
    await sendMail({ to: user.email, subject: verify.subject, html: verify.html })

    return NextResponse.json({ message: "Si ce compte existe, un email a été envoyé." })
  } catch (error) {
    console.error("POST /api/auth/resend-verify error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi" },
      { status: 500 }
    )
  }
}
