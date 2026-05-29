/**
 * Référentiel communautaire — types partagés des avis (client-safe : aucun import
 * Prisma/serveur ici, ce module est importable depuis les composants React).
 */

/** Type d'objet noté. Valeurs alignées sur l'enum Prisma `AvisRefType`. */
export type AvisRefType = 'VARIETE' | 'PORTE_GREFFE' | 'ESPECE' | 'RACE' | 'ITP'

export const AVIS_REF_TYPES: AvisRefType[] = ['VARIETE', 'PORTE_GREFFE', 'ESPECE', 'RACE', 'ITP']

/** Forme minimale d'un avis pour les calculs (notes = { critereKey: 1-5 }). */
export interface AvisNotable {
  reprend?: boolean | null
  notes?: Record<string, number | null> | null
  contexteTypeSol?: string | null
  contexteZoneClimat?: string | null
}

export interface StatsAvis {
  nbAvis: number
  /** Taux de « je la reprends/recommande » parmi les avis l'ayant renseigné (null sinon). */
  tauxReprise: number | null
  /** Moyenne brute des notes globales (null si aucune note). */
  noteMoyenne: number | null
  /** Note lissée (bayésienne) — sert au classement « les meilleurs remontent ». */
  scoreCommunautaire: number
  /** Moyenne brute par critère (clé = critereKey du type). */
  moyennesParCritere: Record<string, number | null>
}

/** Stats légères attachées à chaque objet dans les listes (`?avis=1`). */
export type AvisStatsListe = Pick<
  StatsAvis,
  'nbAvis' | 'noteMoyenne' | 'tauxReprise' | 'scoreCommunautaire'
> & { badgeTerrain: boolean }

export interface GroupeTerroir {
  typeSol: string | null
  zoneClimat: string | null
  nbAvis: number
  noteMoyenne: number | null
  /** true si nbAvis ≥ SEUIL_TERROIR : la note de ce terroir est statistiquement parlante. */
  fiable: boolean
}

/** Production réelle agrégée (signal data-driven, calcul par type). */
export interface RendementReel {
  /** Nb d'unités (cultures / arbres / animaux) ayant réellement produit. */
  nbProductif: number
  /** Nb d'exploitations (users) distinctes l'ayant produite. */
  nbExploitations: number
  /** Quantité totale produite (unité selon le type). */
  quantiteTotale: number
}

// ── Constantes de réglage ─────────────────────────────────────────────────────
/** Poids de la moyenne bayésienne (nb d'avis « fictifs » à la moyenne générale). */
export const POIDS_BAYESIEN = 5
/** Note par défaut quand aucun avis n'existe (milieu de l'échelle 1-5). */
export const NOTE_DEFAUT = 3
/** Nb d'unités réellement productives requis pour le badge « confirmé terrain ». */
export const SEUIL_TERRAIN = 3
/** Nb d'avis d'un terroir à partir duquel sa note est jugée fiable. */
export const SEUIL_TERROIR = 3
