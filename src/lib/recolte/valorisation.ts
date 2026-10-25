/**
 * Valorisation d'un lot de récolte en stock : règle UNIQUE (ticket cmvnvaal2,
 * 2026-10-25, ordre arbitré en revue le même jour), lue par Récoltes > Stock
 * (`GET /api/recoltes`, champ `valorisation`), par Comptabilité > Stocks
 * unifiés (`stocks-unifies.ts`, donc l'outil assistant `get_stocks_valorises`)
 * et, pour le prix PROPOSÉ d'une vente, par le formulaire de vente de Récoltes
 * et la mise en vente en boutique.
 *
 * Avant, chaque écran avait sa formule. Récoltes multipliait la quantité du lot
 * par `Espece.prixKg` ; Stocks unifiés prenait le prix du lot, puis la moyenne
 * simple des ventes récentes de l'espèce TOUTES UNITÉS CONFONDUES, puis
 * `Espece.prixKg`. Pour 21 tiges de dahlia, Récoltes annonçait 630 € (le prix
 * du catalogue, 30 €/kg, lu comme 30 €/tige) et Stocks unifiés 30,87 €
 * (1,47 €/tige), sans qu'aucun écran ne dise d'où venait son chiffre.
 *
 * Règle, dans l'ordre. Chaque prix est un prix PAR UNITÉ DU LOT (kg, tige,
 * pièce, botte), comme `Recolte.prixKg` malgré son nom :
 *   1. `lot` : le prix saisi sur le lot lui-même ;
 *   2. `fiche` : le prix de la fiche d'une espèce PERSONNELLE de l'acteur
 *      (`Espece.userId` = le compte qui consulte), exprimé dans l'unité de
 *      l'espèce (la fiche l'étiquette « Prix de vente (€/<unité>) » depuis le
 *      2026-10-20), retenu seulement si cette unité est celle du lot. Une
 *      espèce PARTAGÉE par un autre compte n'est pas « votre fiche » : son
 *      prix a été saisi par son auteur, elle est traitée comme le catalogue ;
 *   3. `ventes` : le prix de vente moyen de l'espèce DANS LA MÊME UNITÉ sur
 *      les 90 derniers jours, pondéré par les quantités vendues (ce qu'une
 *      vente a réellement rapporté par tige ou par kilo) ;
 *   4. pour un lot EN KILOS d'une espèce qui n'est pas celle de l'acteur
 *      (catalogue, `userId` nul, ou entrée partagée par un autre compte) :
 *      `catalogue` (`Espece.prixKg`, écrit en €/kg par les migrations), puis
 *      `reference` (barème indicatif `prixReferenceKg`, €/kg) ;
 *   5. sinon `aucune` : le lot n'est pas valorisé, jamais un faux chiffre.
 *
 * Le prix au kilo du catalogue n'est JAMAIS appliqué à une autre unité : la
 * migration 20260820180000 a passé les fleurs en tiges sans convertir leur
 * prix (dahlia à 30, migration 20260818140000).
 *
 * Ce module ne dépend pas de Prisma à l'exécution (il est lu par l'écran) :
 * le chargement des ventes reçoit son client en paramètre.
 */

import type { PrismaClient } from '@prisma/client'

import { formatPrixUnitaire } from '@/lib/comptabilite/prix-unitaire'
import { libelleUniteQuantite, UNITES_QUANTITE, uniteQuantiteRecolte, type UniteQuantite } from '@/lib/recolte/projection'
import { prixReferenceKg } from '@/lib/stocks/prix-reference'

/** Fenêtre des ventes qui font le prix de vente moyen. */
export const FENETRE_PRIX_VENTE_JOURS = 90

/** D'où vient le prix retenu. */
export type SourcePrix = 'lot' | 'fiche' | 'ventes' | 'catalogue' | 'reference'
export type SourceValorisation = SourcePrix | 'aucune'

