/**
 * DEV3 audit Marc 2026-05-14 - Majeur #7.
 *
 * Compteur de cuivre métal pour producteurs Bio.
 *
 * Plafond réglementaire (Règl. UE 2018/1981 modifiant 2018/1584,
 * confirmé Règl. 2023/2660) :
 *   - 4 kg de cuivre métal / ha / an (par parcelle)
 *   - 28 kg de cuivre métal / ha / sur 7 années glissantes
 *
 * On considère un traitement comme "cuivre" si :
 *   - le produit phyto a `contientCuivre = true` (flag manuel) OU
 *   - sa classification = "Chimique cuivré" OU
 *   - le nom ou la substance active contient "cuivre" / "bouillie bordelaise"
 *
 * La dose en cuivre métal est dérivée :
 *   - si `cuivreMetalGParUnite` est renseigné : dose × cuivreMetalGParUnite / 1000 = kg Cu
 *   - sinon si `cuivreMetalPct` : dose × (cuivreMetalPct/100) = kg Cu
 *   - sinon : 20% par défaut (taux moyen Bouillie bordelaise)
 */

export const PLAFOND_CU_KG_HA_AN = 4
export const PLAFOND_CU_KG_HA_7ANS = 28
export const DEFAULT_CUIVRE_METAL_PCT = 20 // Bouillie bordelaise 20% Cu

export type ProduitCuivre = {
  contientCuivre?: boolean | null
  classification?: string | null
  nomCommercial?: string | null
  substanceActive?: string | null
  cuivreMetalPct?: number | null
  cuivreMetalGParUnite?: number | null
}

/** Détecte si un produit est cuivré (heuristique large + flag explicite). */
export function isProduitCuivre(p: ProduitCuivre | null | undefined): boolean {
  if (!p) return false
  if (p.contientCuivre === true) return true
  if (p.classification === 'Chimique cuivré') return true
  const txt = `${p.nomCommercial ?? ''} ${p.substanceActive ?? ''}`.toLowerCase()
  return /cuivre|bouillie bordelaise|hydroxyde de cu|oxychlorure|sulfate de cu/.test(txt)
}

export interface TraitementCuivreInput {
  date: Date
  parcelleId: string | null
  surfaceHa: number | null
  doseAppliquee: number | null   // dose par unité (kg/ha, L/ha, etc.)
  uniteDose: string | null
  volumeBouillieLHa: number | null
  produit?: ProduitCuivre | null
}

/**
 * Convertit la dose appliquée en quantité de produit total (kg ou L) selon
 * l'unité de saisie. Permet de gérer "kg/ha", "L/ha" (≈ kg/ha pour bouillies),
 * "g/L" (concentration en bouillie : nécessite volume bouillie L/ha) et "mL/L".
 *
 * Hypothèse : 1 L de bouillie ≈ 1 kg (densité eau ~1, négligeable variation).
 * Pour des produits concentrés > 1.2 kg/L, l'opérateur saisit en kg/ha
 * directement et le calcul reste correct.
 *
 * Retourne le total en kg de PRODUIT (pas Cu) appliqué sur la parcelle entière.
 */
function quantiteProduitTotalKg(t: TraitementCuivreInput): number {
  const dose = t.doseAppliquee ?? 0
  const surfaceHa = t.surfaceHa ?? 0
  if (dose <= 0 || surfaceHa <= 0) return 0

  const unite = (t.uniteDose ?? '').toLowerCase()

  // kg/ha ou L/ha : dose × surface = kg total
  if (unite === '' || unite === 'kg/ha' || unite === 'l/ha') {
    return dose * surfaceHa
  }
  // g/ha → /1000 = kg
  if (unite === 'g/ha') {
    return (dose * surfaceHa) / 1000
  }
  // g/L : concentration dans la bouillie. Nécessite volume_bouillie_l_ha.
  // (dose g/L × volumeBouillieLHa L/ha) / 1000 = kg produit / ha → × surface
  if (unite === 'g/l') {
    const vol = t.volumeBouillieLHa ?? 0
    if (vol <= 0) return 0
    return ((dose * vol) / 1000) * surfaceHa
  }
  // mL/L : ml de produit liquide par L de bouillie. Densité 1 supposée.
  if (unite === 'ml/l') {
    const vol = t.volumeBouillieLHa ?? 0
    if (vol <= 0) return 0
    // dose mL/L × volume L/ha = mL/ha de produit ; ÷1000 → L/ha ≈ kg/ha
    return ((dose * vol) / 1000) * surfaceHa
  }
  // Inconnu : on suppose kg/ha pour ne pas perdre la donnée (sera surcouvert)
  return dose * surfaceHa
}

/**
 * Calcule la dose de cuivre métal appliquée (en kg) sur la parcelle.
 * Retourne 0 si l'input n'est pas un cuivre, ou si la dose/surface manquent.
 *
 * Audit Marc 2026-05-14 — gère désormais toutes les unités courantes
 * (kg/ha, L/ha, g/ha, g/L, mL/L) via `quantiteProduitTotalKg`.
 */
