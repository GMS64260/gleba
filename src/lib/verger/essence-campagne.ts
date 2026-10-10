/**
 * Nom d'essence affiché pour une campagne de plantation.
 *
 * Ticket cmv2908du (QA 2026-10-10) — l'assistant Plantation recopiait l'id
 * d'une espèce fruitière dans `essenceLibre` ; pour une espèce récente (perso,
 * communauté, référentiel outre-mer) cet id est un cuid. Le nom de l'espèce
 * liée prime donc sur le texte libre, ce qui répare aussi l'affichage des
 * campagnes déjà enregistrées. Sans espèce liée (forestière, bocagère, saisie
 * libre), le texte libre fait foi.
 */
export function nomEssenceCampagne(c: {
  essenceLibre: string | null
  espece: { nom?: string | null; nomLatin?: string | null } | null
}): string | null {
  return c.espece?.nom || c.essenceLibre || c.espece?.nomLatin || null
}
