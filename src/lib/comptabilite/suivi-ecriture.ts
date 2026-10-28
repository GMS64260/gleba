/**
 * Suivi comptable (règlement, pièce, notes) des ventes dérivées : source unique
 * pour Comptabilité > Transactions > Revenus et pour l'export FEC (ticket
 * cmvgdzsf7, 2026-10-20).
 *
 * Règle : le suivi d'une ligne générée vit sur son MIROIR `VenteManuelle`
 * (`auto: true`, même `sourceType`/`sourceId` que ceux d'`auto-compta.ts`).
 * Or la liste Transactions et le FEC réinjectent les SOURCES brutes (vente
 * d'élevage, récolte, vente de bois…), pas leurs miroirs : sans relecture du
 * miroir, la liste n'offrait rien sur une ligne dérivée et le FEC sortait
 * `ELEV-<id>` sans mode de règlement, quelle que soit la pièce saisie.
 * - `chargerSuiviDesSources` relit les miroirs désignés par leur source ou
 *   par leur id, dans le compte ;
 * - `chargerSuiviDesLignes` (liste Transactions) y ajoute la facture qui porte
 *   une vente facturée (une vente facturée n'a pas de miroir).
 */

import prisma from '@/lib/prisma'
import { CHAMPS_DE_SUIVI_SAISIS_VENTE, type ChampSuiviSaisiVente } from './ecriture-derivee'

/** Source affichée → `sourceType` de son miroir de vente (`auto-compta.ts`). */
export const MIROIR_VENTE_PAR_SOURCE: Record<string, string> = {
  VenteProduit: 'vente_produit',
  Recolte: 'recolte',
  RecolteArbre: 'recolte_arbre',
  ProductionBois: 'production_bois',
  Abattage: 'abattage',
  // sourceId synthétique annee*100+mois, scopé par userId.
  PaieLait: 'paie_lait',
}

export interface EcritureDeLigne {
  id: number
  /** Pointage des ventes dont le suivi vit sur le miroir comptable. */
  paye?: boolean
  suivi: Record<ChampSuiviSaisiVente, string | null>
}

/** Clé d'une source dans `SuiviDesSources.parSource`. */
export function cleSource(sourceType: string, sourceId: number): string {
  return `${sourceType}:${sourceId}`
}

export interface SuiviDesSources {
  parSource: Map<string, EcritureDeLigne>
  parId: Map<number, EcritureDeLigne>
}

const SELECT_SUIVI = Object.fromEntries(CHAMPS_DE_SUIVI_SAISIS_VENTE.map((c) => [c, true])) as Record<
  ChampSuiviSaisiVente,
  true
>

function suiviDe(ecriture: Record<string, unknown>): EcritureDeLigne['suivi'] {
  return Object.fromEntries(
    CHAMPS_DE_SUIVI_SAISIS_VENTE.map((c) => [c, (ecriture[c] as string | null | undefined) ?? null]),
  ) as EcritureDeLigne['suivi']
}

/**
 * Miroirs de vente (`auto: true`) du compte, désignés par leur source
 * (`sourceType` + `sourceId`) ou par leur id, avec les champs de suivi saisis.
 */
export async function chargerSuiviDesSources(
  userId: string,
  cibles: { sources?: Array<{ sourceType: string; sourceId: number }>; ids?: number[] },
): Promise<SuiviDesSources> {
  const ids = [...new Set(cibles.ids ?? [])]
  const idsParType = new Map<string, number[]>()
  for (const { sourceType, sourceId } of cibles.sources ?? []) {
    const deja = idsParType.get(sourceType) ?? []
    if (!deja.includes(sourceId)) idsParType.set(sourceType, [...deja, sourceId])
  }
  const cles = [
    ...(ids.length ? [{ id: { in: ids } }] : []),
    ...[...idsParType].map(([sourceType, sourceIds]) => ({ sourceType, sourceId: { in: sourceIds } })),
  ]

  const resultat: SuiviDesSources = { parSource: new Map(), parId: new Map() }
  if (cles.length === 0) return resultat

  const miroirs = await prisma.venteManuelle.findMany({
    where: { userId, auto: true, OR: cles },
    select: { id: true, sourceType: true, sourceId: true, paye: true, ...SELECT_SUIVI },
  })
  for (const m of miroirs) {
    const ecriture = { id: m.id, paye: m.paye, suivi: suiviDe(m) }
    resultat.parId.set(m.id, ecriture)
    if (m.sourceType && m.sourceId != null) resultat.parSource.set(cleSource(m.sourceType, m.sourceId), ecriture)
  }
  return resultat
}

