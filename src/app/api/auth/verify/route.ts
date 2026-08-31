/**
 * API Route publique - Vérification email
 * GET /api/auth/verify?token=xxx
 * Redirige vers /login avec un message de succès ou d'erreur
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendMail, welcomeEmail } from "@/lib/mail"
import {
  getOrCreateUnsubscribeToken,
  unsubscribeUrl,
  listUnsubscribeHeaders,
} from "@/lib/unsubscribe"

const BASE_URL = process.env.NEXTAUTH_URL || "https://gleba.fr"

function redirect(path: string) {
  return NextResponse.redirect(`${BASE_URL}${path}`)
}

/**
 * `HEAD` ne vérifie RIEN.
 *
 * Next.js répond aux requêtes `HEAD` en appelant l'export `GET`. Or ce `GET`
 * mute : il pose `emailVerified`, EFFACE le jeton et envoie l'email de
 * bienvenue. Un scanner de liens, un antivirus de messagerie ou un aperçu de
 * client mail qui préfetche le lien du courriel d'activation consommait donc la
 * vérification à la place de l'inscrit — qui tombait ensuite sur
 * `/login?verify=already` sans avoir jamais cliqué.
 *
 * Constaté le 2026-08-26 en sondant le point d'entrée : `HEAD /api/auth/verify`
 * exécutait bien le corps du `GET` (307 vers `/login?verify=invalid` sans
 * jeton). On répond désormais 200 sans effet de bord — un préchargement peut
 * vérifier que le lien existe, il ne peut plus le brûler.
 */
export function HEAD() {
  return new Response(null, { status: 200 })
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
    const unsubToken = await getOrCreateUnsubscribeToken(user.id)
    const welcome = welcomeEmail(user.name, unsubscribeUrl(unsubToken))
    sendMail({
      to: user.email,
      subject: welcome.subject,
      html: welcome.html,
      headers: listUnsubscribeHeaders(unsubToken),
    }).catch((err) => console.error("Erreur envoi email bienvenue:", err))

    return redirect("/login?verify=success")
  } catch (error) {
    console.error("GET /api/auth/verify error:", error)
    return redirect("/login?verify=error")
  }
}
