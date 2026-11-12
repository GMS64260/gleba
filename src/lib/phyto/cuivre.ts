/**
 * DEV3 audit Marc 2026-05-14 - Majeur #7.
 *
 * Compteur indicatif de cuivre métal par parcelle. Ce n'est pas une
 * attestation de conformité : la limite qui s'impose est celle de l'AMM de
 * chaque produit (règlement (CE) 1107/2009, art. 55 : un produit s'utilise
 * dans les conditions de son autorisation).
 *
 * Repères réglementaires vérifiés le 2026-11-12 :
 *   - règlement d'exécution (UE) 2018/1981, annexe I, dispositions
 *     spécifiques : « Seules les utilisations entraînant une application
 *     totale maximale de 28 kg de cuivre par hectare sur une période de sept
 *     ans sont autorisées. » Les États membres « peuvent » fixer un taux
 *     annuel ne dépassant pas 4 kg/ha : ce plafond annuel n'est donc pas
 *     universel, il vaut quand l'AMM le fixe. 4 kg/ha/an est la moyenne.
 *     https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32018R1981
 *   - règlement d'exécution (UE) 2025/1489 : approbation des composés de
 *     cuivre prolongée jusqu'au 30 juin 2029, seule la date d'expiration est
 *     modifiée. Les « 7 ans glissants » ci-dessous sont un repère de calcul de
 *     Gleba, pas la période réglementaire de chaque AMM.
 *
 * Revue réglementaire du 2026-11-12 (constat C6) : une composition inconnue
 * valait 20 %, une unité inconnue valait des kg/ha, les litres valaient des
 * kilos, et un apport incalculable (g/L sans volume de bouillie) laissait le
 * statut « OK ». Désormais :
 *   - un apport incalculable (dose, unité, surface ou volume de bouillie
 *     manquant, unité inconnue) n'est jamais converti : le cumul est partiel
 *     et le statut « indetermine », sauf dépassement déjà atteint ;
 *   - une hypothèse (teneur supposée à 20 %, densité 1 kg/L) reste calculée
 *     mais nommée : statut « estime » au lieu de « ok », et l'écran la dit.
 *
 * On considère un traitement comme "cuivre" si :
 *   - le produit phyto a `contientCuivre = true` (flag manuel) OU
 *   - sa classification = "Chimique cuivré" OU
 *   - le nom ou la substance active contient "cuivre" / "bouillie bordelaise"
 */

export const PLAFOND_CU_KG_HA_AN = 4
export const PLAFOND_CU_KG_HA_7ANS = 28
/** Teneur supposée quand la composition du produit n'est pas renseignée (hypothèse affichée). */
export const DEFAULT_CUIVRE_METAL_PCT = 20

