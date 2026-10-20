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
 * QA cmvgee5s9 (2026-10-20) : deux floraisons sans semaine commune (S14-S16
 * et S23-S25) étaient pré-remplies « Partielle » dans « Nouvelle association »,
 * et la route enregistrait l'association : un pollinisateur absent pendant la
 * floraison éteignait l'alerte « sans pollinisateur ». Une compatibilité
 * démentie par les floraisons vaut désormais « incompatible », et
 * POST /api/arbres/pollinisation la refuse (`refusPollinisateurFloraison`).
 *
 * Règle :
 *   1. les deux périodes de floraison sont connues : elles décident seules,
 *      quel que soit le groupe. Le recouvrement se mesure sur la floraison la
 *      plus courte : entièrement couverte = excellente ; au moins à moitié =
 *      bonne ; moins de la moitié = partielle ; aucune semaine commune =
 *      incompatible (pas pollinisateur) ;
 *   2. sinon les deux groupes de floraison sont connus ET sur l'échelle A-E :
 *      identiques = excellente, adjacents = bonne ; plus écartés =
 *      incompatible ;
 *   3. sinon (une seule floraison renseignée, aucune, ou un groupe hors de
 *      l'échelle A-E) : compatibilité présumée « partielle », jamais affirmée.
 *      `arbres.groupe_pollinisation` est un texte libre (« précoce »,
 *      « mi-saison », « 3 » existent en base) : un tel groupe ne permet aucun
 *      verdict, donc ni refus ni démenti d'association (revue du 2026-10-20).
 *
 * Seule une incompatibilité VÉRIFIÉE (périodes connues disjointes, ou deux
 * groupes de l'échelle trop écartés) refuse ou dément une association.
 *
 * Module pur (aucun accès base) : importable côté écran.
 */

import {
  libellePeriodeSemainesCourt,
  periodeDepuisSemaines,
  semainesDePeriode,
  type PeriodeSemaines,
} from "@/lib/semaines-lisibles"

export interface FloraisonVariete {
  /** Période de floraison saisie sur la variété (semaine ISO + durée). */
  periode: PeriodeSemaines | null
  /** Groupe de floraison A-D (celui de l'arbre, à défaut celui de la variété). */
  groupe: string | null
}

/**
 * Valeur pré-remplie du champ « Compatibilité » d'une association
 * (`pollinisation_arbres.compatibilite`). « incompatible » n'est jamais
 * enregistrable : c'est le niveau d'un pollinisateur que les floraisons (ou la
 * ploïdie) excluent.
 */
export type NiveauCompatibilite = "excellente" | "bonne" | "partielle" | "incompatible"

/** Niveaux qu'une association enregistrée peut porter. */
export const NIVEAUX_ASSOCIATION = ["excellente", "bonne", "partielle"] as const

/** Texte d'aide du champ « Compatibilité » : il décrit exactement la règle ci-dessous. */
export const AIDE_COMPATIBILITE_FLORAISON =
  "Pré-remplie depuis les floraisons des variétés. Périodes saisies sur la variété, " +
  "mesurées sur la floraison la plus courte : entièrement couverte = excellente, " +
  "au moins à moitié = bonne, moins de la moitié = partielle, aucune semaine commune = " +
  "incompatible (association refusée). À défaut, groupes de floraison A à E : même groupe = " +
  "excellente, adjacent = bonne, plus écartés = incompatible. Données incomplètes (une seule " +
  "floraison connue, aucune, ou groupe hors de l'échelle A-E) = partielle présumée, à vérifier. " +
  "Pollinisateur triploïde (pollen stérile) = incompatible."

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

/** Groupe ramené à l'échelle A-E (casse et espaces ignorés), ou null s'il en est hors. */
export function groupeFloraisonEchelle(groupe: string | null | undefined): string | null {
  const g = groupe?.trim().toUpperCase() ?? ""
  return ORDRE_GROUPES.includes(g) ? g : null
}

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
        niveau: "incompatible",
        raison: `floraisons sans semaine commune (${libelles})`,
      }
    }
    // Recouvrement mesuré sur la floraison la plus courte : entièrement
    // couverte, pollinisation au mieux ; au moins à moitié, bonne ; en deçà,
    // fenêtre réduite (partielle).
    const plusCourte = Math.min(semainesDePeriode(a.periode).size, semainesDePeriode(b.periode).size)
    const niveau: NiveauCompatibilite =
      communes >= plusCourte ? "excellente" : communes * 2 >= plusCourte ? "bonne" : "partielle"
    return {
      compatible: true,
      certitude: "verifiee",
      base: "periodes",
      niveau,
      raison:
        niveau === "excellente"
          ? `floraisons simultanées (${libelles})`
          : `floraisons simultanées sur ${communes} semaine${communes > 1 ? "s" : ""} (${libelles})`,
    }
  }

  const ga = groupeFloraisonEchelle(a.groupe)
  const gb = groupeFloraisonEchelle(b.groupe)
  if (ga && gb) {
    if (!groupesFloraisonAdjacents(ga, gb)) {
      return {
        compatible: false,
        certitude: "verifiee",
        base: "groupes",
        niveau: "incompatible",
        raison: `groupes de floraison ${ga}/${gb} trop écartés`,
      }
    }
    return {
      compatible: true,
      certitude: "verifiee",
      base: "groupes",
      niveau: ga === gb ? "excellente" : "bonne",
      raison: `groupes de floraison ${ga}/${gb}`,
    }
  }

  const periodesConnues = Number(Boolean(a.periode)) + Number(Boolean(b.periode))
  const horsEchelle = [a.groupe, b.groupe]
    .map((g) => g?.trim() || null)
    .filter((g): g is string => g != null && groupeFloraisonEchelle(g) == null)
  return {
    compatible: true,
    certitude: "presumee",
    base: "donnees_incompletes",
    niveau: "partielle",
    raison:
      periodesConnues === 1
        ? "floraison renseignée sur une seule des deux variétés : compatibilité non vérifiée"
        : horsEchelle.length > 0
          ? `groupe de floraison hors de l'échelle A-E (${horsEchelle.map((g) => `« ${g} »`).join(", ")}) : compatibilité non vérifiée`
          : "ni période ni groupe de floraison connus pour les deux variétés : compatibilité non vérifiée",
  }
}

/**
 * Floraison d'un arbre telle que la règle la lit : période saisie sur sa
 * variété du référentiel, groupe de l'arbre à défaut celui de la variété.
 * Partagée par la matrice (`computePollinisationVerger`) et la garde de
 * POST /api/arbres/pollinisation.
 */
export function floraisonArbre(
  arbre: { groupePollinisation: string | null },
  variete: {
    semaineFloraison?: number | null
    dureeFloraison?: number | null
    groupePollinisation?: string | null
  } | null,
): FloraisonVariete {
  return {
    periode: periodeDepuisSemaines(variete?.semaineFloraison, variete?.dureeFloraison),
    groupe: arbre.groupePollinisation ?? variete?.groupePollinisation ?? null,
  }
}

/**
 * Motif de refus d'une association démentie par les floraisons (aucune semaine
 * commune, groupes trop écartés), ou null. Une présomption (donnée manquante)
 * n'est jamais refusée : rien n'y est affirmé.
 */
export function refusPollinisateurFloraison(compat: CompatibiliteFloraison): string | null {
  if (compat.compatible || compat.certitude !== "verifiee") return null
  return `Pollinisateur incompatible : ${compat.raison}. Il ne fleurit pas en même temps que l'arbre à polliniser, aucune pollinisation croisée n'est possible.`
}
