/**
 * Sexe d'un animal : valeurs canoniques et normalisation.
 *
 * Module autonome (2026-08-07) parce que la normalisation doit s'appliquer AUSSI
 * à l'écriture par formulaire, donc au schéma zod `validations/elevage-animal` —
 * dont `elevage/import-animaux` dépend déjà, ce qui interdirait l'import inverse.
 *
 * Défaut mesuré sur un troupeau réel de 99 ovins : `normaliserSexe` n'existait
 * que sur le chemin CSV. `PATCH /api/elevage/animaux` écrivant le corps brut, un
 * `'f'` hérité repassait en base à chaque enregistrement de la fiche. Le
 * `<Select>` ne connaissant que les trois valeurs canoniques, il affichait son
 * placeholder : l'éleveur voyait un champ Sexe VIDE sur une brebis qui avait un
 * sexe, et l'animal disparaissait de la liste des mères à la déclaration d'une
 * naissance (comparaison `sexe === 'femelle'`). Une valeur non canonique est donc
 * invisible ET bloquante : ne jamais en laisser entrer.
 */

export const SEXES_ANIMAL = ['femelle', 'male', 'inconnu'] as const
export type SexeAnimal = (typeof SEXES_ANIMAL)[number]

const canon = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Valeur saisie → valeur du modèle.
 * `null` si vide, `undefined` si non reconnue (l'appelant décide de refuser).
 */
export function normaliserSexe(value: string): SexeAnimal | null | undefined {
  const k = canon(value)
  if (!k) return null
  if (['f', 'femelle', 'female'].includes(k)) return 'femelle'
  if (['m', 'male'].includes(k)) return 'male'
  if (['i', 'inconnu', 'nc'].includes(k)) return 'inconnu'
  return undefined
}

/**
 * Forme affichable d'une valeur déjà stockée, y compris héritée : rend la valeur
 * canonique si elle est reconnaissable, sinon la valeur brute pour ne rien
 * masquer à l'utilisateur.
 */
export function sexeAffichable(value: string | null | undefined): string {
  if (!value) return ''
  return normaliserSexe(value) ?? value
}
