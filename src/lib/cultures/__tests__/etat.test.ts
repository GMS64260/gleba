import { describe, expect, it } from 'vitest'
import { ETATS_CULTURE, estEtatCulture, etatCulture, whereEtatCulture } from '../etat'
import type { CultureAvancement } from '../etat'

/**
 * Le filtre SQL et la cascade d'affichage doivent rester le miroir l'un de
 * l'autre : c'est leur divergence qui a produit le ticket cmsp59tdu (des
 * cultures « En récolte » listées dans l'onglet « Planifiées »).
 */

/** Applique un `where` plat de `whereEtatCulture` à une culture en mémoire. */
function correspond(culture: CultureAvancement, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([champ, attendu]) => {
    const valeur = (culture as Record<string, unknown>)[champ] ?? null
    if (attendu !== null && typeof attendu === 'object' && 'not' in attendu) {
      return valeur !== (attendu as { not: unknown }).not
    }
    return valeur === attendu
  })
}

// Une culture représentative par état, du moins avancé au plus avancé.
const EXEMPLES: Record<string, CultureAvancement> = {
  'Planifiée': { semisFait: false, plantationFaite: false, recolteFaite: false, terminee: null },
  'Semée': { semisFait: true, plantationFaite: false, recolteFaite: false, terminee: null },
  'Plantée': { semisFait: true, plantationFaite: true, recolteFaite: false, terminee: null },
  'En récolte': { semisFait: true, plantationFaite: true, recolteFaite: true, terminee: null },
  'Terminée': { semisFait: true, plantationFaite: true, recolteFaite: true, terminee: 'x' },
}

describe('etatCulture / whereEtatCulture', () => {
  it.each(ETATS_CULTURE)('la culture-type de %s est bien classée par la cascade', (etat) => {
    expect(etatCulture(EXEMPLES[etat])).toBe(etat)
  })

  it.each(ETATS_CULTURE)('le filtre de %s ne retient que les cultures de cet état', (etat) => {
    const where = whereEtatCulture(etat) as Record<string, unknown>
    for (const [autreEtat, culture] of Object.entries(EXEMPLES)) {
      expect(correspond(culture, where)).toBe(autreEtat === etat)
    }
  })

  // Les deux cultures de la démo qui ont révélé le bug : récoltées sans que les
  // jalons amont soient enregistrés.
  it('une culture récoltée sans semis est « En récolte » et hors des planifiées', () => {
    const epinard: CultureAvancement = {
      semisFait: false,
      plantationFaite: false,
      recolteFaite: true,
      terminee: null,
    }
    expect(etatCulture(epinard)).toBe('En récolte')
    expect(correspond(epinard, whereEtatCulture('Planifiée') as Record<string, unknown>)).toBe(false)
    expect(correspond(epinard, whereEtatCulture('En récolte') as Record<string, unknown>)).toBe(true)
  })

  it('une culture plantée puis récoltée sans semis est « En récolte » et hors des semées', () => {
    const pommeDeTerre: CultureAvancement = {
      semisFait: false,
      plantationFaite: true,
      recolteFaite: true,
      terminee: null,
    }
    expect(etatCulture(pommeDeTerre)).toBe('En récolte')
    expect(correspond(pommeDeTerre, whereEtatCulture('Planifiée') as Record<string, unknown>)).toBe(false)
    expect(correspond(pommeDeTerre, whereEtatCulture('Semée') as Record<string, unknown>)).toBe(false)
  })

  it('estEtatCulture filtre les valeurs inconnues', () => {
    expect(estEtatCulture('Planifiée')).toBe(true)
    expect(estEtatCulture('planifiee')).toBe(false)
    expect(estEtatCulture(null)).toBe(false)
  })
})
