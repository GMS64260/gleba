/**
 * API Routes Admin - Utilisateur individuel
 * GET /api/admin/users/[id] - Details d'un utilisateur
 * PATCH /api/admin/users/[id] - Modifier un utilisateur
 * DELETE /api/admin/users/[id] - Supprimer un utilisateur
 */

import { WHERE_RECOLTE_SAISIE } from "@/lib/recolte/lignee"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { arreterAvantSuppression } from "@/lib/abonnement/stripe"
import { requireAdminApi, hashPassword } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { REVOCATION_CHANGEMENT_MOT_DE_PASSE } from "@/lib/mot-de-passe-revocation"
import { reemettreSession } from "@/lib/session-reemission"
import { reprendreReferentielCommunaute, COMMUNAUTE_USER_ID, supprimerDonneesSansCleEtrangere, supprimerFichiersUtilisateur } from "@/lib/account-lifecycle"
import { purgerCaisseEntrainementTx, refusConservationCaisse } from "@/lib/caisse/conservation"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/users/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            cultures: true,
            planches: true,
            recoltes: { where: WHERE_RECOLTE_SAISIE },
            fertilisations: true,
            objetsJardin: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("GET /api/admin/users/[id] error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'utilisateur" },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { name, password, role, active, emailVerified } = body

    // Le compte système « Communauté Gleba » (sentinelle, non connectable) n'est
    // ni modifiable ni supprimable — parité avec la garde du DELETE.
    if (id === COMMUNAUTE_USER_ID) {
      return NextResponse.json(
        { error: "Le compte système « Communauté Gleba » ne peut pas être modifié." },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur existe
    const existing = await prisma.user.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      )
    }

    // Empecher de se desactiver soi-meme ou de se retirer admin.
    // SEC-04 (revue Codex du 2026-11-12) : « soi-même » est la PERSONNE
    // connectée (acteur) ; `session.user.id` est l'exploitation visitée.
    if (getActeurId(session) === id) {
      if (active === false) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas désactiver votre propre compte" },
          { status: 400 }
        )
      }
      if (role === "USER" && existing.role === "ADMIN") {
        return NextResponse.json(
          { error: "Vous ne pouvez pas retirer vos propres droits admin" },
          { status: 400 }
        )
      }
    }

    // Preparer les données de mise a jour
    const updateData: {
      name?: string | null
      password?: string
      resetPasswordToken?: null
      resetPasswordExpires?: null
      apiToken?: null
      sessionVersion?: { increment: number }
      role?: "ADMIN" | "USER"
      active?: boolean
      emailVerified?: boolean
    } = {}

    if (name !== undefined) updateData.name = name || null
    if (role !== undefined) updateData.role = role
    if (active !== undefined) updateData.active = active
    // Issue #32 : seule porte de sortie pour un compte bloqué sur « Email non
    // vérifié » quand aucun email ne peut partir (instance sans SMTP, jeton
    // expiré, adresse d'origine perdue). Réservé à l'admin, qui atteste.
    if (typeof emailVerified === "boolean") updateData.emailVerified = emailVerified

    if (password) {
      // Même exigence que l'inscription et le changement par le membre (MC5).
      if (typeof password !== "string" || password.length < 12) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 12 caractères" },
          { status: 400 }
        )
      }
      updateData.password = await hashPassword(password)
      // Un mot de passe posé par l'administrateur révoque, comme les autres
      // chemins, le lien de réinitialisation en cours, le jeton d'API
      // (SEC-01, revue Codex du 2026-11-12) et toutes les sessions du compte,
      // consultations administrateur comprises (MC3).
      Object.assign(updateData, REVOCATION_CHANGEMENT_MOT_DE_PASSE)
    }

    // Mise a jour
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        emailVerified: true,
        updatedAt: true,
        sessionVersion: true,
      },
    })

    const { sessionVersion, ...rendu } = user
    const reponse = NextResponse.json(rendu)
    // L'administrateur qui règle son propre mot de passe garde sa session,
    // comme depuis Paramètres ; sinon elle tombe à la requête suivante.
    if (password && getActeurId(session) === id) {
      await reemettreSession(request, reponse, { acteurId: id, sessionVersion })
    }
    return reponse
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'utilisateur" },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params

    // Empecher de se supprimer soi-meme
    if (getActeurId(session) === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte" },
        { status: 400 }
      )
    }

    // Le compte système « Communauté Gleba » (sentinelle) n'est pas supprimable.
    if (id === COMMUNAUTE_USER_ID) {
      return NextResponse.json(
        { error: "Le compte système « Communauté Gleba » ne peut pas être supprimé." },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur existe
    const existing = await prisma.user.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      )
    }

    // Caisse en vente réelle : conservation six ans (LPF L. 102 B, ISCA).
    const refusCaisse = await refusConservationCaisse(id, "compte")
    if (refusCaisse) return refusCaisse

    await arreterAvantSuppression(id)

    // Décision produit #2 — reprise par la communauté : dans une transaction, on
    // réattribue d'abord les entrées de référentiel PARTAGÉES du membre à la
    // sentinelle « Communauté Gleba » (elles survivent, badge Communauté), PUIS on
    // supprime le compte — le cascade emporte alors ses données et ses entrées de
    // référentiel restées PRIVÉES.
    const { reprises } = await prisma.$transaction(
      async (tx) => {
        const r = await reprendreReferentielCommunaute(tx, id)
        await purgerCaisseEntrainementTx(tx, id)
        await tx.user.delete({ where: { id } })
        await supprimerDonneesSansCleEtrangere(tx, id)
        return r
      },
      // Le delete cascade sur toutes les données du compte (cultures, récoltes,
      // animaux…) — timeout élargi pour les comptes volumineux.
      { timeout: 30_000 }
    )

    // Comme la suppression par le membre (`DELETE /api/account`) : les
    // justificatifs, photos et archives de registre du compte partent aussi,
    // après le commit (revue du 2026-11-04).
    const fichiers = await supprimerFichiersUtilisateur(id)

    return NextResponse.json({
      success: true,
      referentielReprisParCommunaute: reprises,
      fichiersSupprimes: fichiers.dossiersSupprimes,
    })
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 }
    )
  }
}
