/**
 * Variété du référentiel désignée par `arbres.variete`.
 *
 * `arbres.variete` est un libellé : l'id d'une variété officielle (qui est son
 * nom lisible), ou le texte choisi ou saisi dans le champ Variété. Une variété
 * personnelle a pour id un cuid et porte son libellé dans `nom` : lue par son
 * seul id, elle n'était jamais retrouvée, et la matrice de pollinisation
 * ignorait les floraisons saisies sur elle (signalement QA du 2026-10-19).
 *
 * Règle de résolution :
 *   1. l'id exact (variété officielle, ou cuid choisi dans la liste) ;
 *   2. sinon le libellé, à la casse, aux accents et à la ponctuation près
 *      (`normalizeVarieteName`), PARMI les variétés de l'espèce de l'arbre
 *      (`especeId`, à défaut le libellé `espece`) ; priorité à la variété
 *      personnelle de l'utilisateur, puis à l'officielle, puis à une partagée.
 * Sans espèce connue, seul l'id exact fait foi : un même nom de variété existe
 * dans plusieurs espèces.
 *
 * Migration envisagée, non faite : une colonne `arbres.variete_id` (FK
 * `varietes.variete`, ON DELETE SET NULL) remplirait ce rôle par identifiant.
 */

import { normalizeReferentielKey, normalizeVarieteName } from "@/lib/normalize"
import { visibiliteReferentiel } from "@/lib/referentiel-communaute"

export interface VarieteCandidate {
  id: string
  nom: string | null
  nomNormalise: string | null
  especeId: string
  userId: string | null
}

export interface ArbreVarieteSaisie {
  variete: string | null
  especeId?: string | null
  espece?: string | null
}

const cleVariete = (v: VarieteCandidate) =>
  v.nomNormalise || normalizeVarieteName(v.nom?.trim() || v.id)

/** Choisit la variété désignée par l'arbre parmi les candidates (sans accès base). */
export function choisirVarieteArbre<V extends VarieteCandidate>(
  arbre: ArbreVarieteSaisie,
  candidats: readonly V[],
  userId: string,
): V | null {
  const saisie = arbre.variete?.trim()
  if (!saisie) return null

  const parId = candidats.find((v) => v.id === saisie)
  if (parId) return parId

  const especes = new Set(
    [arbre.especeId, arbre.espece]
      .map((e) => (e ? normalizeReferentielKey(e) : ""))
      .filter(Boolean),
  )
  if (especes.size === 0) return null
  const cle = normalizeVarieteName(saisie)
  if (!cle) return null

  const rang = (v: V) => (v.userId === userId ? 0 : v.userId == null ? 1 : 2)
  const correspondants = candidats
    .filter((v) => especes.has(normalizeReferentielKey(v.especeId)) && cleVariete(v) === cle)
    .sort((a, b) => rang(a) - rang(b))
  return correspondants[0] ?? null
}

/**
 * Filtre Prisma des variétés candidates pour un lot d'arbres : visibles de
 * l'utilisateur (officielles, partagées, les siennes) et désignées par id ou
 * par libellé normalisé. Le choix final se fait par `choisirVarieteArbre`.
 */
export function whereVarietesCandidates(arbres: readonly ArbreVarieteSaisie[], userId: string) {
  const saisies = [
    ...new Set(arbres.map((a) => a.variete?.trim()).filter((v): v is string => Boolean(v))),
  ]
  const cles = [...new Set(saisies.map((s) => normalizeVarieteName(s)).filter(Boolean))]
  return {
    AND: [
      visibiliteReferentiel(userId),
      { OR: [{ id: { in: saisies } }, { nomNormalise: { in: cles } }] },
    ],
  }
}

/** Libellé à proposer dans le champ Variété d'un arbre : le nom affiché, jamais un cuid. */
export function libelleVarieteOption(v: { id: string; nom?: string | null }): string {
  return v.nom?.trim() || v.id
}