export interface LigneRevenuDerivable {
  id: string
  source: string
  sourceId: number
  /** Ligne saisie à la main : corrigée par le formulaire complet, pas ici. */
  corrigeable?: boolean
  /** Facture qui porte la vente source, s'il y en a une. */
  factureId?: number | null
}

export interface SuiviDeLigne {
  ecriture: EcritureDeLigne | null
  facture: { id: number; numero: string } | null
}

export const MIROIR_DEPENSE_PAR_SOURCE: Record<string, string> = { LotAnimaux: 'achat_animal', Animal: 'achat_animal_individuel', OperationArbre: 'operation_arbre', Intervention: 'intervention' }

/** Les dépenses générées gardent leur suivi sur DepenseManuelle. */
export async function chargerSuiviDesDepenses(userId: string, lignes: Array<LigneRevenuDerivable & { comptable: boolean }>) {
  const types = MIROIR_DEPENSE_PAR_SOURCE
  const cibles = lignes.filter((l) => l.comptable && !l.corrigeable && types[l.source])
  const where = cibles.map((l) => ({ sourceType: types[l.source], sourceId: l.sourceId }))
  const resultat = new Map<string, { ecriture: EcritureDeLigne; paye: boolean; modeReglement: string | null }>()
  if (!where.length) return resultat
  const miroirs = await prisma.depenseManuelle.findMany({
    where: { userId, auto: true, OR: where },
    select: { id: true, sourceType: true, sourceId: true, paye: true, ...SELECT_SUIVI },
  })
  const parSource = new Map(miroirs.map((m) => [cleSource(m.sourceType!, m.sourceId!), m]))
  for (const l of cibles) {
    const m = parSource.get(cleSource(types[l.source], l.sourceId))
    if (m) resultat.set(l.id, { ecriture: { id: m.id, suivi: suiviDe(m) }, paye: m.paye, modeReglement: m.modeReglement ?? null })
  }
  return resultat
}

/**
 * Écriture et facture de chaque ligne dérivée de la liste Transactions (clé :
 * `ligne.id`). Une ligne manuelle (`corrigeable`) ou une ligne sans miroir ni
 * facture n'y figure pas. Lectures scopées au compte.
 */
export async function chargerSuiviDesLignes(
  userId: string,
  lignes: LigneRevenuDerivable[],
): Promise<Map<string, SuiviDeLigne>> {
  const derivees = lignes.filter((l) => !l.corrigeable)
  const resultat = new Map<string, SuiviDeLigne>()
  if (derivees.length === 0) return resultat

  // Miroir affiché tel quel (commande boutique, réservation) : relu par son id.
  const suivi = await chargerSuiviDesSources(userId, {
    ids: derivees.filter((l) => l.source === 'VenteManuelle').map((l) => l.sourceId),
    sources: derivees
      .filter((l) => MIROIR_VENTE_PAR_SOURCE[l.source])
      .map((l) => ({ sourceType: MIROIR_VENTE_PAR_SOURCE[l.source], sourceId: l.sourceId })),
  })

  const idsFactures = [...new Set(derivees.map((l) => l.factureId).filter((id): id is number => id != null))]
  const factures = idsFactures.length
    ? await prisma.facture.findMany({ where: { userId, id: { in: idsFactures } }, select: { id: true, numero: true } })
    : []
  const factureParId = new Map(factures.map((f) => [f.id, f]))

  for (const l of derivees) {
    const ecriture =
      l.source === 'VenteManuelle'
        ? suivi.parId.get(l.sourceId)
        : MIROIR_VENTE_PAR_SOURCE[l.source]
          ? suivi.parSource.get(cleSource(MIROIR_VENTE_PAR_SOURCE[l.source], l.sourceId))
          : undefined
    const facture = l.factureId != null ? factureParId.get(l.factureId) : undefined
    if (!ecriture && !facture) continue
    resultat.set(l.id, {
      ecriture: ecriture ?? null,
      facture: facture ? { id: facture.id, numero: facture.numero } : null,
    })
  }
  return resultat
}