/**
 * Sources admises pour PROPOSER un prix de vente (formulaire de vente de
 * Récoltes, mise en vente en boutique) : jamais `reference`, une estimation
 * n'est pas un prix de vente.
 */
export const SOURCES_PRIX_PROPOSE: readonly SourcePrix[] = ['lot', 'fiche', 'ventes', 'catalogue']

/** La source dite en quelques mots, telle que les écrans l'affichent. */
export const LIBELLES_SOURCE_VALORISATION: Record<SourceValorisation, string> = {
  lot: 'au prix saisi sur le lot',
  fiche: 'au prix de votre fiche espèce',
  ventes: `au prix de vente moyen (${FENETRE_PRIX_VENTE_JOURS} jours)`,
  catalogue: 'au prix du catalogue',
  reference: 'au prix indicatif de référence',
  aucune: 'sans prix',
}

/** La source en un mot, pour une cellule de tableau. */
export const LIBELLES_COURTS_SOURCE_VALORISATION: Record<SourceValorisation, string> = {
  lot: 'prix du lot',
  fiche: 'prix de la fiche',
  ventes: 'vente moyenne',
  catalogue: 'prix du catalogue',
  reference: 'prix indicatif',
  aucune: 'sans prix',
}

export interface PrixDeValorisation {
  /** Prix par unité du lot (€/kg, €/tige…). */
  prixUnitaire: number
  source: SourcePrix
}

/**
 * Valeur d'un lot. `nombreVentes` = ventes de l'espèce dans l'unité du lot sur
 * la fenêtre, quelle que soit la source retenue (0 si aucune).
 */
export type ValorisationLot =
  | { source: SourcePrix; prixUnitaire: number; valeur: number; unite: UniteQuantite; nombreVentes: number }
  | { source: 'aucune'; prixUnitaire: null; valeur: null; unite: UniteQuantite; nombreVentes: number }

/** Une vente de récolte passée, telle que la lit le prix de vente moyen. */
export interface VenteDeRecolte {
  especeId: string
  unite: string | null
  quantite: number
  prixKg: number | null
  prixTotal?: number | null
}

export interface PrixVenteMoyen {
  prix: number
  nombreVentes: number
}

/** Prix de vente moyen par couple (espèce, unité), clé `clePrixVente`. */
export type PrixVentesMoyens = ReadonlyMap<string, PrixVenteMoyen>

/** Unité d'un lot ; null ou inconnue = kg (lignes antérieures au 2026-08-20). */
export function uniteDuLot(unite: string | null | undefined): UniteQuantite {
  return (UNITES_QUANTITE as readonly string[]).includes(unite ?? '') ? (unite as UniteQuantite) : 'kg'
}

export function clePrixVente(especeId: string, unite: UniteQuantite): string {
  return `${especeId}::${unite}`
}

const prixValide = (p: number | null | undefined): p is number =>
  typeof p === 'number' && Number.isFinite(p) && p > 0

/**
 * Prix de vente moyen de chaque espèce dans chaque unité : total vendu divisé
 * par la quantité vendue. Une vente sans prix unitaire mais avec un montant
 * compte pour `prixTotal / quantité`. Des tiges ne font jamais le prix d'un
 * kilo, ni l'inverse.
 */
export function prixVentesMoyens(ventes: readonly VenteDeRecolte[]): PrixVentesMoyens {
  const cumuls = new Map<string, { montant: number; quantite: number; nombre: number }>()
  for (const v of ventes) {
    if (!(Number.isFinite(v.quantite) && v.quantite > 0)) continue
    const montant = prixValide(v.prixKg) ? v.prixKg * v.quantite : prixValide(v.prixTotal) ? v.prixTotal : null
    if (montant === null) continue
    const cle = clePrixVente(v.especeId, uniteDuLot(v.unite))
    const cumul = cumuls.get(cle) ?? { montant: 0, quantite: 0, nombre: 0 }
    cumul.montant += montant
    cumul.quantite += v.quantite
    cumul.nombre += 1
    cumuls.set(cle, cumul)
  }
  const moyennes = new Map<string, PrixVenteMoyen>()
  cumuls.forEach((c, cle) => moyennes.set(cle, { prix: c.montant / c.quantite, nombreVentes: c.nombre }))
  return moyennes
}

