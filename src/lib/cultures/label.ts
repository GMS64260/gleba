/**
 * Libellé lisible d'une culture (espèce, variété, planche).
 *
 * L'API des cultures renvoie les enregistrements Prisma bruts : `espece`,
 * `variete` et `planche` sont des **objets**, pas des chaînes. Les écrans qui
 * les interpolaient directement affichaient « [object Object] » (QA 2026-07-30
 * sur le sélecteur Culture de /interventions). Le même motif de résolution
 * existait déjà côté serveur, dupliqué : il est centralisé ici.
 */

type RefNomme = { id?: string | null; nom?: string | null } | string | null | undefined

export type CulturePourLabel = {
  espece?: RefNomme
  especeId?: string | null
  variete?: RefNomme
  varieteId?: string | null
  planche?: { nom?: string | null; id?: string | null } | null
  plancheId?: string | null
}

/** Accepte une relation Prisma, une chaîne déjà aplatie, ou rien. */
function nomDe(ref: RefNomme, repli?: string | null): string | null {
  if (typeof ref === "string") return ref || null
  if (ref && typeof ref === "object") return ref.nom || ref.id || repli || null
  return repli || null
}

export function libelleCulture(culture: CulturePourLabel): string {
  const espece = nomDe(culture.espece, culture.especeId)
  const variete = nomDe(culture.variete, culture.varieteId)
  const planche = culture.planche?.nom || culture.planche?.id || culture.plancheId || null

  const base = espece ?? "Culture"
  const avecVariete = variete && variete !== espece ? `${base} (${variete})` : base
  return planche ? `${avecVariete} — ${planche}` : avecVariete
}
