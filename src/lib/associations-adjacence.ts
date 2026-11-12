/**
 * PROMPT DEV 2 Bug #10 — Détection des associations sur planches adjacentes.
 *
 * Le helper [[associations-alertes]] détecte les paires favorable/défavorable
 * pour les cultures cohabitant sur UNE MÊME planche. Ce module étend la
 * détection aux planches voisines : même îlot par défaut (notion d'adjacence
 * minimale, simple et explicable au maraîcher).
 *
 * Audit Marc 2026-05-14 : "Pas d'alerte quand on plante haricot à côté d'une
 * planche d'ail" — sans cette check, le module Associations était isolé.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import prisma from "@/lib/prisma"
import {
  aliasMinuscules,
  chargerContexteEspeces,
  classeAssociation,
  evaluerAssociations,
  INCLUDE_DETAILS_EVALUATION,
  partenairesSelonPivot,
  whereAssociationsConcernant,
  type AlerteAssociation,
} from "@/lib/associations-alertes"
import { fenetreRecolteOuverte } from "@/lib/cultures/en-place"
import { chevauchePeriode, estVivaceEnPlace } from "@/lib/cultures/fenetre-recolte"

type Tx = Prisma.TransactionClient | PrismaClient

export type AlerteAdjacence = AlerteAssociation & {
  plancheNom: string
  /** L'autre culture est sur la planche cible elle-même, pas sur une voisine. */
  memePlanche?: boolean
}

/** Période d'occupation prévue de la culture candidate. */
export type PeriodeCandidate = { debut: Date; fin: Date }

export type SuggestionCompagnon = {
  especeId: string
  /** Nom affiché : l'identifiant d'une espèce personnelle est technique. */
  especeNom: string
  associationId: string
  message: string
}

export type AdjacenceResult = {
  alertes: AlerteAdjacence[]
  suggestions: SuggestionCompagnon[]
  /** Îlot de la planche cible, null si aucun n'est renseigné. */
  ilot: string | null
  /** Planches considérées adjacentes (même îlot). */
  planchesVoisines: { id: string; nom: string }[]
}

/**
 * Pour une espèce candidate sur une planche donnée, retourne les alertes
 * d'incompatibilité ET les suggestions de compagnons positifs sur les
 * planches du même îlot (cultures encore sur leur planche, ou à venir).
 *
 * Avec `periode` (dates prévues de la candidate) :
 *  - les cultures de la planche CIBLE sont évaluées aussi (sans dates, on ne
 *    peut pas distinguer une cohabitation d'une succession : ail récolté puis
 *    haricot, et l'alerte serait fausse) ;
 *  - une culture dont l'occupation ne chevauche pas la période est écartée ;
 *    quand ses dates ne permettent pas de trancher, la règle de présence
 *    ci-dessous s'applique.
 *
 * Sans période, retourne un résultat vide si la planche n'a pas d'îlot.
 */
