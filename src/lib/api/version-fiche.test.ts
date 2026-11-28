import { describe, expect, it } from 'vitest'
import { FicheModifieeAilleurs, CHAMPS_HORS_FICHE, avecVersionSiFiche, lireVersionLue, reponseFicheModifiee, versionFichePerimee } from './version-fiche'

describe('lireVersionLue', () => {
  it('lit un entier, la sentinelle de création et l’absence', () => {
    expect(lireVersionLue({ versionLue: 3 })).toEqual({ ok: true, version: 3 })
    expect(lireVersionLue({ versionLue: 0 })).toEqual({ ok: true, version: 0 })
    expect(lireVersionLue({ versionLue: 'aucune' })).toEqual({ ok: true, version: 'aucune' })
    expect(lireVersionLue({})).toEqual({ ok: true, version: undefined })
    expect(lireVersionLue(null)).toEqual({ ok: true, version: undefined })
  })

  it('rend à part la date de l’ancien protocole', () => {
    expect(lireVersionLue({ versionLue: '2026-11-27T10:00:00.000Z' })).toEqual({
      ok: true, version: undefined, ancienneDate: '2026-11-27T10:00:00.000Z',
    })
  })

  it('refuse ce qui n’est ni l’un ni l’autre, sans l’ignorer', () => {
    for (const versionLue of [-1, 1.5, '3', 'n’importe quoi', {}, true]) {
      expect(lireVersionLue({ versionLue }).ok).toBe(false)
    }
  })
})

describe('versionFichePerimee', () => {
  it('ne contrôle rien pour un appelant qui n’envoie pas de version', () => {
    expect(versionFichePerimee(undefined, { version: 7 })).toBe(false)
    expect(versionFichePerimee(undefined, null)).toBe(false)
  })

  it('compare la version lue à celle de la base', () => {
    expect(versionFichePerimee(7, { version: 7 })).toBe(false)
    expect(versionFichePerimee(6, { version: 7 })).toBe(true)
    expect(versionFichePerimee(6, null)).toBe(true)
  })

  it('« aucune » : périmée dès qu’une fiche existe', () => {
    expect(versionFichePerimee('aucune', null)).toBe(false)
    expect(versionFichePerimee('aucune', { version: 0 })).toBe(true)
  })
})

describe('refus', () => {
  it('répond 409 avec le code commun et la version actuelle', async () => {
    const reponse = reponseFicheModifiee('Culture', 8)
    expect(reponse.status).toBe(409)
    expect(await reponse.json()).toMatchObject({ code: 'MODIFIE_AILLEURS', versionActuelle: 8, error: expect.stringContaining('Rien n\'a été enregistré') })
    expect(new FicheModifieeAilleurs('Culture', 8).reponse().status).toBe(409)
  })
})

describe('avecVersionSiFiche', () => {
  it('fait avancer la version quand un champ de la fiche est écrit', () => {
    expect(avecVersionSiFiche({ notes: 'x', derniereIrrigation: new Date() }, CHAMPS_HORS_FICHE.culture)).toMatchObject({ version: { increment: 1 } })
    expect(avecVersionSiFiche({ quantite: 4, statut: 'vendu' }, CHAMPS_HORS_FICHE.recolte)).toMatchObject({ version: { increment: 1 } })
  })
  it('ne la touche pas pour un arrosage noté, l’interrupteur « à irriguer » ou une vente totale', () => {
    expect(avecVersionSiFiche({ derniereIrrigation: new Date() }, CHAMPS_HORS_FICHE.culture)).not.toHaveProperty('version')
    expect(avecVersionSiFiche({ aIrriguer: true }, CHAMPS_HORS_FICHE.culture)).not.toHaveProperty('version')
    expect(avecVersionSiFiche({ statut: 'vendu', dateVente: new Date(), prixTotal: 12, clientNom: 'AMAP' }, CHAMPS_HORS_FICHE.recolte)).not.toHaveProperty('version')
  })
  it('ignore un champ de la fiche laissé à undefined', () => {
    expect(avecVersionSiFiche({ aIrriguer: false, notes: undefined }, CHAMPS_HORS_FICHE.culture)).not.toHaveProperty('version')
  })
})
