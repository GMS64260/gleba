import { describe, expect, it } from 'vitest'
import { FicheModifieeAilleurs, CHAMPS_HORS_FICHE, avecVersionSiFiche, controlerVersionFiche, ecrireFicheVersionnee, lireVersionLue, reponseFicheModifiee, versionFichePerimee } from './version-fiche'

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

describe('controlerVersionFiche et ecrireFicheVersionnee', () => {
  const base = (version: number | null) => {
    const requetes: Array<{ sql: string; valeurs: unknown[] }> = []
    const tx = {
      $queryRawUnsafe: async <T,>(sql: string, ...valeurs: unknown[]) => { requetes.push({ sql, valeurs }); return (version === null ? [] : [{ version }]) as T },
    }
    const client = { ...tx, transactions: 0, $transaction: async <R,>(action: (t: typeof tx) => Promise<R>) => { client.transactions++; return action(tx) } }
    return { tx, client, requetes }
  }

  it('verrouille la ligne et laisse passer la version lue', async () => {
    const { tx, requetes } = base(4)
    await expect(controlerVersionFiche(tx, 'itps', 'itp-1', 4, 'Itinéraire')).resolves.toBeUndefined()
    expect(requetes).toEqual([{ sql: 'SELECT "version" FROM "itps" WHERE "id" = $1 FOR UPDATE', valeurs: ['itp-1'] }])
  })

  it('refuse une version qui a avancé, ou une fiche disparue', async () => {
    await expect(controlerVersionFiche(base(5).tx, 'itps', 'itp-1', 4, 'Itinéraire')).rejects.toMatchObject({ versionActuelle: 5 })
    await expect(controlerVersionFiche(base(null).tx, 'itps', 'itp-1', 4, 'Itinéraire')).rejects.toBeInstanceOf(FicheModifieeAilleurs)
  })

  it('sans version lue, ne verrouille rien et écrit directement', async () => {
    const { client, requetes } = base(9)
    const ecrit = await ecrireFicheVersionnee(client, 'itps', 'itp-1', undefined, 'Itinéraire', async () => 'écrit')
    expect(ecrit).toBe('écrit')
    expect(requetes).toHaveLength(0)
    expect(client.transactions).toBe(0)
  })

  it('avec une version lue, contrôle puis écrit dans la même transaction, et n’écrit pas sur un refus', async () => {
    const bon = base(2)
    expect(await ecrireFicheVersionnee(bon.client, 'itps', 'itp-1', 2, 'Itinéraire', async () => 'écrit')).toBe('écrit')
    expect(bon.client.transactions).toBe(1)
    const perime = base(3)
    let ecritures = 0
    await expect(ecrireFicheVersionnee(perime.client, 'itps', 'itp-1', 2, 'Itinéraire', async () => { ecritures++ })).rejects.toBeInstanceOf(FicheModifieeAilleurs)
    expect(ecritures).toBe(0)
  })
})
