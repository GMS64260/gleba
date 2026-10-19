/**
 * Compatibilité de floraison entre deux variétés d'une même espèce.
 *
 * Source unique de la matrice Verger > Santé > Pollinisation : la dérivation
 * serveur des pollinisateurs (`computePollinisationVerger`) et la suggestion
 * du dialogue « Nouvelle association » passent toutes deux par ici.
 *
 * Signalement QA du 2026-10-19 : deux variétés personnelles de prunier dont la
 * floraison était saisie (S14 à S16), affectées à deux arbres, ressortaient
 * « Floraison - » et « À vérifier (groupe de floraison inconnu) ». Les
 * semaines saisies sur la variété n'étaient lues que si l'arbre portait l'id
 * technique de la variété (voir `variete-arbre.ts`), et l'écran ne regardait
 * que le groupe A-D du catalogue.
 *
 * Règle :
 *   1. les deux périodes de floraison sont connues : elles décident seules.
 *      Au moins une semaine commune = compatibilité vérifiée ; aucune = pas
 *      pollinisateur, quel que soit le groupe ;
 *   2. sinon les deux groupes de floraison (A-D) sont connus : identiques ou
 *      adjacents = compatibilité vérifiée ; plus écartés = pas pollinisateur ;
 *   3. sinon (une seule floraison renseignée, ou aucune) : compatibilité
 *      présumée, jamais affirmée.
 *
 * Module pur (aucun accès base) : importable côté écran.
 */

import {
  libellePeriodeSemainesCourt,
  semainesDePeriode,
  type PeriodeSemaines,
} from "@/lib/semaines-lisibles"

export interface FloraisonVariete {
  /** Période de floraison saisie sur la variété (semaine ISO + durée). */
  periode: PeriodeSemaines | null
  /** Groupe de floraison A-D (celui de l'arbre, à défaut celui de la variété). */
  groupe: string | null
}

/** Valeur pré-remplie du champ « Compatibilité » d'une association. */
export type NiveauCompatibilite = "excellente" | "bonne" | "partielle"

export interface CompatibiliteFloraison {
  /** Faux : l'autre arbre n'est pas un pollinisateur (floraisons disjointes, groupes écartés). */
  compatible: boolean
  /** « presumee » quand la donnée manque : rien n'est affirmé. */
  certitude: "verifiee" | "presumee"
  /** Ce qui a tranché. */
  base: "periodes" | "groupes" | "donnees_incompletes"
  niveau: NiveauCompatibilite
  /** Fragment de phrase, sans majuscule initiale (« floraisons simultanées (…) »). */
  raison: string
}

const ORDRE_GROUPES = ["A", "B", "C", "D", "E"]

/** Groupes de floraison identiques ou adjacents (A↔B, B↔C, C↔D…), casse ignorée. */
export function groupesFloraisonAdjacents(g1: string, g2: string): boolean {
  const a = g1.trim().toUpperCase()
  const b = g2.trim().toUpperCase()
  const i1 = ORDRE_GROUPES.indexOf(a)
  const i2 = ORDRE_GROUPES.indexOf(b)
  if (i1 < 0 || i2 < 0) return a === b
  return Math.abs(i1 - i2) <= 1
}

/** Nombre de semaines ISO communes à deux périodes (passage par janvier compris). */
export function semainesCommunes(a: PeriodeSemaines, b: PeriodeSemaines): number {
  const semainesA = semainesDePeriode(a)
  let communes = 0
  for (const semaine of semainesDePeriode(b)) if (semainesA.has(semaine)) communes++
  return communes
}

function libellePeriode(periode: PeriodeSemaines): string {
  return libellePeriodeSemainesCourt(periode.debut, periode.duree) ?? ""
}

export function compatibiliteFloraison(
  a: FloraisonVariete,
  b: FloraisonVariete,
): CompatibiliteFloraison {
  if (a.periode && b.periode) {
    const communes = semainesCommunes(a.periode, b.periode)
    const libelles = `${libellePeriode(a.periode)} / ${libellePeriode(b.periode)}`
    if (communes === 0) {
      return {
        compatible: false,
        certitude: "verifiee",
        base: "periodes",
        niveau: "partielle",
        raison: `floraisons sans semaine commune (${libelles})`,
      }
    }
    // Recouvrement d'au moins la moitié de la floraison la plus courte :
    // pollinisation au mieux ; en deçà, bonne mais sur une fenêtre réduite.
    const plusCourte = Math.min(semainesDePeriode(a.periode).size, semainesDePeriode(b.periode).size)
    return {
      compatible: true,
      certitude: "verifiee",
      base: "periodes",
      niveau: communes * 2 >= plusCourte ? "excellente" : "bonne",
      raison: `floraisons simultanées (${libelles})`,
    }
  }

  const ga = a.groupe?.trim() || null
  const gb = b.groupe?.trim() || null
  if (ga && gb) {
    if (!groupesFloraisonAdjacents(ga, gb)) {
      return {
        compatible: false,
        certitude: "verifiee",
        base: "groupes",
        niveau: "partielle",
        raison: `groupes de floraison ${ga}/${gb} trop écartés`,
      }
    }
    return {
      compatible: true,
      certitude: "verifiee",
      base: "groupes",
      niveau: ga.toUpperCase() === gb.toUpperCase() ? "excellente" : "bonne",
      raison: `groupes de floraison ${ga}/${gb}`,
    }
  }

  const periodesConnues = Number(Boolean(a.periode)) + Number(Boolean(b.periode))
  return {
    compatible: true,
    certitude: "presumee",
    base: "donnees_incompletes",
    niveau: "partielle",
    raison:
      periodesConnues === 1
        ? "floraison renseignée sur une seule des deux variétés : compatibilité non vérifiée"
        : "ni période ni groupe de floraison connus pour les deux variétés : compatibilité non vérifiée",
  }
}
