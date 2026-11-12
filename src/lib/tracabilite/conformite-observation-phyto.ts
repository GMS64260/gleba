/**
 * Champs réglementaires d'un traitement saisi depuis Verger > Santé & Phyto
 * (table `observations_sante`), règle unique de :
 *   - POST /api/arbres/observations (refus d'une saisie incomplète) ;
 *   - PUT /api/arbres/observations/[id] (refus d'une modification qui vide un champ) ;
 *   - la conformité de la ligne au registre général (`registre-phyto.ts`) ;
 *   - les champs marqués obligatoires dans les dialogues du registre Verger.
 *
 * Revue du lot QA du 2026-10-20 (cmvgeltj1) : le registre général exigeait
 * surface, DAR et dose de TOUTE observation alors que la saisie ne les
 * exigeait que d'un traitement chimique (et ne demandait ni la dose ni le
 * DAR) : une ligne biocontrôle sortait « Non conforme » sans qu'aucun écran
 * ne permette de la corriger. Une seule liste désormais.
 *
 * Deux règles distinctes depuis la revue de conformité du 2026-11-12 (C1) :
 *
 * 1. Saisie (bloquante, inchangée) : pour une méthode chimique
 *    (conventionnelle, cuivrée, ou la valeur historique « chimique »),
 *    produit, AMM, dose, surface, DAR, bouillie, conditions météo, certificat
 *    de l'opérateur et ZNT (`champsManquantsObservationPhyto`).
 *
 * 2. Registre (non bloquante) : arrêté du 24 décembre 2025 relatif aux
 *    registres d'utilisation des produits phytopharmaceutiques, annexe I.
 *    Toute utilisation d'un produit phytopharmaceutique (PPP) doit porter le
 *    nom commercial, le numéro d'autorisation, la dose et la surface traitée,
 *    biocontrôle compris : un produit de biocontrôle à base de
 *    micro-organismes, de médiateurs chimiques ou de substances naturelles
 *    est un PPP (code rural, art. L. 253-6, 2°) soumis à autorisation
 *    (art. L. 253-1). L'ancienne règle tenait une ligne biocontrôle pour
 *    « conforme » sans AMM, dose ni surface. Les macro-organismes
 *    (trichogrammes, coccinelles…), au 1° du même article, ne sont pas
 *    présentés comme des PPP : ils ont leur propre méthode et aucune AMM
 *    n'est exigée, pas
 *    plus que pour un purin, un moyen mécanique ou la prophylaxie
 *    (`champsManquantsRegistreObservation`). Un fait réel incomplet reste
 *    enregistrable : le registre signale ce qui manque.
 *
 * Module pur (aucun accès base) : importable côté écran.
 */

import { methodeExigeCertiphyto } from "@/lib/phyto/methodes"

/** Méthodes d'une observation santé qui la font figurer au registre (registre, export, historique). */
export const METHODES_OBSERVATION_REGISTRE = [
  "chimique_conventionnel",
  "chimique_cuivre",
  "biocontrole",
  "biologique_purin",
  "chimique",
  "biologique",
] as const

/**
 * Méthode qui emploie un produit phytopharmaceutique soumis à autorisation :
 * chimique (valeur historique comprise) ou biocontrôle sous AMM.
 */
export function estMethodeProduitPhytopharmaceutique(methode: string | null | undefined): boolean {
  return estMethodeChimiqueObservation(methode) || methode === "biocontrole"
}

/** Méthode soumise aux champs réglementaires (valeur historique « chimique » comprise). */
export function estMethodeChimiqueObservation(methode: string | null | undefined): boolean {
  return methodeExigeCertiphyto(methode) || methode === "chimique"
}

/** Valeurs telles qu'en base ou telles que reçues du formulaire (chaînes). */
export interface ObservationPhyto {
  methodeTraitement?: string | null
  produit?: string | null
  numAMM?: string | null
  doseAppliquee?: number | string | null
  uniteDose?: string | null
  surfaceTraiteeHa?: number | string | null
  dar?: number | string | null
  volumeBouillieLHa?: number | string | null
  volumeBouillieLTotal?: number | string | null
  temperatureC?: number | string | null
  ventKmh?: number | string | null
  hygrometriePct?: number | string | null
  pluie24h?: boolean | null
  certiphytoNum?: string | null
  zntRespectee?: boolean | null
}

export interface ChampObligatoirePhyto {
  /** Clé du registre (`champsManquants`), partagée avec les interventions quand elle existe. */
  cle: string
  /** Libellé affiché dans le refus de saisie. */
  libelle: string
  manque: (o: ObservationPhyto) => boolean
}

