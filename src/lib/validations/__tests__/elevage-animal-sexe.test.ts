import { describe, expect, it } from 'vitest'
import { animalSchema } from '../elevage-animal'
import { normaliserSexe, sexeAffichable } from '@/lib/elevage/sexe'

const base = { especeAnimaleId: 'ovin' }

/**
 * Cas réel du 2026-08-07 : un `'f'` hérité d'un import restait en base parce que
 * la normalisation n'existait que sur le chemin CSV. Le `<Select>` de la fiche ne
 * connaissant que les valeurs canoniques, le champ paraissait VIDE et
 * l'enregistrement réécrivait `'f'` ; l'animal disparaissait alors de la liste des
 * mères, comparée par `sexe === 'femelle'`.
 */
describe('normalisation du sexe à l\'écriture', () => {
  it('canonise les valeurs abrégées', () => {
    expect(animalSchema.parse({ ...base, sexe: 'f' }).sexe).toBe('femelle')
    expect(animalSchema.parse({ ...base, sexe: 'M' }).sexe).toBe('male')
    expect(animalSchema.parse({ ...base, sexe: 'Mâle' }).sexe).toBe('male')
    expect(animalSchema.parse({ ...base, sexe: 'femelle' }).sexe).toBe('femelle')
  })

  it('traite le vide comme une absence de sexe', () => {
    expect(animalSchema.parse({ ...base, sexe: '' }).sexe).toBeNull()
    expect(animalSchema.parse({ ...base, sexe: null }).sexe).toBeNull()
    expect(animalSchema.parse({ ...base }).sexe).toBeUndefined()
  })

  it('refuse une valeur non reconnue plutôt que de la persister', () => {
    const resultat = animalSchema.safeParse({ ...base, sexe: 'xy' })
    expect(resultat.success).toBe(false)
    if (!resultat.success) {
      expect(resultat.error.issues[0].message).toContain('non reconnu')
    }
  })

  it('rend affichable une valeur héritée sans la masquer', () => {
    expect(sexeAffichable('f')).toBe('femelle')
    expect(sexeAffichable(null)).toBe('')
    // Une valeur vraiment inconnue reste visible : ne jamais faire disparaître
    // une donnée que l'utilisateur a saisie.
    expect(sexeAffichable('hermaphrodite')).toBe('hermaphrodite')
    expect(normaliserSexe('hermaphrodite')).toBeUndefined()
  })
})
