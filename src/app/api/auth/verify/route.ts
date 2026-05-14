/**
 * API Route publique - Vérification email
 * GET /api/auth/verify?token=xxx
 * Redirige vers /login avec un message de succès ou d'erreur
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendMail, welcomeEmail } from "@/lib/mail"

const BASE_URL = process.env.NEXTAUTH_URL || "https://gleba.fr"

function redirect(path: string) {
  return NextResponse.redirect(`${BASE_URL}${path}`)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return redirect("/login?verify=invalid")
  }

  try {
    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
    })

    if (!user) {
      return redirect("/login?verify=invalid")
    }

    // Vérifier l'expiration
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return redirect("/login?verify=expired")
    }

    // Déjà vérifié
    if (user.emailVerified) {
      return redirect("/login?verify=already")
    }

    // Marquer comme vérifié
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    })

    // Envoyer l'email de bienvenue maintenant que le compte est vérifié
    const welcome = welcomeEmail(user.name)
    sendMail({ to: user.email, subject: welcome.subject, html: welcome.html }).catch((err) =>
      console.error("Erreur envoi email bienvenue:", err)
    )

    return redirect("/login?verify=success")
  } catch (error) {
    console.error("GET /api/auth/verify error:", error)
    return redirect("/login?verify=error")
  }
}