/**
 * Charge les ventes de récolte du compte sur la fenêtre et en tire les prix
 * moyens. Une seule requête, partagée par `GET /api/recoltes`,
 * `computeStocksUnifies` et la mise en vente en boutique.
 */
export async function chargerPrixVentesMoyens(
  db: Pick<PrismaClient, 'recolte'>,
  userId: string,
  maintenant: Date = new Date(),
): Promise<PrixVentesMoyens> {
  const debut = new Date(maintenant.getTime() - FENETRE_PRIX_VENTE_JOURS * 24 * 3600 * 1000)
  const ventes = await db.recolte.findMany({
    where: {
      userId,
      statut: 'vendu',
      dateVente: { gte: debut },
      OR: [{ prixKg: { gt: 0 } }, { prixTotal: { gt: 0 } }],
    },
    select: { especeId: true, unite: true, quantite: true, prixKg: true, prixTotal: true },
  })
  return prixVentesMoyens(ventes)
}

/** Ce que la règle lit sur l'espèce du lot. */
export interface EspecePrix {
  /** null = catalogue Gleba ; sinon le compte auteur (l'acteur, ou un autre compte qui la partage). */
  userId: string | null
  /** `Espece.prixKg` : prix de la fiche, sans unité stockée. */
  prixKg: number | null
  /** Unité de rendement de l'espèce, qui donne l'unité de son prix de fiche. */
  uniteRendement: string | null
}

export interface SourcesPrixLot {
  /**
   * Compte qui consulte (session, `userId` du calcul) : seule SA fiche espèce
   * vaut prix de fiche ; l'entrée partagée d'un autre compte suit le catalogue.
   */
  acteurId: string
  especeId: string
  /** Unité du lot (`Recolte.unite`) ; null = kg. */
  unite: string | null
  /** Prix saisi sur le lot (`Recolte.prixKg`), par unité du lot. */
  prixLot?: number | null
  /** Espèce du lot ; absente = ni fiche, ni catalogue, ni barème. */
  espece?: EspecePrix | null
}

/** Le prix par unité du lot selon la règle unique, et sa source ; null = aucune. */
export function prixDeValorisation(
  sources: SourcesPrixLot,
  ventes: PrixVentesMoyens,
): PrixDeValorisation | null {
  const unite = uniteDuLot(sources.unite)
  if (prixValide(sources.prixLot)) return { prixUnitaire: sources.prixLot, source: 'lot' }
  const espece = sources.espece ?? null
  const ficheDeLActeur = espece !== null && espece.userId !== null && espece.userId === sources.acteurId
  if (
    espece !== null &&
    ficheDeLActeur &&
    prixValide(espece.prixKg) &&
    uniteQuantiteRecolte(espece.uniteRendement) === unite
  ) {
    return { prixUnitaire: espece.prixKg, source: 'fiche' }
  }
  const moyen = ventes.get(clePrixVente(sources.especeId, unite))
  if (moyen && prixValide(moyen.prix)) return { prixUnitaire: moyen.prix, source: 'ventes' }
  // Catalogue et barème : des kilos d'une espèce qui n'est pas celle de
  // l'acteur (catalogue ou entrée partagée par un autre compte), rien d'autre.
  if (unite !== 'kg' || espece === null || ficheDeLActeur) return null
  if (prixValide(espece.prixKg)) return { prixUnitaire: espece.prixKg, source: 'catalogue' }
  const reference = prixReferenceKg(sources.especeId)
  if (prixValide(reference)) return { prixUnitaire: reference, source: 'reference' }
  return null
}

