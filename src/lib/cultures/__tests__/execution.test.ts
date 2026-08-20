import { describe, expect, it } from 'vitest'
import {
  CHAMP_DATE_ETAPE,
  CHAMP_PLAN_ETAPE,
  ETAPES,
  dateExecutionARecaler,
  ecrituresDatePlanRedefinie,
  ecrituresPassageAFait,
  ecrituresRetourANonFait,
} from '../execution'

/**
 * Ticket cmsp66tdm : une étape marquée faite ne doit pas rester datée dans le
 * futur. Les dates de culture sont stockées avec une heure, donc la comparaison
 * doit se faire en journées civiles locales — sinon une date du jour stockée à
 * 00:00 se ferait recaler à tort.
 */
describe('dateExecutionARecaler', () => {
  const maintenant = new Date(2026, 7, 11, 14, 30) // 11/08/2026 14:30 local

  it('recale une date planifiée dans le futur sur le jour courant', () => {
    const recalage = dateExecutionARecaler(new Date(2026, 7, 15, 8, 0), maintenant)
    expect(recalage).toEqual(maintenant)
  })

  it('ne touche pas une date passée (le retard reste tracé tel quel)', () => {
    expect(dateExecutionARecaler(new Date(2026, 6, 31, 8, 0), maintenant)).toBeNull()
  })

  it('ne touche pas une date du jour, quelle que soit son heure', () => {
    expect(dateExecutionARecaler(new Date(2026, 7, 11, 0, 0), maintenant)).toBeNull()
    expect(dateExecutionARecaler(new Date(2026, 7, 11, 23, 59), maintenant)).toBeNull()
  })

  it('recale dès le lendemain civil, même à une heure antérieure', () => {
    expect(dateExecutionARecaler(new Date(2026, 7, 12, 0, 1), maintenant)).toEqual(maintenant)
  })

  it('date absente : la date d’exécution est le jour courant', () => {
    expect(dateExecutionARecaler(null, maintenant)).toEqual(maintenant)
    expect(dateExecutionARecaler(undefined, maintenant)).toEqual(maintenant)
  })

  it('chaque jalon porte son champ de date', () => {
    expect(CHAMP_DATE_ETAPE).toEqual({
      semisFait: 'dateSemis',
      plantationFaite: 'datePlantation',
      recolteFaite: 'dateRecolte',
    })
  })
})

/**
 * Friction 2026-08-20 : cocher puis décocher une étape détruisait la date du
 * plan. Le scénario vécu est le premier test — une culture de fleurs planifiée
 * pour l'année suivante, cochée par erreur puis décochée.
 */
describe('mémoire de la date de plan', () => {
  const maintenant = new Date(2026, 7, 20, 13, 27, 55) // 20/08/2026, l'heure du clic

  it('rend la date de plan quand l’étape est décochée (cas vécu)', () => {
    const culture = {
      dateSemis: new Date(2027, 2, 12),
      dateSemisPlan: null,
    }
    const aFait = ecrituresPassageAFait(culture, 'semisFait', maintenant)
    expect(aFait).toEqual({
      dateSemis: maintenant,
      dateSemisPlan: new Date(2027, 2, 12),
    })

    const apresFait = { ...culture, ...aFait }
    expect(ecrituresRetourANonFait(apresFait, 'semisFait')).toEqual({
      dateSemis: new Date(2027, 2, 12),
      dateSemisPlan: null,
    })
  })

  it('ne mémorise qu’une fois : un aller-retour répété ne fait pas fondre le plan', () => {
    const plan = new Date(2027, 2, 12)
    let culture: Record<string, Date | null> = { dateSemis: plan, dateSemisPlan: null }
    for (let cycle = 0; cycle < 3; cycle++) {
      culture = { ...culture, ...ecrituresPassageAFait(culture, 'semisFait', maintenant) }
      culture = { ...culture, ...ecrituresRetourANonFait(culture, 'semisFait') }
    }
    expect(culture.dateSemis).toEqual(plan)
    expect(culture.dateSemisPlan).toBeNull()
  })

  it('rien à mémoriser quand la date planifiée est déjà passée', () => {
    const culture = { dateSemis: new Date(2026, 6, 31), dateSemisPlan: null }
    expect(ecrituresPassageAFait(culture, 'semisFait', maintenant)).toEqual({})
    expect(ecrituresRetourANonFait(culture, 'semisFait')).toEqual({})
  })

  it('étape sans date planifiée : la date d’exécution est écrite, rien n’est mémorisé', () => {
    const culture = { dateSemis: null, dateSemisPlan: null }
    expect(ecrituresPassageAFait(culture, 'semisFait', maintenant)).toEqual({
      dateSemis: maintenant,
    })
  })

  it('ne devine aucune date quand aucun plan n’a été mémorisé', () => {
    const heritee = { dateRecolte: new Date(2026, 7, 20), dateRecoltePlan: null }
    expect(ecrituresRetourANonFait(heritee, 'recolteFaite')).toEqual({})
  })

  it('une date fournie explicitement libère la mémoire', () => {
    expect(ecrituresDatePlanRedefinie('plantationFaite')).toEqual({
      datePlantationPlan: null,
    })
  })

  it('chaque jalon porte son champ de mémoire', () => {
    expect(CHAMP_PLAN_ETAPE).toEqual({
      semisFait: 'dateSemisPlan',
      plantationFaite: 'datePlantationPlan',
      recolteFaite: 'dateRecoltePlan',
    })
    expect(ETAPES).toEqual(['semisFait', 'plantationFaite', 'recolteFaite'])
  })
})