export function doseCuivreMetalKg(t: TraitementCuivreInput): number {
  if (!isProduitCuivre(t.produit)) return 0
  const totalProduitKg = quantiteProduitTotalKg(t)
  if (totalProduitKg <= 0) return 0

  // Conversion en cuivre métal
  if (t.produit?.cuivreMetalGParUnite != null && t.produit.cuivreMetalGParUnite > 0) {
    return Math.round(totalProduitKg * t.produit.cuivreMetalGParUnite) / 1000
  }
  const pct = t.produit?.cuivreMetalPct ?? DEFAULT_CUIVRE_METAL_PCT
  return Math.round(totalProduitKg * pct * 10) / 1000  // *10/1000 = *(pct/100), arrondi 0.001 kg
}

export interface CumulCuivreParcelle {
  parcelleId: string
  surfaceHa: number
  /** Cumul cuivre métal (kg) sur l'année courante. */
  cumulAnnuelKg: number
  /** Cumul cuivre métal (kg) sur les 7 dernières années (glissantes). */
  cumul7ansKg: number
  /** Cumul ramené au kg/ha (annuel) — comparable au plafond 4. */
  cuivreKgParHaAn: number
  /** Cumul ramené au kg/ha (7 ans) — comparable au plafond 28. */
  cuivreKgParHa7ans: number
  /** Statut : 'ok' | 'warn' (>75%) | 'alert' (>100%) sur le plus tendu des deux. */
  statut: 'ok' | 'warn' | 'alert'
  /** Pour debug : nb de traitements pris en compte. */
  nbTraitementsAn: number
  nbTraitements7ans: number
  /** Bug #12 — Traitements cuivrés détectés mais sans dose/surface
   *  (donc cumul calculé = 0). On les signale pour ne plus afficher
   *  "Aucun traitement cuivré" alors qu'une Bouillie bordelaise existe. */
  nbTraitementsCuivreSansDose7ans: number
}

/**
 * Agrège un lot de traitements cuivre par parcelle pour calculer les
 * cumuls et alertes.
 */
export function cumuleParParcelle(
  traitements: TraitementCuivreInput[],
  parcelleSurfaces: Map<string, number>, // surface en ha par parcelleId
  asOf: Date = new Date()
): CumulCuivreParcelle[] {
  const anneeCourante = asOf.getFullYear()
  const dateMin7ans = new Date(asOf)
  dateMin7ans.setFullYear(dateMin7ans.getFullYear() - 7)

  const acc = new Map<string, { an: number; sept: number; nbAn: number; nb7: number; nbSansDose: number }>()
  for (const t of traitements) {
    if (!t.parcelleId) continue
    const cuivreProduit = isProduitCuivre(t.produit)
    const cu = doseCuivreMetalKg(t)
    const inWindow7 = t.date >= dateMin7ans
    const cur = acc.get(t.parcelleId) ?? { an: 0, sept: 0, nbAn: 0, nb7: 0, nbSansDose: 0 }
    if (cu <= 0) {
      // Bug #12 — Traitement cuivre détecté mais dose/surface manquante :
      // on ne peut pas le sommer mais on l'incrémente dans le compteur
      // de saisies incomplètes pour le signaler à l'UI.
      if (cuivreProduit && inWindow7) cur.nbSansDose += 1
      acc.set(t.parcelleId, cur)
      continue
    }
    if (inWindow7) {
      cur.sept += cu
      cur.nb7 += 1
    }
    if (t.date.getFullYear() === anneeCourante) {
      cur.an += cu
      cur.nbAn += 1
    }
    acc.set(t.parcelleId, cur)
  }

  const result: CumulCuivreParcelle[] = []
  for (const [parcelleId, sums] of acc) {
    const surfaceHa = parcelleSurfaces.get(parcelleId) ?? 0
    const cuivreKgParHaAn = surfaceHa > 0 ? sums.an / surfaceHa : 0
    const cuivreKgParHa7ans = surfaceHa > 0 ? sums.sept / surfaceHa : 0
    const ratioAn = cuivreKgParHaAn / PLAFOND_CU_KG_HA_AN
    const ratio7 = cuivreKgParHa7ans / PLAFOND_CU_KG_HA_7ANS
    const ratioMax = Math.max(ratioAn, ratio7)
    const statut: 'ok' | 'warn' | 'alert' =
      ratioMax >= 1 ? 'alert' : ratioMax >= 0.75 ? 'warn' : 'ok'
    result.push({
      parcelleId,
      surfaceHa,
      cumulAnnuelKg: Math.round(sums.an * 1000) / 1000,
      cumul7ansKg: Math.round(sums.sept * 1000) / 1000,
      cuivreKgParHaAn: Math.round(cuivreKgParHaAn * 1000) / 1000,
      cuivreKgParHa7ans: Math.round(cuivreKgParHa7ans * 1000) / 1000,
      statut,
      nbTraitementsAn: sums.nbAn,
      nbTraitements7ans: sums.nb7,
      nbTraitementsCuivreSansDose7ans: sums.nbSansDose,
    })
  }
  return result.sort((a, b) => b.cuivreKgParHaAn - a.cuivreKgParHaAn)
}
