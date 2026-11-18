import { describe, expect, it } from 'vitest'
import { CONTEXTE_FISCAL_VENTE_DISPONIBLE, SELECT_CONTEXTE_FISCAL_VENTE, monnaieVente, monnaieCommande } from '../devise-vente'

const contexte = (devise: string) => ({ version: 1, regimeTva: 'tgc', territoire: 'NOUVELLE_CALEDONIE', devise, date: '2026-07-01T10:00:00.000Z' })

describe('devise d’une vente manuelle (module public)', () => {
  it('une vente sans contexte figé suit la devise courante, même si la colonne est absente de la ligne', () => {
    expect(monnaieVente({ contexteFiscal: null }, 'XPF')).toBe('XPF')
    expect(monnaieVente({}, 'EUR')).toBe('EUR')
    expect(monnaieVente({ contexteFiscal: undefined }, null)).toBeNull()
  })
  it('un contexte figé lisible impose sa devise, pas la devise courante', () => {
    expect(monnaieVente({ contexteFiscal: contexte('XPF') }, 'EUR')).toBe('XPF')
    expect(monnaieVente({ contexteFiscal: contexte('EUR') }, 'XPF')).toBe('EUR')
  })
  it('un contexte présent mais illisible rend une devise inconnue, jamais la devise courante', () => {
    for (const illisible of [{ version: 1, devise: 'EUR' }, { ...contexte('EUR'), territoire: 'INCONNU' }, { ...contexte('EUR'), date: 'invalide' }, { ...contexte('EUR'), regimeTva: 'inconnu' }, { ...contexte('EUR'), champInconnu: true }, { version: 9 }, contexte('USD'), { ...contexte('EUR'), version: 2 }, 'XPF', 12, ['EUR'], {}])
      expect(monnaieVente({ contexteFiscal: illisible }, 'EUR')).toBeNull()
  })
  it('le fragment de select ne charge la colonne que si le client Prisma la connaît', () => {
    expect(SELECT_CONTEXTE_FISCAL_VENTE).toEqual(CONTEXTE_FISCAL_VENTE_DISPONIBLE ? { contexteFiscal: true } : {})
  })
})


describe('devise des commandes en attente', () => {
  it('garde la devise figée malgré un profil courant différent', () => {
    expect(monnaieCommande({ fiscaliteSnapshot: { ...contexte('EUR'), lignes: [] } }, 'XPF')).toBe('EUR')
  })
  it('distingue contexte absent et contexte illisible', () => {
    expect(monnaieCommande({}, 'XPF')).toBe('XPF')
    for (const snapshot of [{}, [], 'EUR', contexte('USD')]) {
      expect(monnaieCommande({ fiscaliteSnapshot: snapshot }, 'XPF')).toBeNull()
    }
  })
})