/** Valeur d'un lot en stock, source toujours dite (`aucune` = non valorisé). */
export function valoriserLot(
  lot: SourcesPrixLot & { quantite: number },
  ventes: PrixVentesMoyens,
): ValorisationLot {
  const unite = uniteDuLot(lot.unite)
  const nombreVentes = ventes.get(clePrixVente(lot.especeId, unite))?.nombreVentes ?? 0
  const prix = prixDeValorisation(lot, ventes)
  if (!prix) return { source: 'aucune', prixUnitaire: null, valeur: null, unite, nombreVentes }
  return {
    source: prix.source,
    prixUnitaire: prix.prixUnitaire,
    valeur: Math.round(lot.quantite * prix.prixUnitaire * 100) / 100,
    unite,
    nombreVentes,
  }
}

/**
 * Prix à PROPOSER pour vendre le lot (arrondi au centime, à corriger par
 * l'utilisateur), ou null : seules les sources de `SOURCES_PRIX_PROPOSE`.
 */
export function prixProposeDeVente(
  valorisation: { source: SourceValorisation; prixUnitaire: number | null } | null | undefined,
): number | null {
  if (!valorisation || valorisation.prixUnitaire === null) return null
  if (!(SOURCES_PRIX_PROPOSE as readonly string[]).includes(valorisation.source)) return null
  return Math.round(valorisation.prixUnitaire * 100) / 100
}

const nbVentes = (n: number) => `${n} vente${n > 1 ? 's' : ''}`

/** « vente moyenne, 2 ventes » : la source en un mot, avec le nombre de ventes qui font la moyenne. */
export function libelleCourtValorisation(v: Pick<ValorisationLot, 'source' | 'nombreVentes'>): string {
  const court = LIBELLES_COURTS_SOURCE_VALORISATION[v.source]
  return v.source === 'ventes' ? `${court}, ${nbVentes(v.nombreVentes)}` : court
}

/** « au prix de vente moyen (90 jours, 2 ventes), 1,20 € par tige ». */
export function libelleValorisationLot(v: ValorisationLot): string {
  if (v.source === 'aucune') return `sans prix de vente en ${libelleUniteQuantite(v.unite, 2)}`
  const libelle = v.source === 'ventes'
    ? `au prix de vente moyen (${FENETRE_PRIX_VENTE_JOURS} jours, ${nbVentes(v.nombreVentes)})`
    : LIBELLES_SOURCE_VALORISATION[v.source]
  return `${libelle}, ${formatPrixUnitaire(v.prixUnitaire)} € par ${libelleUniteQuantite(v.unite, 1)}`
}

/**
 * La méthode d'un ensemble de lots, en une phrase : une seule source, ou
 * celles qui se mêlent, et le nombre de lots restés sans prix (comptés à 0).
 * Le nombre de ventes n'est dit que s'il est le même pour tous (une seule
 * espèce). null quand il n'y a aucun lot.
 */
export function libelleMethodesValorisation(
  valorisations: readonly Pick<ValorisationLot, 'source' | 'nombreVentes'>[],
): string | null {
  if (valorisations.length === 0) return null
  const parties: string[] = []
  const sources = Array.from(new Set(valorisations.map((v) => v.source).filter((s) => s !== 'aucune')))
  for (const source of sources) {
    if (source === 'ventes') {
      const nombres = new Set(valorisations.filter((v) => v.source === 'ventes').map((v) => v.nombreVentes))
      parties.push(
        nombres.size === 1
          ? `au prix de vente moyen (${FENETRE_PRIX_VENTE_JOURS} jours, ${nbVentes([...nombres][0])})`
          : LIBELLES_SOURCE_VALORISATION.ventes,
      )
    } else {
      parties.push(LIBELLES_SOURCE_VALORISATION[source])
    }
  }
  const sansPrix = valorisations.filter((v) => v.source === 'aucune').length
  if (sansPrix > 0) parties.push(`${sansPrix} lot${sansPrix > 1 ? 's' : ''} sans prix`)
  return parties.join(' ; ')
}
