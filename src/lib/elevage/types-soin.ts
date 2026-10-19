/**
 * Types de soin, tels que l'écran les enregistre (valeur = libellé).
 *
 * Source unique pour le formulaire de soin et l'assistant. Signalement du
 * 2026-09-25 : l'assistant filtrait sur « autre » et créait des soins
 * « vermifuge » ou « traitement » en minuscules, alors que l'écran enregistre
 * « Autre », « Vermifuge », « Traitement vétérinaire » : sa recherche rendait
 * 0 soin et ses créations échappaient aux règles des soins médicamenteux.
 */

export const TYPES_SOIN: ReadonlyArray<{ valeur: string; rente: boolean }> = [
  { valeur: 'Vaccination', rente: false },
  { valeur: 'Vermifuge', rente: false },
  { valeur: 'Traitement vétérinaire', rente: false },
  { valeur: 'Castration', rente: false },
  { valeur: 'Identification', rente: false },
  { valeur: 'Tonte', rente: true },
  { valeur: 'Parage onglons', rente: true },
  { valeur: 'Prophylaxie obligatoire', rente: true },
  { valeur: 'Coproscopie', rente: true },
  { valeur: 'Mise en lutte', rente: true },
  { valeur: 'Tarissement', rente: true },
  { valeur: 'Autre', rente: false },
]

const sansAccent = (texte: string) =>
  texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Valeur enregistrée pour une saisie libre (« traitement », « autre »…) : le
 * type de l'écran dont le libellé commence par la saisie, casse et accents
 * ignorés. Null si rien ne correspond.
 */
export function normaliserTypeSoin(saisie: string): string | null {
  const cle = sansAccent(saisie)
  if (!cle) return null
  const exact = TYPES_SOIN.find((t) => sansAccent(t.valeur) === cle)
  if (exact) return exact.valeur
  const prefixe = TYPES_SOIN.filter((t) => sansAccent(t.valeur).startsWith(cle))
  return prefixe.length === 1 ? prefixe[0].valeur : null
}

/**
 * Anciens codes en minuscules des écrans (tables locales retirées le
 * 2026-10-19) : seuls rattachements tolérés à la lecture en plus de la
 * correspondance exacte.
 */
const ANCIENS_CODES_TYPE_SOIN: Readonly<Record<string, string>> = {
  vaccination: 'Vaccination',
  vermifuge: 'Vermifuge',
  traitement: 'Traitement vétérinaire',
  autre: 'Autre',
}

/**
 * Clé d'un type de soin enregistré : la valeur de la liste qu'il désigne
 * exactement (casse et accents repliés) ou l'ancien code qu'il porte
 * (« vermifuge », « traitement »…), sinon la valeur saisie elle-même,
 * nettoyée. Vide → « Autre ».
 *
 * Pas de rattachement par préfixe à la lecture : dans un carnet réglementaire,
 * un « Prophylaxie » saisi librement ne doit pas devenir « Prophylaxie
 * obligatoire » (le préfixe ne sert qu'à la saisie, `normaliserTypeSoin`).
 *
 * QA 2026-10-19 — le carnet sanitaire de la Traçabilité comparait le type à
 * « vaccination » / « vermifuge » en minuscules alors que l'écran enregistre
 * « Vaccination » / « Vermifuge » : toutes les lignes s'affichaient « Autre »
 * et le filtre Vermifuge ne retrouvait rien. Écrans, résumé et filtre passent
 * désormais par cette clé et par `libelleTypeSoin`.
 */
export function cleTypeSoin(type: string | null | undefined): string {
  const brut = (type ?? '').trim()
  if (!brut) return 'Autre'
  const cle = sansAccent(brut)
  const exact = TYPES_SOIN.find((t) => sansAccent(t.valeur) === cle)
  if (exact) return exact.valeur
  return ANCIENS_CODES_TYPE_SOIN[cle] ?? brut
}

/**
 * Libellé affiché d'un type de soin. Une valeur hors liste s'affiche telle
 * qu'elle a été saisie : jamais de repli silencieux sur « Autre ».
 */
export function libelleTypeSoin(type: string | null | undefined): string {
  return cleTypeSoin(type)
}

/** Types proposés par un filtre : la liste de l'écran, puis les valeurs hors liste présentes. */
export function optionsFiltreTypeSoin(typesPresents: Iterable<string | null | undefined>): string[] {
  const liste = TYPES_SOIN.map((t) => t.valeur)
  const horsListe = new Set<string>()
  for (const type of typesPresents) {
    const cle = cleTypeSoin(type)
    if (!liste.includes(cle)) horsListe.add(cle)
  }
  return [...liste, ...[...horsListe].sort((a, b) => a.localeCompare(b, 'fr'))]
}