export type ProduitCuivre = {
  contientCuivre?: boolean | null
  classification?: string | null
  nomCommercial?: string | null
  substanceActive?: string | null
  /** % de cuivre métal en masse. */
  cuivreMetalPct?: number | null
  /** g de cuivre métal par unité de produit telle que dosée (kg ou L). */
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

/** Hypothèses de calcul, à dire à l'écran. */
export type HypotheseCuivre = 'composition_supposee' | 'densite_supposee'

export const LIBELLES_HYPOTHESES_CUIVRE: Record<HypotheseCuivre, string> = {
  composition_supposee: `teneur en cuivre métal supposée à ${DEFAULT_CUIVRE_METAL_PCT} % pour un produit sans composition renseignée`,
  densite_supposee: 'litres de produit comptés comme des kilos (densité 1 supposée)',
}

type QuantiteProduit = { valeur: number; nature: 'masse' | 'volume' } // kg ou L

const positif = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0

/**
 * Quantité totale de PRODUIT appliquée sur la parcelle (kg pour une masse,
 * L pour un volume), ou null si elle ne se calcule pas sans hypothèse :
 * dose absente, unité absente ou inconnue, surface ou volume de bouillie
 * manquant. Aucune unité n'est plus devinée.
 */
function quantiteProduit(t: TraitementCuivreInput): QuantiteProduit | null {
  const dose = t.doseAppliquee
  if (!positif(dose)) return null
  const unite = (t.uniteDose ?? '').toLowerCase().replace(/\s+/g, '')

  // QA cmsogea5w — quantités ABSOLUES (saisies Verger > Opérations : « 3 kg »,
  // « 2 L » sur un arbre) : pas de surface requise, la quantité est le total.
  if (unite === 'kg') return { valeur: dose, nature: 'masse' }
  if (unite === 'g') return { valeur: dose / 1000, nature: 'masse' }
  if (unite === 'l') return { valeur: dose, nature: 'volume' }
  if (unite === 'ml') return { valeur: dose / 1000, nature: 'volume' }

  const surfaceHa = t.surfaceHa
  if (!positif(surfaceHa)) return null
  if (unite === 'kg/ha') return { valeur: dose * surfaceHa, nature: 'masse' }
  if (unite === 'g/ha') return { valeur: (dose * surfaceHa) / 1000, nature: 'masse' }
  if (unite === 'l/ha') return { valeur: dose * surfaceHa, nature: 'volume' }

  // Concentrations dans la bouillie : il faut le volume de bouillie par hectare.
  const vol = t.volumeBouillieLHa
  if (!positif(vol)) return null
  // g/L : g de produit par L de bouillie → kg de produit par ha → × surface.
  if (unite === 'g/l') return { valeur: ((dose * vol) / 1000) * surfaceHa, nature: 'masse' }
  // mL/L : mL de produit par L de bouillie → L de produit par ha → × surface.
  if (unite === 'ml/l') return { valeur: ((dose * vol) / 1000) * surfaceHa, nature: 'volume' }
  return null
}

export interface DoseCuivre {
  /** kg de cuivre métal ; null quand l'apport ne se calcule pas. */
  kg: number | null
  hypotheses: HypotheseCuivre[]
}

/**
 * Cuivre métal apporté par un traitement (kg), avec les hypothèses utilisées.
 * Un produit non cuivré apporte 0 sans hypothèse.
 *
 * QA cmsogea5w — PAS d'arrondi ici : l'arrondi à 3 décimales PAR LIGNE
 * avant sommation faisait tomber à 0 une intervention réellement dosée
 * (1,5 L/ha × 9,6 m²). On arrondit uniquement à l'affichage.
 */
export function evaluerDoseCuivre(t: TraitementCuivreInput): DoseCuivre {
  if (!isProduitCuivre(t.produit)) return { kg: 0, hypotheses: [] }
  const quantite = quantiteProduit(t)
  if (!quantite) return { kg: null, hypotheses: [] }
  const gParUnite = t.produit?.cuivreMetalGParUnite
  if (positif(gParUnite)) return { kg: (quantite.valeur * gParUnite) / 1000, hypotheses: [] }
  const hypotheses: HypotheseCuivre[] = []
  const pctSaisi = t.produit?.cuivreMetalPct
  const pct = positif(pctSaisi) ? pctSaisi : DEFAULT_CUIVRE_METAL_PCT
  if (!positif(pctSaisi)) hypotheses.push('composition_supposee')
  // Un pourcentage massique ne s'applique à des litres qu'avec une densité.
  if (quantite.nature === 'volume') hypotheses.push('densite_supposee')
  return { kg: (quantite.valeur * pct) / 100, hypotheses }
}

/**
 * - ok : tout est calculé sans hypothèse et reste sous 75 % des repères ;
 * - estime : sous 75 %, mais une hypothèse de calcul a servi ;
 * - warn : ≥ 75 % d'un repère ; alert : ≥ 100 % (le cumul connu suffit) ;
 * - indetermine : au moins un apport cuivré incalculable, pas de dépassement
 *   déjà atteint ;
 * - inconnu : du cuivre apporté sur une parcelle sans surface connue (le
 *   kg/ha ne se calcule pas : jamais « OK » par défaut).
 */
export type StatutCuivre = 'ok' | 'estime' | 'warn' | 'alert' | 'indetermine' | 'inconnu'

export interface CumulCuivreParcelle {
  parcelleId: string
  surfaceHa: number
  /** Cumul cuivre métal (kg) sur l'année courante. */
  cumulAnnuelKg: number
  /** Cumul cuivre métal (kg) sur les 7 dernières années (glissantes). */
  cumul7ansKg: number
  /** Cumul ramené au kg/ha (annuel) — comparable au repère 4. */
  cuivreKgParHaAn: number
  /** Cumul ramené au kg/ha (7 ans) — comparable au repère 28. */
  cuivreKgParHa7ans: number
  statut: StatutCuivre
  /** Au moins un apport cuivré incalculable : les cumuls sont des minimums. */
  partiel: boolean
  /** Hypothèses utilisées par les apports comptés (7 ans). */
  hypotheses: HypotheseCuivre[]
  /** Pour debug : nb de traitements pris en compte. */
  nbTraitementsAn: number
  nbTraitements7ans: number
  /** Bug #12 / revue du 2026-11-12 — traitements cuivrés détectés mais
   *  incalculables (dose, unité, surface ou volume de bouillie manquant). */
  nbTraitementsCuivreSansDose7ans: number
}

/**
 * Agrège un lot de traitements cuivre par parcelle pour calculer les
 * cumuls et alertes. Les traitements non cuivrés sont ignorés.
 */
export function cumuleParParcelle(
  traitements: TraitementCuivreInput[],
  parcelleSurfaces: Map<string, number>, // surface en ha par parcelleId
  asOf: Date = new Date()
): CumulCuivreParcelle[] {
  const anneeCourante = asOf.getFullYear()
  const dateMin7ans = new Date(asOf)
  dateMin7ans.setFullYear(dateMin7ans.getFullYear() - 7)

  type Acc = { an: number; sept: number; nbAn: number; nb7: number; nbSansDose: number; hypotheses: Set<HypotheseCuivre> }
  const acc = new Map<string, Acc>()
  for (const t of traitements) {
    if (!t.parcelleId || !isProduitCuivre(t.produit)) continue
    if (t.date < dateMin7ans) continue
    const cur = acc.get(t.parcelleId) ?? { an: 0, sept: 0, nbAn: 0, nb7: 0, nbSansDose: 0, hypotheses: new Set<HypotheseCuivre>() }
    acc.set(t.parcelleId, cur)
    const { kg, hypotheses } = evaluerDoseCuivre(t)
    if (kg == null) {
      cur.nbSansDose += 1
      continue
    }
    for (const h of hypotheses) cur.hypotheses.add(h)
    cur.sept += kg
    cur.nb7 += 1
    if (t.date.getFullYear() === anneeCourante) {
      cur.an += kg
      cur.nbAn += 1
    }
  }

  const result: CumulCuivreParcelle[] = []
  for (const [parcelleId, sums] of acc) {
    const surfaceHa = parcelleSurfaces.get(parcelleId) ?? 0
    const cuivreKgParHaAn = surfaceHa > 0 ? sums.an / surfaceHa : 0
    const cuivreKgParHa7ans = surfaceHa > 0 ? sums.sept / surfaceHa : 0
    const ratioMax = Math.max(cuivreKgParHaAn / PLAFOND_CU_KG_HA_AN, cuivreKgParHa7ans / PLAFOND_CU_KG_HA_7ANS)
    const partiel = sums.nbSansDose > 0
    // Revue du 2026-11-04 — sans surface (traitements non rattachés à une
    // parcelle, ou parcelle sans surface), le kg/ha valait 0 et la carte
    // affichait « OK » malgré des kilos de cuivre apportés.
    const surfaceInconnue = surfaceHa <= 0 && (sums.an > 0 || sums.sept > 0)
    const statut: StatutCuivre = surfaceInconnue ? 'inconnu'
      : ratioMax >= 1 ? 'alert'
      : partiel ? 'indetermine'
      : ratioMax >= 0.75 ? 'warn'
      : sums.hypotheses.size > 0 ? 'estime'
      : 'ok'
    result.push({
      parcelleId,
      surfaceHa,
      cumulAnnuelKg: Math.round(sums.an * 1000) / 1000,
      cumul7ansKg: Math.round(sums.sept * 1000) / 1000,
      cuivreKgParHaAn: Math.round(cuivreKgParHaAn * 1000) / 1000,
      cuivreKgParHa7ans: Math.round(cuivreKgParHa7ans * 1000) / 1000,
      statut,
      partiel,
      hypotheses: [...sums.hypotheses].sort(),
      nbTraitementsAn: sums.nbAn,
      nbTraitements7ans: sums.nb7,
      nbTraitementsCuivreSansDose7ans: sums.nbSansDose,
    })
  }
  return result.sort((a, b) => b.cuivreKgParHaAn - a.cuivreKgParHaAn)
}
