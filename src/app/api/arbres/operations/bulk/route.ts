/**
 * POST /api/arbres/operations/bulk
 *
 * Traitement en masse des opérations d'entretien verger.
 *
 * Constat de production du 2026-08-03 : un verger de 86 arbres accumulait 125
 * opérations générées en attente, chacune ne pouvant être validée que par un
 * bouton « Fait » individuel dans une liste non paginée — 125 appuis sur un
 * écran de 520 px. Aucune de ces 125 opérations n'avait jamais été validée. Un
 * mécanisme qui génère en masse doit se solder en masse.
 *
 * Deux actions, volontairement distinctes :
 *  - `fait`   : les opérations ont été réalisées (historique + auto-comptabilité) ;
 *  - `solder` : la fenêtre est refermée sans réalisation. Ce n'est pas un « fait »
 *               et l'on ne supprime rien : on conserve la trace de ce qui n'a pas
 *               été fait cette saison.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createDepenseFromOperationArbre } from "@/lib/auto-compta"

const ACTIONS = ["fait", "solder"] as const
type Action = (typeof ACTIONS)[number]

/** Garde-fou : au-delà, c'est une erreur d'appel, pas un geste utilisateur. */
const MAX_IDS = 1000

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json().catch(() => null)

    const action = body?.action as Action | undefined
    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Action invalide. Attendu : ${ACTIONS.join(" ou ")}` },
        { status: 400 }
      )
    }

    const rawIds: unknown = body?.ids
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "Aucune opération sélectionnée" },
        { status: 400 }
      )
    }
    if (rawIds.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Trop d'opérations en une fois (maximum ${MAX_IDS})` },
        { status: 400 }
      )
    }

    const ids = [...new Set(rawIds.map((id) => Number(id)))].filter(
      (id) => Number.isInteger(id) && id > 0
    )
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Aucun identifiant d'opération valide" },
        { status: 400 }
      )
    }

    // Isolation multi-tenant : on ne touche que les lignes du compte, et on
    // ignore silencieusement celles déjà traitées (double appui, onglet obsolète).
    const cibles = await prisma.operationArbre.findMany({
      where: { id: { in: ids }, userId, fait: false, abandonneeLe: null },
      select: { id: true, type: true, description: true, cout: true },
    })

    if (cibles.length === 0) {
      return NextResponse.json({ count: 0, action, ignored: ids.length })
    }

    const cibleIds = cibles.map((operation) => operation.id)
    const maintenant = new Date()

    if (action === "fait") {
      await prisma.operationArbre.updateMany({
        where: { id: { in: cibleIds }, userId },
        data: { fait: true, date: maintenant },
      })

      // Auto-comptabilité : seules les opérations portant un coût génèrent une
      // écriture. Une erreur comptable ne doit pas annuler la validation métier.
      for (const operation of cibles) {
        if (!operation.cout || operation.cout <= 0) continue
        try {
          await createDepenseFromOperationArbre(userId, {
            id: operation.id,
            type: operation.type,
            description: operation.description,
            cout: operation.cout,
            date: maintenant,
            fait: true,
          })
        } catch (autoComptaError) {
          console.error(
            "Auto-compta error (operations arbres bulk):",
            autoComptaError
          )
        }
      }
    } else {
      await prisma.operationArbre.updateMany({
        where: { id: { in: cibleIds }, userId },
        data: { abandonneeLe: maintenant },
      })
    }

    return NextResponse.json({
      count: cibleIds.length,
      action,
      ignored: ids.length - cibleIds.length,
    })
  } catch (err) {
    console.error("POST /api/arbres/operations/bulk error:", err)
    return NextResponse.json(
      { error: "Erreur lors du traitement en masse" },
      { status: 500 }
    )
  }
}
