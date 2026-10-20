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
 * Arrêté du 4 mai 2017 modifié : pour une méthode chimique (conventionnelle,
 * cuivrée, ou la valeur historique « chimique »), produit, AMM, dose, surface,
 * DAR, bouillie, conditions météo, certificat de l'opérateur et ZNT. Les
 * autres méthodes (biocontrôle, purin, mécanique…) n'ont pas d'exigence de
 * saisie ; seule la forme d'une AMM saisie est contrôlée (sept chiffres).
 *
 * Module pur (aucun accès base) : importable côté écran.
 */

import { methodeExigeCertiphyto } from "@/lib/phyto/methodes"

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

/** Champs réglementaires manquants d'une observation, vides hors méthode chimique. */
export function champsManquantsObservationPhyto(o: ObservationPhyto): ChampObligatoirePhyto[] {
  if (!estMethodeChimiqueObservation(o.methodeTraitement)) return []
  return CHAMPS_OBLIGATOIRES_CHIMIQUE.filter((champ) => champ.manque(o))
}

/** Le champ `cle` est-il obligatoire pour cette méthode ? (astérisque des dialogues) */
export function champObligatoireObservation(methode: string | null | undefined, cle: string): boolean {
  return estMethodeChimiqueObservation(methode) && CHAMPS_OBLIGATOIRES_CHIMIQUE.some((c) => c.cle === cle)
}

export const MESSAGE_CHAMPS_REGLEMENTAIRES = "Champs réglementaires manquants (arrêté du 4 mai 2017 modifié) : "
