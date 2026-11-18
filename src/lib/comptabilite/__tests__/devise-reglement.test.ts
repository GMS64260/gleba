import { describe, expect, it } from 'vitest'
import { monnaieFacture } from '@/lib/comptabilite/devise-reglement'

describe('monnaieFacture — identité figée et introduction de XPF dans Gleba', () => {
  it.each([
    [{ devise: 'EUR' }, 'EUR'],
    [{ devise: 'XPF', territoire: '' }, 'XPF'],
    [{ territoire: 'METROPOLE' }, 'EUR'],
    [{ territoire: 'NOUVELLE_CALEDONIE' }, 'XPF'],
    [{ territoire: 'POLYNESIE' }, 'XPF'],
  ])('respecte la devise figée de %o indépendamment de la date', (snapshot, attendue) => {
    for (const date of [undefined, '2026-06-28', '2026-06-29', '2026-11-15'])
      expect(monnaieFacture(snapshot, date)).toBe(attendue)
  })

  it.each([null, {}, { raisonSociale: 'Ferme fictive' }, { devise: null, territoire: null }, { territoire: '' }])(
    'sans devise ni territoire (%o), utilise EUR avant le 29 juin uniquement', snapshot => {
      expect(monnaieFacture(snapshot, '2026-06-28')).toBe('EUR')
      expect(monnaieFacture(snapshot, new Date('2026-06-28T23:59:59.999Z'))).toBe('EUR')
      expect(monnaieFacture(snapshot, '2026-06-29T00:00:00Z')).toBeNull()
      expect(monnaieFacture(snapshot, '2026-11-15')).toBeNull()
      expect(monnaieFacture(snapshot)).toBeNull()
      expect(monnaieFacture(snapshot, null)).toBeNull()
      expect(monnaieFacture(snapshot, 'date invalide')).toBeNull()
    },
  )

  it.each([
    'EUR', [{ devise: 'EUR' }], { territoire: 'INCONNU' },
    { territoire: 'toString' }, { territoire: 42 },
    { devise: 'eur', territoire: '' }, { devise: 'USD', territoire: 'METROPOLE' },
  ])('ne réinterprète pas une identité invalide même ancienne (%o)', snapshot => {
    expect(monnaieFacture(snapshot, '2026-06-28')).toBeNull()
    expect(monnaieFacture(snapshot, '2026-06-29')).toBeNull()
  })
})
