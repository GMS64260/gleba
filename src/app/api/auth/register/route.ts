/**
 * API Route publique - Inscription
 * POST /api/auth/register
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import prisma from "@/lib/prisma"
import { hashPassword } from "@/lib/auth-utils"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { sendMail, verifyEmailEmail, newUserNotificationEmail } from "@/lib/mail"
import { envoyerVerification } from "@/lib/mail-verification"

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

    // Refonte onboarding 2026-08-17 : plus de données d'exemple d'office au
    // signup — elles étaient géolocalisées en dur à Paris 4ᵉ et faussaient
    // météo, arrosage et éphémérides pour tout inscrit. Le parcours de
    // première connexion (/onboarding) les propose désormais comme choix
    // explicite, ancrées sur la commune réelle de l'exploitation.

    // Email de verification : ATTENDU, car c'est la seule clé d'activation du
    // compte. Vigie du 2026-08-17 (signalement vigie1919cd84) : un envoi refusé
    // par le serveur SMTP (« 550 invalid DNS MX » sur un domaine inexistant)
    // n'était que journalisé, et l'inscrit lisait quand même « Vérifiez votre
    // email » — il attendait un message qui ne partirait jamais, sans savoir
    // que son adresse était en cause ni qu'un renvoi existe.
    //
    // Le compte reste créé (il l'est déjà, et le renvoi permet de le rattraper).
    // Seul le MESSAGE change : on dit la vérité sur l'envoi.
    const verify = verifyEmailEmail(user.name, verifyToken)
    const envoi = await envoyerVerification(user.email, verify)

    // Notifier l'admin de la nouvelle inscription (non bloquant : son échec ne
    // concerne pas l'inscrit).
    const notif = newUserNotificationEmail(user)
    sendMail({ to: "contact@gleba.fr", subject: notif.subject, html: notif.html }).catch((mailErr) =>
      console.error("Erreur envoi notification admin:", mailErr)
    )

    return NextResponse.json(
      {
        message: envoi.envoye
          ? "Compte cree. Verifiez votre email pour activer votre compte."
          : "Compte créé, mais l'email de vérification n'a pas pu être envoyé.",
        needsVerification: true,
        emailEnvoye: envoi.envoye,
        emailEchec: envoi.envoye ? null : envoi.cause,
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
