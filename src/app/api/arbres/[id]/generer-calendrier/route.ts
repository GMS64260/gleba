/**
 * POST /api/arbres/:id/generer-calendrier
 * Génère automatiquement les opérations d'entretien pour un arbre
 */

import { NextRequest, NextResponse } from "next/server"
import { startOfDay, endOfDay } from 'date-fns'
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { findTreeCareProfile } from "@/lib/tree-care-calendar"
import { jourDePlantation, planCalendrierEntretien } from "@/lib/verger/creation-arbre"

/** Bornes d'une année demandée explicitement (rattrapage ou anticipation). */
const ANNEE_MIN = 1900
const ECART_ANNEE_MAX = 5

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const arbre = await prisma.arbre.findFirst({
      where: { id: arbreId, userId: session!.user.id },
    })

    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
    }

    if (!arbre.espece) {
      return NextResponse.json(
        { error: "L'arbre n'a pas d'espèce renseignée" },
        { status: 400 }
      )
    }

    // Ticket cmsofzh0w — le type de l'arbre borne la recherche : un
    // Châtaignier FORESTIER ne doit pas recevoir le calendrier fruitier.
    const profile = findTreeCareProfile(arbre.espece, arbre.type)
    if (!profile) {
      // Message explicite quand l'espèce existe au référentiel mais que la
      // conduite de l'arbre (forestier, ornement, haie) l'exclut.
      const profilAutreConduite = findTreeCareProfile(arbre.espece)
      const message = profilAutreConduite
        ? `"${arbre.espece}" est enregistré comme arbre de type "${arbre.type}" : le calendrier ${profilAutreConduite.type} du référentiel ne s'applique pas à cette conduite`
        : `Aucun calendrier d'entretien connu pour "${arbre.espece}"`
      return NextResponse.json({ error: message }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const anneeDemandee = body?.year === undefined || body?.year === null ? null : Number(body.year)
    const anneeMax = new Date().getFullYear() + ECART_ANNEE_MAX
    if (
      anneeDemandee !== null &&
      (!Number.isInteger(anneeDemandee) || anneeDemandee < ANNEE_MIN || anneeDemandee > anneeMax)
    ) {
      return NextResponse.json(
        { error: `Année invalide : choisissez une année entre ${ANNEE_MIN} et ${anneeMax}.`, champ: "year" },
        { status: 400 }
      )
    }

    // Même règle que la création (`planCalendrierEntretien`) : plancher
    // « aujourd'hui » sur l'année courante (défaut), aucune opération avant la
    // plantation, pas de récolte sur un arbre non productif ; une autre année
    // demandée via body.year reste générée en entier (rattrapage historique).
    // QA Hélène 2026-05-15, bug #10 : la variété cale la date de récolte.
    const { annee: year, operations } = planCalendrierEntretien(
      profile,
      arbre,
      session!.user.id,
      { annee: anneeDemandee },
    )

    // Supprimer les anciennes opérations auto-générées pour cette année, et,
    // toutes années confondues, celles qui précèdent la plantation : une date
    // de plantation corrigée après coup (le PUT de l'arbre ne touche pas au
    // calendrier) laissait dans « À faire » des gestes antérieurs à la mise en
    // terre (revue du 2026-10-25).
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)
    const plantation = jourDePlantation(arbre.datePlantation)

    const restantes = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:calendrier:${session!.user.id}:${arbreId}`}))`
      await tx.$queryRaw`SELECT id FROM operations_arbres WHERE arbre_id = ${arbreId} AND user_id = ${session!.user.id} AND notes = 'auto:calendrier' FOR UPDATE`
      const soldes = await tx.operationArbre.findMany({ where: { arbreId, userId: session!.user.id, notes: 'auto:calendrier',
        OR: [{ fait: true }, { abandonneeLe: { not: null } }] },
        select: { type: true, description: true, date: true, fenetreDebut: true, dateLimite: true, datePrevue: true, saisonRecommandee: true } })
      const dejaSoldes = new Set<(typeof operations)[number]>()
      for (const solde of soldes) {
        const prevue = solde.datePrevue ?? solde.date
        const libelle = solde.description?.split(' — ')[0].trim()
        const identifies = !solde.fenetreDebut && libelle ? operations.filter(op =>
          op.type === solde.type && op.description.split(' — ')[0].trim() === libelle
          && op.datePrevue.getFullYear() === prevue.getFullYear()
        ) : []
        const candidats = operations.filter(op => {
          if (dejaSoldes.has(op)) return false
          if (solde.type !== op.type) return false
          if (solde.fenetreDebut && solde.dateLimite) return solde.fenetreDebut.getTime() === op.fenetreDebut.getTime() && solde.dateLimite.getTime() === op.dateLimite.getTime()
          // L'ancien calendrier n'avait pas de fenêtres : son libellé et
          // l'année du geste conservent l'identité même après un report.
          if (identifies.length) return identifies.includes(op)
          return (!solde.saisonRecommandee || solde.saisonRecommandee === op.saisonRecommandee) && startOfDay(prevue) >= startOfDay(op.fenetreDebut) && startOfDay(prevue) <= startOfDay(op.dateLimite)
        })
        // Une ancienne ligne sans fenêtres solde un seul geste. Le début de
        // fenêtre le plus proche distingue par exemple les deux tailles d'été.
        const candidat = candidats.sort((a, b) => b.fenetreDebut.getTime() - a.fenetreDebut.getTime())[0]
        if (candidat) dejaSoldes.add(candidat)
      }
      const restantes = operations.filter(op => !dejaSoldes.has(op))
      await tx.operationArbre.deleteMany({
        where: {
          arbreId,
          userId: session!.user.id,
          notes: "auto:calendrier",
          // On ne supprime que les opérations non faites : les ops
          // auto-générées déjà réalisées sont de l'historique à préserver.
          fait: false,
          // Une fenêtre soldée explicitement ne doit pas être ressuscitée par une
          // régénération : l'utilisateur a acté qu'il ne la ferait pas cette année.
          abandonneeLe: null,
          OR: [
            { fenetreDebut: { gte: startOfYear, lte: endOfYear } },
            // Une récolte de janvier peut appartenir à l'hiver commencé
            // l'année précédente. Les anciennes lignes sans fenêtre sont
            // remplacées seulement dans les fenêtres de l'année générée.
            ...operations.map(op => ({
              type: op.type, fenetreDebut: null,
              datePrevue: { gte: startOfDay(op.fenetreDebut), lte: endOfDay(op.dateLimite) },
            })),
            ...(plantation ? [{ datePrevue: { lt: plantation } }] : []),
          ],
        },
      })

      if (restantes.length > 0) {
        await tx.operationArbre.createMany({ data: restantes })
      }

      return restantes
    })
    return NextResponse.json({ count: restantes.length, espece: profile.espece, year, operations: restantes })
  } catch (err) {
    console.error("POST /api/arbres/[id]/generer-calendrier error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la génération du calendrier" },
      { status: 500 }
    )
  }
}
