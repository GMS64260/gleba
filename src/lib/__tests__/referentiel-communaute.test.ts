import { describe, expect, it } from 'vitest'
import {
  PROPRIETAIRE_COMMUNAUTE,
  estVisibleReferentiel,
  masquerEntree,
  masquerProprietaire,
  origineReferentiel,
  visibiliteReferentiel,
  whereReferentielCible,
} from '@/lib/referentiel-communaute'
import { AUTRE, MOI, correspond, jeuReferentiel } from './fixtures/referentiel-memoire'

const jeu = jeuReferentiel((id, nom) => ({ id, nom }))
const lignes = Object.values(jeu)

describe('isolation des référentiels communautaires (revue 2026-10-20)', () => {
  it("masquerProprietaire : null pour Gleba, l'id du compte courant, sinon le marqueur", () => {
    expect(masquerProprietaire(null, MOI)).toBeNull()
    expect(masquerProprietaire(MOI, MOI)).toBe(MOI)
    expect(masquerProprietaire(AUTRE, MOI)).toBe(PROPRIETAIRE_COMMUNAUTE)
  })

  it("le marqueur garde l'origine lue par les écrans (Gleba / perso / communauté)", () => {
    const masquees = lignes.map((l) => masquerEntree(l, MOI))
    expect(masquees.map((l) => origineReferentiel(l, MOI))).toEqual(
      lignes.map((l) => origineReferentiel(l, MOI)),
    )
    expect(JSON.stringify(masquees)).not.toContain(AUTRE)
  })

  it('masquerEntree laisse intacte une entrée sans userId sélectionné', () => {
    const sansAuteur = { id: 'x', nom: 'X' }
    expect(masquerEntree(sansAuteur, MOI)).toBe(sansAuteur)
  })

  it('estVisibleReferentiel est le miroir exact de visibiliteReferentiel', () => {
    for (const ligne of lignes) {
      expect(estVisibleReferentiel(ligne, MOI)).toBe(correspond(ligne, visibiliteReferentiel(MOI)))
    }
    expect(lignes.filter((l) => estVisibleReferentiel(l, MOI)).map((l) => l.id)).toEqual([
      'gleba-1',
      'cm-moi',
      'cm-partagee',
    ])
  })

  it("whereReferentielCible : un membre n'atteint pas l'entrée privée d'un autre compte", () => {
    const cible = (id: string) => lignes.filter((l) => correspond(l, whereReferentielCible(id, MOI, false)))
    expect(cible('cm-privee')).toEqual([])
    expect(cible('cm-moi')).toHaveLength(1)
    expect(cible('cm-partagee')).toHaveLength(1)
    expect(cible('gleba-1')).toHaveLength(1)
  })

  it('whereReferentielCible : un admin atteint toute entrée (modération)', () => {
    const cible = lignes.filter((l) => correspond(l, whereReferentielCible('cm-privee', 'admin', true)))
    expect(cible.map((l) => l.id)).toEqual(['cm-privee'])
  })
})
