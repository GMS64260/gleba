/**
 * Tâches du verger sur une période — source unique de vérité de l'écran
 * Verger (dashboard) et de GET /api/arbres/taches.
 *
 * Extrait de la route (lot assistant 2026-08-11) pour être partagé avec
 * l'outil assistant `get_taches_verger`. Rappels d'invariants :
 * - une fenêtre saisonnière refermée n'est PAS un retard (cf.
 *   src/lib/operation-arbre-statut.ts) : le retard n'existe que si la
 *   fenêtre est encore ouverte (dateLimite null ou >= début de période) ;
 * - une opération abandonnée est masquée, jamais requalifiée en retard.
 */

import prisma from '@/lib/prisma'

export type TachesVerger = Awaited<ReturnType<typeof getTachesVerger>>

export async function getTachesVerger(
  userId: string,
  { start, end }: { start: Date; end: Date },
) {
  // Opérations planifiées dans la période
  const operations = await prisma.operationArbre.findMany({
    where: {
      userId,
      datePrevue: { gte: start, lte: end },
    },
    include: {
      arbre: {
        select: { id: true, nom: true, type: true, espece: true, couleur: true },
      },
    },
    orderBy: { datePrevue: "asc" },
  })

  // Opérations réellement en attente avant la période : fenêtre saisonnière
  // encore ouverte, ou échéance ferme dépassée. Une fenêtre refermée n'est pas
  // du retard, c'est un rendez-vous manqué pour la saison (cf.
  // `src/lib/operation-arbre-statut.ts`).
  const operationsRetard = await prisma.operationArbre.findMany({
    where: {
      userId,
      fait: false,
      abandonneeLe: null,
      datePrevue: { lt: start },
      OR: [{ dateLimite: null }, { dateLimite: { gte: start } }],
    },
    include: {
      arbre: {
        select: { id: true, nom: true, type: true, espece: true },
      },
    },
    orderBy: { datePrevue: "asc" },
    take: 10,
  })

  // Observations santé non résolues (gravité >= moyenne)
  const alertesSante = await prisma.observationSante.findMany({
    where: {
      userId,
      resolu: false,
      gravite: { in: ["moyenne", "grave", "critique"] },
    },
    include: {
      arbre: {
        select: { id: true, nom: true, type: true },
      },
    },
    orderBy: { date: "desc" },
    take: 10,
  })

  // Stats de la période
  const tailles = operations.filter((o) => o.type === "taille")
  const traitements = operations.filter((o) => o.type === "traitement")
  const greffes = operations.filter((o) => o.type === "greffe")
  const fertilisations = operations.filter((o) => o.type === "fertilisation")

  return {
    operations: operations.map((o) => ({
      id: o.id,
      type: o.type,
      arbreId: o.arbreId,
      arbreNom: o.arbre.nom,
      arbreType: o.arbre.type,
      arbreCouleur: o.arbre.couleur,
      datePrevue: o.datePrevue,
      fait: o.fait,
      description: o.description,
      cout: o.cout,
    })),
    operationsRetard: operationsRetard.map((o) => ({
      id: o.id,
      type: o.type,
      arbreId: o.arbreId,
      arbreNom: o.arbre.nom,
      datePrevue: o.datePrevue,
      description: o.description,
    })),
    alertesSante: alertesSante.map((o) => ({
      id: o.id,
      arbreId: o.arbreId,
      arbreNom: o.arbre.nom,
      type: o.type,
      diagnostic: o.diagnostic,
      gravite: o.gravite,
      date: o.date,
    })),
    stats: {
      taillesPrevues: tailles.length,
      taillesFaites: tailles.filter((t) => t.fait).length,
      traitementsPrevus: traitements.length,
      traitementsFaits: traitements.filter((t) => t.fait).length,
      greffesPrevues: greffes.length,
      greffesFaites: greffes.filter((g) => g.fait).length,
      fertilisationsPrevues: fertilisations.length,
      fertilisationsFaites: fertilisations.filter((f) => f.fait).length,
      operationsRetard: operationsRetard.length,
      alertesSante: alertesSante.length,
    },
  }
}
