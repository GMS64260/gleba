import { describe, expect, it } from 'vitest'

import { estConflitPeriodeItp, estViolationUnicite } from '@/lib/itp-nom'
import { messageIncoherenceSemainesItp, messageRefusTriggerDatesItp } from '@/lib/validations/itp'

const p2002 = (target: unknown) => ({ code: 'P2002', meta: { target } })

describe('estConflitPeriodeItp — formes de `meta.target`', () => {
  it('reconnaît les fragments de colonnes rendus pour un index sur expressions', () => {
    // PostgreSQL : « Key (COALESCE(user_id, '<officiel>'::text), espece,
    // COALESCE(s_semis, '-1'::integer), … )=(…) already exists », découpé sur « , ».
    expect(
      estConflitPeriodeItp(
        p2002([
          'COALESCE(user_id',
          "'<officiel>'::text)",
          'espece',
          'COALESCE(s_semis',
          "'-1'::integer)",
          'COALESCE(s_plantation',
          "'-1'::integer)",
          'COALESCE(s_recolte',
          "'-1'::integer)",
          'COALESCE(type_planche',
          "'<vide>'::text)",
        ])
      )
    ).toBe(true)
  })

  it('reconnaît le nom de l’index, en chaîne ou en tableau', () => {
    expect(estConflitPeriodeItp(p2002('itps_periode_unique_idx'))).toBe(true)
    expect(estConflitPeriodeItp(p2002(['itps_periode_unique_idx']))).toBe(true)
  })

  it('reconnaît les champs du modèle Prisma', () => {
    expect(
      estConflitPeriodeItp(p2002(['userId', 'especeId', 'semaineSemis', 'semainePlantation', 'semaineRecolte']))
    ).toBe(true)
  })

  it('écarte les autres index uniques de la table', () => {
    expect(estConflitPeriodeItp(p2002(['user_id', 'nom_normalise']))).toBe(false)
    expect(estConflitPeriodeItp(p2002(['source_record_id']))).toBe(false)
    expect(estConflitPeriodeItp(p2002(['it_plante']))).toBe(false)
    expect(estConflitPeriodeItp(p2002('itps_user_nomnorm_perso_key'))).toBe(false)
  })

  it('ne tranche pas une cible illisible, que la route résout par la recherche du jumeau', () => {
    expect(estConflitPeriodeItp(p2002('(not available)'))).toBe(false)
    expect(estConflitPeriodeItp(p2002(undefined))).toBe(false)
    expect(estViolationUnicite(p2002(undefined))).toBe(true)
    expect(estViolationUnicite({ code: 'P2025' })).toBe(false)
    expect(estViolationUnicite(null)).toBe(false)
  })
})

describe('messageIncoherenceSemainesItp — miroir du trigger enforce_itp_dates', () => {
  it('refuse une récolte à moins de 4 semaines du semis, y compris à cheval sur l’année', () => {
    expect(messageIncoherenceSemainesItp({ semaineSemis: 10, semaineRecolte: 13 })).toMatch(/4 semaines/)
    expect(messageIncoherenceSemainesItp({ semaineSemis: 10, semaineRecolte: 14 })).toBeNull()
    expect(messageIncoherenceSemainesItp({ semaineSemis: 51, semaineRecolte: 2 })).toMatch(/4 semaines/)
    expect(messageIncoherenceSemainesItp({ semaineSemis: 51, semaineRecolte: 3 })).toBeNull()
    // Même semaine : écart nul selon le trigger (il ne lit pas « un an après »).
    expect(messageIncoherenceSemainesItp({ semaineSemis: 20, semaineRecolte: 20 })).toMatch(/4 semaines/)
  })

  it('n’exige une plantation après le semis que pour une espèce de pépinière', () => {
    const memeSemaine = { semaineSemis: 10, semainePlantation: 10 }
    expect(
      messageIncoherenceSemainesItp({ ...memeSemaine, typeCultureSemis: 'pepiniere_puis_repiquage' })
    ).toMatch(/plantation/i)
    expect(messageIncoherenceSemainesItp({ ...memeSemaine, typeCultureSemis: 'semis_direct' })).toBeNull()
    expect(messageIncoherenceSemainesItp({ ...memeSemaine, typeCultureSemis: null })).toBeNull()
    expect(
      messageIncoherenceSemainesItp({
        semaineSemis: 10,
        semainePlantation: 11,
        typeCultureSemis: 'pepiniere_puis_repiquage',
      })
    ).toBeNull()
  })

  it('ne dit rien sans semaine de semis', () => {
    expect(messageIncoherenceSemainesItp({ semainePlantation: 10, semaineRecolte: 11 })).toBeNull()
  })
})

describe('messageRefusTriggerDatesItp', () => {
  it('retrouve les deux refus du trigger et ignore le reste', () => {
    expect(
      messageRefusTriggerDatesItp(new Error('ITP x: récolte S12 trop proche du semis S10 (< 4 semaines)'))
    ).toMatch(/4 semaines/)
    expect(
      messageRefusTriggerDatesItp(new Error('ITP x: plantation S7 doit suivre le semis S7 (au moins 1 semaine)'))
    ).toMatch(/plantation/i)
    expect(messageRefusTriggerDatesItp(new Error('connection reset'))).toBeNull()
    expect(messageRefusTriggerDatesItp(null)).toBeNull()
  })
})
