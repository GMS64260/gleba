/**
 * API Route publique - Inscription
 * POST /api/auth/register
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import prisma from "@/lib/prisma"
import { hashPassword } from "@/lib/auth-utils"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { createSampleDataForUser } from "@/lib/user-sample-data"
import { sendMail, verifyEmailEmail, newUserNotificationEmail } from "@/lib/mail"

export async function POST(request: NextRequest) {
  // Rate limiting strict : 5 inscriptions par IP par heure
  const ip = getClientIP(request)
  const rateLimitError = checkRateLimit(`register:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  })
  if (rateLimitError) return rateLimitError

  try {
    const body = await request.json()
    const { email, password, name } = body

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      )
    }

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide" },
        { status: 400 }
      )
    }

    if (typeof password !== "string" || password.length < 12) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 12 caracteres" },
        { status: 400 }
      )
    }

    if (name && (typeof name !== "string" || name.length > 100)) {
      return NextResponse.json(
        { error: "Le nom ne doit pas depasser 100 caracteres" },
        { status: 400 }
      )
    }

    // Verifier si l'email existe deja
    const normalizedEmail = email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Un compte avec cet email existe deja" },
        { status: 409 }
      )
    }

    // Hash du mot de passe + token de verification
    const hashedPassword = await hashPassword(password)
    const verifyToken = randomBytes(32).toString("hex")
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    // Creation de l'utilisateur (non verifie)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name?.trim() || null,
        role: "USER",
        active: true,
        emailVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    // Creer les donnees d'exemple
    try {
      await createSampleDataForUser(user.id)
    } catch (sampleError) {
      console.error("Erreur creation donnees exemple:", sampleError)
    }

    // Envoyer l'email de verification (non bloquant)
    const verify = verifyEmailEmail(user.name, verifyToken)
    sendMail({ to: user.email, subject: verify.subject, html: verify.html }).catch((mailErr) =>
      console.error("Erreur envoi email verification:", mailErr)
    )

    // Notifier l'admin de la nouvelle inscription (non bloquant)
    const notif = newUserNotificationEmail(user)
    sendMail({ to: "contact@gleba.fr", subject: notif.subject, html: notif.html }).catch((mailErr) =>
      console.error("Erreur envoi notification admin:", mailErr)
    )

    return NextResponse.json(
      {
        message: "Compte cree. Verifiez votre email pour activer votre compte.",
        needsVerification: true,
        user: { email: user.email },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("POST /api/auth/register error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la creation du compte" },
      { status: 500 }
    )
  }
}