const renseigne = (v: unknown) => v != null && !(typeof v === "string" && v.trim() === "")
const positif = (v: unknown) => renseigne(v) && Number(v) > 0

export const CHAMPS_OBLIGATOIRES_CHIMIQUE: readonly ChampObligatoirePhyto[] = [
  { cle: "produitPhyto", libelle: "Produit", manque: (o) => !renseigne(o.produit) },
  { cle: "numAMM", libelle: "N° AMM", manque: (o) => !renseigne(o.numAMM) },
  { cle: "doseAppliquee", libelle: "Dose", manque: (o) => !positif(o.doseAppliquee) },
  { cle: "surfaceTraitee", libelle: "Surface traitée (ha)", manque: (o) => !positif(o.surfaceTraiteeHa) },
  { cle: "dar", libelle: "DAR (jours)", manque: (o) => !renseigne(o.dar) },
  {
    cle: "volumeBouillie",
    libelle: "Volume de bouillie",
    manque: (o) => !renseigne(o.volumeBouillieLHa) && !renseigne(o.volumeBouillieLTotal),
  },
  { cle: "temperatureC", libelle: "Température (°C)", manque: (o) => !renseigne(o.temperatureC) },
  { cle: "ventKmh", libelle: "Vent (km/h)", manque: (o) => !renseigne(o.ventKmh) },
  { cle: "hygrometriePct", libelle: "Hygrométrie (%)", manque: (o) => !renseigne(o.hygrometriePct) },
  { cle: "pluie24h", libelle: "Pluie ±24h", manque: (o) => o.pluie24h == null },
  { cle: "certiphytoNum", libelle: "N° Certiphyto opérateur", manque: (o) => !renseigne(o.certiphytoNum) },
  { cle: "zntRespectee", libelle: "ZNT cours d'eau", manque: (o) => o.zntRespectee == null },
]

/**
 * Mentions de l'annexe I de l'arrêté du 24 décembre 2025 propres à
 * l'utilisation d'un produit : nom commercial, numéro d'autorisation, dose avec
 * son unité (annexe II : « numérique + unité ») et surface traitée.
 */
export const MENTIONS_PRODUIT_ANNEXE_I: readonly ChampObligatoirePhyto[] = [
  { cle: "produitPhyto", libelle: "Produit", manque: (o) => !renseigne(o.produit) },
  { cle: "numAMM", libelle: "N° AMM", manque: (o) => !renseigne(o.numAMM) },
  { cle: "doseAppliquee", libelle: "Dose", manque: (o) => !positif(o.doseAppliquee) },
  {
    cle: "uniteDose",
    libelle: "Unité de dose",
    manque: (o) => positif(o.doseAppliquee) && !renseigne(o.uniteDose),
  },
  { cle: "surfaceTraitee", libelle: "Surface traitée (ha)", manque: (o) => !positif(o.surfaceTraiteeHa) },
]

/**
 * Mentions manquantes d'une observation au registre : règle de saisie d'une
 * méthode chimique, plus les mentions produit de l'annexe I pour tout PPP
 * (biocontrôle compris). Vide pour un macro-organisme, un purin, un moyen
 * mécanique ou la prophylaxie : aucune autorisation n'y est attendue.
 */
export function champsManquantsRegistreObservation(o: ObservationPhyto): ChampObligatoirePhyto[] {
  if (!estMethodeProduitPhytopharmaceutique(o.methodeTraitement)) return []
  const manquants = estMethodeChimiqueObservation(o.methodeTraitement)
    ? CHAMPS_OBLIGATOIRES_CHIMIQUE.filter((champ) => champ.manque(o))
    : []
  for (const mention of MENTIONS_PRODUIT_ANNEXE_I) {
    if (mention.manque(o) && !manquants.some((m) => m.cle === mention.cle)) manquants.push(mention)
  }
  return manquants
}

/** Champs bloquants à la saisie d'une observation, vides hors méthode chimique. */
export function champsManquantsObservationPhyto(o: ObservationPhyto): ChampObligatoirePhyto[] {
  if (!estMethodeChimiqueObservation(o.methodeTraitement)) return []
  return CHAMPS_OBLIGATOIRES_CHIMIQUE.filter((champ) => champ.manque(o))
}

/** Le champ `cle` est-il obligatoire pour cette méthode ? (astérisque des dialogues) */
export function champObligatoireObservation(methode: string | null | undefined, cle: string): boolean {
  return estMethodeChimiqueObservation(methode) && CHAMPS_OBLIGATOIRES_CHIMIQUE.some((c) => c.cle === cle)
}

export const MESSAGE_CHAMPS_REGLEMENTAIRES =
  "Champs réglementaires manquants (registre phytosanitaire, arrêté du 24 décembre 2025) : "
