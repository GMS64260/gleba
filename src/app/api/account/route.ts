/**
 * Suppression de son propre compte par le membre.
 * DELETE /api/account
 *
 * Exigence Google Play (politique sur les données utilisateur) et RGPD : tout
 * compte créé depuis l'application doit pouvoir être supprimé depuis
 * l'application, sans passer par le support. La procédure publique associée est
 * décrite sur /suppression-compte.
 *
 * À ne pas confondre avec DELETE /api/user/delete-data, qui vide les données
 * métier mais CONSERVE le compte.
 */

import { NextRequest, NextResponse } from "next/server"

import prisma from "@/lib/prisma"
import { requireAuthApi, verifyPassword } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import {
  reprendreReferentielCommunaute,
  supprimerFichiersUtilisateur,
  COMMUNAUTE_USER_ID,
} from "@/lib/account-lifecycle"
import { sendMail, accountDeletedEmail } from "@/lib/mail"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"

/**
 * GET /api/account — état du compte pour l'écran Paramètres.
 * `hasPassword: false` = compte créé via Google sans mot de passe local : la
 * confirmation de suppression ne peut alors pas demander de mot de passe.
 */
export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const user = await prisma.user.findUnique({
      // Identité de la PERSONNE connectée, pas de l'exploitation visitée.
      where: { id: getActeurId(session) },
      select: { password: true },
    })
    if (!user) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })
    }
    return NextResponse.json({ hasPassword: Boolean(user.password) })
  } catch (err) {
    console.error("GET /api/account error:", err)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  // Le mot de passe est revérifié ici : une session volée ne doit pas suffire à
  // détruire une exploitation. Rate limit sur l'IP pour ne pas offrir un oracle
  // de test de mot de passe.
  const rateLimitError = checkRateLimit(`account-delete:${getClientIP(request)}`, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  })
  if (rateLimitError) return rateLimitError

  try {
    // Supprimer SON compte : l'acteur. Un membre invité ne doit jamais
    // pouvoir détruire l'exploitation qui l'accueille.
    const userId = getActeurId(session)

    // Une session de consultation admin est en lecture seule : l'admin ne doit
    // pas pouvoir supprimer le compte du membre qu'il dépanne.
    if (session!.user.impersonatedBy) {
      return NextResponse.json(
        { error: "Suppression impossible pendant une session de consultation." },
        { status: 403 }
      )
    }

    if (userId === COMMUNAUTE_USER_ID) {
      return NextResponse.json(
        { error: "Le compte système « Communauté Gleba » ne peut pas être supprimé." },
        { status: 400 }
      )
    }

    const body = (await request.json().catch(() => null)) as { password?: unknown } | null
    const password = typeof body?.password === "string" ? body.password : ""

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, password: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })
    }

    // Un administrateur qui se supprimerait lui-même pourrait rendre la console
    // d'administration inaccessible. Il passe par un autre administrateur.
    if (user.role === "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Un compte administrateur ne peut pas être supprimé depuis l'application. Écrivez à contact@gleba.fr.",
        },
        { status: 403 }
      )
    }

    if (user.password) {
      if (!password) {
        return NextResponse.json(
          { error: "Mot de passe requis pour confirmer la suppression." },
          { status: 400 }
        )
      }
      if (!(await verifyPassword(password, user.password))) {
        return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
      }
    }
    // Compte créé via Google, sans mot de passe local : il n'y a rien à
    // revérifier côté serveur. La session active, le rate limit et la
    // confirmation explicite « SUPPRIMER » côté client tiennent lieu de garde
    // (même niveau d'exigence que la politique Google Play).

    // Même contrat que la suppression admin : les entrées de référentiel
    // PARTAGÉES sont reprises par la sentinelle « Communauté Gleba » avant le
    // delete, qui emporte en cascade le reste du compte.
    await prisma.$transaction(
      async (tx) => {
        await reprendreReferentielCommunaute(tx, userId)
        await tx.user.delete({ where: { id: userId } })
      },
      { timeout: 30_000 }
    )

    // Après le commit uniquement : ni le ménage des fichiers ni l'email ne
    // doivent pouvoir annuler une suppression déjà acquise en base.
    const fichiers = await supprimerFichiersUtilisateur(userId)

    try {
      const mail = accountDeletedEmail(user.name)
      await sendMail({ to: user.email, subject: mail.subject, html: mail.html })
    } catch (mailError) {
      console.error("DELETE /api/account — email de confirmation non envoyé:", mailError)
    }

    return NextResponse.json({
      success: true,
      message: "Votre compte et vos données ont été définitivement supprimés.",
      fichiersSupprimes: fichiers.dossiersSupprimes,
    })
  } catch (err) {
    console.error("DELETE /api/account error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression du compte" },
      { status: 500 }
    )
  }
}
