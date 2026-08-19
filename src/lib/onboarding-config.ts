/**
 * Configuration minimale d'une exploitation à la première connexion.
 *
 * Refonte 2026-08-17 : l'ancien wizard ouvrait sur l'identité LÉGALE (SIRET,
 * régime TVA), ne demandait jamais OÙ se trouve l'exploitation — alors que la
 * parcelle d'exemple créée au signup était géolocalisée en dur à Paris 4ᵉ et
 * pilotait météo, ET0, irrigation, éphémérides et Hub'Eau —, et son étape
 * « premier élément » perdait les saisies verger et élevage (jamais créées).
 *
 * Ce module porte la logique PURE du nouveau parcours, partagée entre l'écran
 * /onboarding et la route POST /api/onboarding/configurer :
 *   - les étapes affichées, dérivées des modules activés ;
 *   - le catalogue de cheptel « grand public » → espèce du référentiel ;
 *   - la parcelle initiale : un carré autour du centre de la commune choisie.
 */

import type { ModuleId } from '@/lib/modules'

// ---------------------------------------------------------------------------
// Étapes du parcours
// ---------------------------------------------------------------------------

export const ETAPE_IDS = [
  'exploitation', // nom + commune + zone climatique — l'ancrage agronomique
  'modules', // quels modules (pivot : conditionne la suite)
  'production', // planche / arbre / cheptel selon modules de production
  'facturation', // identité légale — seulement si comptabilité active
  'demarrage', // récapitulatif + données d'exemple (choix explicite)
] as const

export type EtapeId = (typeof ETAPE_IDS)[number]

export const MODULES_PRODUCTION: ModuleId[] = ['maraichage', 'verger', 'elevage']

/**
 * Étapes réellement affichées pour un jeu de modules actifs.
 * `exploitation`, `modules` et `demarrage` sont toujours là ; `production`
 * n'apparaît que si au moins un module de production est actif, `facturation`
 * que si la comptabilité l'est.
 */
export function etapesPourModules(modules: ModuleId[]): EtapeId[] {
  const etapes: EtapeId[] = ['exploitation', 'modules']
  if (MODULES_PRODUCTION.some((m) => modules.includes(m))) etapes.push('production')
  if (modules.includes('comptabilite')) etapes.push('facturation')
  etapes.push('demarrage')
  return etapes
}

/**
 * Reprise d'un parcours entamé AVANT la refonte : l'ancien wizard persistait
 * un index numérique (`onboardingStep`). On le rabat sur l'étape nouvelle la
 * plus proche plutôt que de faire recommencer.
 * Ancien ordre : 0 légal · 1 modules · 2 premier élément · 3 import · 4 fin.
 */
export function etapeDepuisIndexLegacy(step: number): EtapeId {
  if (step <= 0) return 'exploitation'
  if (step === 1) return 'modules'
  if (step <= 3) return 'production'
  return 'demarrage'
}

// ---------------------------------------------------------------------------
// Cheptel express — libellés grand public → référentiel EspeceAnimale
// ---------------------------------------------------------------------------

/**
 * L'ancien wizard proposait « Poules, Chèvres, Brebis… » puis JETAIT la
 * sélection (aucun lot créé). Chaque entrée pointe désormais une espèce du
 * référentiel officiel ; la race exacte se raffine ensuite depuis Élevage.
 */
export const CHEPTEL_ONBOARDING = [
  { libelle: 'Poules pondeuses', especeAnimaleId: 'poule_pondeuse' },
  { libelle: 'Poulets de chair', especeAnimaleId: 'poulet_chair' },
  { libelle: 'Brebis', especeAnimaleId: 'brebis' },
  { libelle: 'Chèvres', especeAnimaleId: 'chevre_laitiere' },
  { libelle: 'Vaches', especeAnimaleId: 'vache_normande' },
  { libelle: 'Cochons', especeAnimaleId: 'cochon_large_white' },
  { libelle: 'Lapins', especeAnimaleId: 'lapin_chair' },
  { libelle: 'Canards', especeAnimaleId: 'canard_rouen' },
  { libelle: 'Ruches', especeAnimaleId: 'abeille_ruche' },
] as const

export type CheptelOnboarding = (typeof CHEPTEL_ONBOARDING)[number]

export function especeCheptelValide(especeAnimaleId: string): boolean {
  return CHEPTEL_ONBOARDING.some((c) => c.especeAnimaleId === especeAnimaleId)
}

export function libelleCheptel(especeAnimaleId: string): string {
  return (
    CHEPTEL_ONBOARDING.find((c) => c.especeAnimaleId === especeAnimaleId)?.libelle ??
    especeAnimaleId
  )
}

// ---------------------------------------------------------------------------
// Parcelle initiale — carré autour du centre de la commune
// ---------------------------------------------------------------------------

/** Côté par défaut de la parcelle initiale (m) : 50 m ↔ 0,25 ha, échelle micro-ferme. */
export const COTE_PARCELLE_INITIALE_M = 50

export interface ParcelleCarree {
  /** GeoJSON Polygon sérialisé, prêt pour `ParcelleGeo.geometry`. */
  geometry: string
  centroidLat: number
  centroidLng: number
  /** Surface en hectares (convention `ParcelleGeo.surface`). */
  surfaceHa: number
}

/**
 * Carré de `coteM` mètres de côté centré sur (lat, lng). Le pas en longitude
 * est corrigé du cosinus de la latitude ; largement suffisant pour un polygone
 * de départ que l'utilisateur affinera sur la carte.
 */
export function parcelleCarreeAutour(
  lat: number,
  lng: number,
  coteM: number = COTE_PARCELLE_INITIALE_M,
): ParcelleCarree {
  const METRES_PAR_DEGRE_LAT = 111_320
  const demiLat = coteM / 2 / METRES_PAR_DEGRE_LAT
  const metresParDegreLng = METRES_PAR_DEGRE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
  const demiLng = coteM / 2 / metresParDegreLng

  const arrondi = (v: number) => Math.round(v * 1e7) / 1e7
  const s = arrondi(lat - demiLat)
  const n = arrondi(lat + demiLat)
  const o = arrondi(lng - demiLng)
  const e = arrondi(lng + demiLng)

  return {
    geometry: JSON.stringify({
      type: 'Polygon',
      // Anneau fermé, sens anti-horaire, [lng, lat] (convention GeoJSON).
      coordinates: [
        [
          [o, s],
          [e, s],
          [e, n],
          [o, n],
          [o, s],
        ],
      ],
    }),
    centroidLat: arrondi(lat),
    centroidLng: arrondi(lng),
    surfaceHa: Math.round(((coteM * coteM) / 10_000) * 100) / 100,
  }
}

/** Coordonnées plausibles (monde entier — l'outre-mer est un public cible). */
export function coordonneesValides(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // (0,0) est l'artefact classique d'un géocodage raté, pas une ferme.
    !(lat === 0 && lng === 0)
  )
}

/** Types de sol proposés — les valeurs canoniques des planches (fiche planche). */
export const TYPES_SOL_ONBOARDING = ['Limoneux', 'Argileux', 'Sableux', 'Mixte'] as const