export async function checkAdjacence(
  especeId: string,
  plancheId: string,
  userId: string,
  tx: Tx = prisma,
  maintenant: Date = new Date(),
  periode: PeriodeCandidate | null = null
): Promise<AdjacenceResult> {
  const planche = await tx.planche.findFirst({
    where: { id: plancheId, userId },
    select: { id: true, nom: true, ilot: true },
  })
  if (!planche || (!planche.ilot && !periode)) {
    return { alertes: [], suggestions: [], ilot: null, planchesVoisines: [] }
  }

  // Planches du même îlot (hors planche cible).
  const voisines = planche.ilot
    ? await tx.planche.findMany({
        where: { userId, ilot: planche.ilot, id: { not: planche.id } },
        select: { id: true, nom: true },
      })
    : []
  if (voisines.length === 0 && !periode) {
    return { alertes: [], suggestions: [], ilot: planche.ilot, planchesVoisines: [] }
  }
  // La planche cible n'est examinée que si la période de la candidate est connue.
  const examinees = periode ? [{ id: planche.id, nom: planche.nom }, ...voisines] : voisines

  // Cultures non closes des planches voisines.
  const culturesNonCloses = await tx.culture.findMany({
    where: {
      userId,
      plancheId: { in: examinees.map((v) => v.id) },
      terminee: null,
    },
    select: {
      especeId: true,
      plancheId: true,
      annee: true,
      terminee: true,
      dateSemis: true,
      datePlantation: true,
      dateRecolte: true,
      finRecolte: true,
      espece: { select: { vivace: true } },
    },
  })

  // « Non close » ne suffit pas : une laitue de 2024 récoltée mais jamais
  // close déclenchait encore une alerte deux ans plus tard. Même règle que
  // l'irrigation et `presenceSurPlanche` : une vivace non close reste ; une
  // annuelle compte si sa campagne est celle de l'an dernier ou plus récente
  // et que sa fenêtre de récolte n'est pas refermée. Les cultures à venir
  // restent : on prépare ici un voisinage, pas un constat du jour.
  const anneeMin = maintenant.getFullYear() - 1
  const culturesVoisines = culturesNonCloses.filter((c) => {
    const chevauche = periode ? chevauchePeriode(c, periode.debut, periode.fin) : null
    if (chevauche !== null) return chevauche
    return (
      estVivaceEnPlace(c) ||
      ((c.annee == null || c.annee >= anneeMin) && fenetreRecolteOuverte(c, maintenant))
    )
  })

  const especesParPlanche = new Map<string, string[]>()
  for (const c of culturesVoisines) {
    if (!c.especeId || !c.plancheId) continue
    const arr = especesParPlanche.get(c.plancheId) ?? []
    arr.push(c.especeId)
    especesParPlanche.set(c.plancheId, arr)
  }

  // Toute paire utile contient l'espèce candidate : ses associations sont
  // chargées UNE fois, puis évaluées en mémoire pour chaque planche (avant :
  // une requête par planche occupée, à chaque changement du formulaire).
  // Les règles de la candidate comprennent celles de ses alias (« Haricot
  // vert » suit « Haricot »), de son groupe et de sa famille.
  const candidate = especeId.toLowerCase()
  const aliasCandidate = aliasMinuscules(especeId)
  const contexte = await chargerContexteEspeces(tx, [
    ...new Set([candidate, ...[...especesParPlanche.values()].flat().map((e) => e.toLowerCase())]),
  ])
  const associations = await tx.association.findMany({
    where: whereAssociationsConcernant([especeId], contexte),
    include: INCLUDE_DETAILS_EVALUATION,
    orderBy: { id: "asc" },
  })

  const alertes: AlerteAdjacence[] = []
  for (const v of examinees) {
    const especesAdj = especesParPlanche.get(v.id) ?? []
    if (especesAdj.length === 0) continue
    for (const a of evaluerAssociations(associations, [especeId, ...especesAdj], contexte)) {
      if (!a.especes.includes(candidate)) continue
      alertes.push({ ...a, plancheNom: v.nom, ...(v.id === planche.id ? { memePlanche: true } : {}) })
    }
  }

  // Suggestions positives : les partenaires favorables de la candidate qui
  // ne sont pas encore présents sur l'îlot.
  const especesIlot = new Set(
    [...especesParPlanche.values()].flat().map((e) => e.toLowerCase())
  )
  const suggestions: SuggestionCompagnon[] = []
  const dejaSuggere = new Set<string>()
  for (const a of associations) {
    // Le champ `type` fait foi, pas le nom : une association incompatible
    // nommée sans « incompat » était suggérée comme compagnon bénéfique
    // (audit 2026-07, #37).
    if (classeAssociation(a.type, a.nom) !== "favorable") continue
    // Règle du pivot : « Poireau + » (compagnes artichaut, asperge, tomate) ne
    // recommande à la tomate que le poireau, pas l'artichaut.
    for (const d of partenairesSelonPivot(a.details, (id) => aliasCandidate.includes(id.toLowerCase()))) {
      const partenaire = (d.especeId as string).toLowerCase()
      if (especesIlot.has(partenaire) || dejaSuggere.has(partenaire)) continue
      dejaSuggere.add(partenaire)
      const nom = d.espece?.nom?.trim() || (d.especeId as string)
      suggestions.push({
        especeId: d.especeId as string,
        especeNom: nom,
        associationId: a.id,
        message: `${nom} sur une planche adjacente serait bénéfique (${a.nom})`,
      })
    }
  }

  return {
    alertes,
    suggestions: suggestions.slice(0, 5),
    ilot: planche.ilot,
    planchesVoisines: voisines,
  }
}
