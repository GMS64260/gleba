/**
 * Normalisation des libellés saisis librement (espèce, variété, porte-greffe,
 * fournisseur…).
 *
 * Né d'un constat de production du 2026-08-03 : deux arbres portaient l'espèce
 * « Cerisier » avec une espace finale. Le calendrier d'entretien s'en sortait —
 * il compare en `trim().toLowerCase()` — mais tous les regroupements par espèce
 * voyaient deux espèces distinctes, dont une ligne fantôme dans le diagramme
 * d'entretien. Une espace invisible ne doit jamais fabriquer une entité.
 *
 * On normalise à l'écriture, là où la donnée entre, plutôt que de rattraper à
 * chaque lecture. On ne touche NI à la casse NI aux accents : « Reinette grise »
 * est le libellé de l'utilisateur, pas une clé technique.
 *
 * Le champ ABSENT du payload reste `undefined`, que Prisma interprète comme
 * « ne pas modifier ». Confondre « absent » et « vidé » effacerait l'espèce d'un
 * arbre à la première mise à jour partielle — c'est exactement la classe de
 * défaut corrigée le même jour sur le rattachement de parcelle.
 */
export function normaliserLibelle(valeur: unknown): string | null | undefined {
  if (valeur === undefined) return undefined
  if (typeof valeur !== "string") return valeur == null ? null : undefined
  const normalise = valeur.replace(/\s+/g, " ").trim()
  return normalise === "" ? null : normalise
}
