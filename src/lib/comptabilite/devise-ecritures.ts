import prisma from '@/lib/prisma'
import type { Devise } from '@/lib/territoires'
import { cleMiroirReglement, cleSourceReglement, type IdentiteMiroir } from './cle-reglement'
import { monnaieFacture } from './devise-reglement'
import { monnaieVente, SELECT_CONTEXTE_FISCAL_VENTE } from './devise-vente'

/*
 * Devise figée des écritures qui n'ont pas de colonne de devise (lot
 * devise-totaux-api, tour 2, 16/11/2026).
 *
 * Dépenses : `DepenseManuelle` n'a ni devise ni contexte figé, mais une dépense
 * dont un règlement a été saisi a un `DossierReglement` dont la devise est
 * figée (le journal refuse d'en changer, `reglements.ts`). Cette devise fait
 * foi ; sans dossier, la dépense suit la devise courante de l'exploitation.
 *
 * Ventes d'atelier (élevage, récoltes, fruits, bois) : la facture liée fige
 * la devise ; sinon le contexte figé de leur miroir comptable ; sinon la
 * devise courante.
 *
 * Frontière public/privé : module PUBLIC ; `cle-reglement.ts` existe dans le
 * dépôt public avec les mêmes exports (clés identiques pour les dépenses).
 */

/** Champs de `DepenseManuelle` qui composent la clé de son dossier de règlement. */
export const SELECT_IDENTITE_DEPENSE = { id: true, auto: true, sourceType: true, sourceId: true, sourceRef: true } as const

/** Clé du dossier de règlement d'une ligne de `DepenseManuelle`. */
export const cleDossierDepense = (d: IdentiteMiroir) => cleMiroirReglement('depense', d)

/** Clé du dossier de règlement d'une dépense native (achat, campagne…) par le `sourceType` de son miroir. */
export const cleDossierDepenseSource = (sourceType: string, id: number) => cleSourceReglement('depense', sourceType, id)

/** Une devise de dossier hors EUR/XPF est inconnue (`null`), jamais la devise courante. */
export function deviseDossier(devise: string): Devise | null {
  return devise === 'EUR' || devise === 'XPF' ? devise : null
}

/**
 * Devises figées par les dossiers de règlement, par clé. Une clé absente de la
 * carte n'a pas de dossier : la devise courante s'applique (`monnaieParCle`).
 * Lecture scopée par `userId` (cible et dossier).
 */
export async function chargerDevisesDossiers(userId: string, cles: readonly string[]): Promise<Map<string, Devise | null>> {
  const uniques = [...new Set(cles)]
  const resultat = new Map<string, Devise | null>()
  if (!uniques.length) return resultat
  const cibles = await prisma.cibleReglement.findMany({
    where: { userId, cle: { in: uniques }, dossier: { userId } },
    select: { cle: true, dossier: { select: { devise: true } } },
  })
  for (const c of cibles) resultat.set(c.cle, deviseDossier(c.dossier.devise))
  return resultat
}

/** Devise d'une écriture : celle de son dossier s'il existe, sinon la devise courante. */
export function monnaieParCle(cle: string, figees: ReadonlyMap<string, Devise | null>, deviseCourante: Devise | null): Devise | null {
  return figees.has(cle) ? figees.get(cle)! : deviseCourante
}

/** Devise de chaque `DepenseManuelle` (par id), même règle sur toutes les surfaces. */
export async function chargerMonnaiesDepenses(
  userId: string,
  depenses: readonly IdentiteMiroir[],
  deviseCourante: Devise | null,
): Promise<Map<number, Devise | null>> {
  const figees = await chargerDevisesDossiers(userId, depenses.map(cleDossierDepense))
  return new Map(depenses.map((d) => [d.id, monnaieParCle(cleDossierDepense(d), figees, deviseCourante)]))
}

/**
 * Devises figées des dépenses par id, SANS repli : seules les dépenses qui ont
 * un dossier de règlement figurent dans la carte (projection `monnaie` de GET
 * dépenses : champ absent sans devise figée).
 */
export async function chargerDevisesFigeesDepenses(userId: string, depenses: readonly IdentiteMiroir[]): Promise<Map<number, Devise | null>> {
  const figees = await chargerDevisesDossiers(userId, depenses.map(cleDossierDepense))
  const resultat = new Map<number, Devise | null>()
  for (const d of depenses) {
    const cle = cleDossierDepense(d)
    if (figees.has(cle)) resultat.set(d.id, figees.get(cle)!)
  }
  return resultat
}

/** Une vente d'une table métier : son id, sa facture éventuelle et le `sourceType` de son miroir. */
export interface VenteBrute {
  sourceType: 'vente_produit' | 'recolte' | 'recolte_arbre' | 'production_bois'
  id: number
  factureId: number | null
}

const cleVenteBrute = (v: Pick<VenteBrute, 'sourceType' | 'id'>) => `${v.sourceType}:${v.id}`

/**
 * Devise de ventes d'atelier : facture liée (devise figée de son instantané ;
 * un brouillon n'a rien figé, il suit la devise courante ; une facture
 * introuvable pour cette exploitation est inconnue), sinon contexte figé du
 * miroir comptable, sinon devise courante. Deux lectures, scopées par `userId`.
 * Résultat indexé par `monnaieVenteBrute`.
 */
export async function chargerMonnaiesVentesBrutes(
  userId: string,
  ventes: readonly VenteBrute[],
  deviseCourante: Devise | null,
): Promise<Map<string, Devise | null>> {
  const resultat = new Map<string, Devise | null>()
  if (!ventes.length) return resultat
  const factureIds = [...new Set(ventes.map((v) => v.factureId).filter((id): id is number => id != null))]
  const sansFacture = ventes.filter((v) => v.factureId == null)
  const [factures, miroirs] = await Promise.all([
    factureIds.length
      ? prisma.facture.findMany({ where: { userId, id: { in: factureIds } }, select: { id: true, statut: true, date: true, emetteurSnapshot: true } })
      : Promise.resolve([]),
    sansFacture.length
      ? prisma.venteManuelle.findMany({
          where: { userId, auto: true, OR: sansFacture.map((v) => ({ sourceType: v.sourceType, sourceId: v.id })) },
          select: { sourceType: true, sourceId: true, ...SELECT_CONTEXTE_FISCAL_VENTE },
        })
      : Promise.resolve([]),
  ])
  const facturesParId = new Map(factures.map((f) => [f.id, f]))
  const miroirsParCle = new Map(
    (miroirs as Array<{ sourceType: string | null; sourceId: number | null }>).map((m) => [`${m.sourceType}:${m.sourceId}`, m]),
  )
  for (const v of ventes) {
    let monnaie: Devise | null
    if (v.factureId != null) {
      const f = facturesParId.get(v.factureId)
      monnaie = !f ? null : f.statut === 'brouillon' ? deviseCourante : monnaieFacture(f.emetteurSnapshot, f.date)
    } else {
      const m = miroirsParCle.get(cleVenteBrute(v))
      monnaie = m ? monnaieVente(m, deviseCourante) : deviseCourante
    }
    resultat.set(cleVenteBrute(v), monnaie)
  }
  return resultat
}

/** Lecture de la carte de `chargerMonnaiesVentesBrutes` (devise courante si absente). */
export function monnaieVenteBrute(
  monnaies: ReadonlyMap<string, Devise | null>,
  v: Pick<VenteBrute, 'sourceType' | 'id'>,
  deviseCourante: Devise | null,
): Devise | null {
  const cle = cleVenteBrute(v)
  return monnaies.has(cle) ? monnaies.get(cle)! : deviseCourante
}
