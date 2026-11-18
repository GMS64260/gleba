/**
 * Contre-revue ADV33 (PR #73) — une vivace évaluée (créée, reportée, marquée
 * faite) occupe la planche à partir de son début, sans fin de cycle, comme ses
 * voisines vivaces. Preuve PostgreSQL par les routes :
 * src/app/api/cultures/occupation-chemins.postgres.test.ts.
 */
import { describe, expect, it } from 'vitest'

import { chevauchePeriodeOuverte } from '../cultures/fenetre-recolte'
import { evaluerModificationOccupation, evaluerOccupationPlanche } from '../planche-validation'

const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const PLANCHE = { largeur: 0.8, longueur: 20 }
const voisine = (debut: string, fin: string | null, vivace = false, nbRangs = 3) => ({
  id: 1, espece: { id: 'e', vivace }, dateSemis: jour(debut), datePlantation: null,
  dateRecolte: fin ? jour(fin) : null, finRecolte: null, nbRangs, longueur: 20, itp: { espacementRangs: 25 },
})
const etat = (debut: string, fin: string, vivace: boolean) => ({
  espacementRangs: 25, nbRangs: 3, longueur: 20, debut: jour(debut), fin: jour(fin), vivace,
})

describe('chevauchePeriodeOuverte', () => {
  it('une annuelle chevauche tant que son cycle finit après le début', () => {
    expect(chevauchePeriodeOuverte(voisine('2027-06-01', '2027-08-01'), jour('2027-01-01'))).toBe(true)
    expect(chevauchePeriodeOuverte(voisine('2027-06-01', '2027-08-01'), jour('2027-09-01'))).toBe(false)
  })
  it('une vivace en place chevauche toujours ; sans dates, pas de conclusion', () => {
    expect(chevauchePeriodeOuverte(voisine('2030-01-01', null, true), jour('2027-01-01'))).toBe(true)
    expect(chevauchePeriodeOuverte(voisine('2027-06-01', null), jour('2027-01-01'))).toBeNull()
    expect(chevauchePeriodeOuverte({ ...voisine('2027-06-01', '2027-08-01'), dateSemis: null }, jour('2027-01-01'))).toBeNull()
  })
})

describe('evaluerOccupationPlanche pour une vivace', () => {
  const verdict = (vivace: boolean) => evaluerOccupationPlanche({ planche: PLANCHE,
    culturesEnPlace: [voisine('2027-06-01', '2027-08-01')], espacementRangs: 25, nbRangs: 3, longueur: 20,
    debut: jour('2027-01-01'), fin: jour('2027-01-31'), vivace })
  it("ignore la fin de fenêtre : la vivace de janvier gêne l'annuelle de l'été", () => {
    expect(verdict(false).possible).toBe(true)
    expect(verdict(true).possible).toBe(false)
  })
})

describe('evaluerModificationOccupation : la vivace avant et après', () => {
  const autresCultures = [voisine('2027-06-01', '2027-08-01')]
  it('refuse le report qui fait arriver la vivace avant une annuelle de la planche (sonde 1)', () => {
    expect(evaluerModificationOccupation({ planche: PLANCHE, autresCultures,
      avant: etat('2027-09-01', '2027-10-01', true), apres: etat('2027-01-01', '2027-01-31', true) })).not.toBeNull()
  })
  it('accepte le report non aggravant d’une vivace déjà en dépassement (sonde 2)', () => {
    expect(evaluerModificationOccupation({ planche: PLANCHE, autresCultures,
      avant: etat('2027-01-01', '2027-02-01', true), apres: etat('2027-05-15', '2027-06-15', true) })).toBeNull()
  })
})

/**
 * Contre-revue ADV39 — des voisines qui se succèdent sans se croiser ne sont
 * pas additionnées : la capacité se juge tranche de temps par tranche de temps.
 * Planche 0,80 m (0,60 m utiles) ; cible et voisines à 2 rangs de 25 cm = 0,25 m.
 */
describe('evaluerOccupationPlanche : voisines successives ou simultanées', () => {
  const v2 = (debut: string, fin: string | null, vivace = false) => voisine(debut, fin, vivace, 2)
  const verdict = (culturesEnPlace: ReturnType<typeof v2>[], vivace: boolean, debut = '2027-01-01', fin = '2027-12-31') =>
    evaluerOccupationPlanche({ planche: PLANCHE, culturesEnPlace, espacementRangs: 25, nbRangs: 2, longueur: 20,
      debut: jour(debut), fin: jour(fin), vivace })
  const successives = [v2('2027-03-01', '2027-04-01'), v2('2027-06-01', '2027-08-01')]
  const simultanees = [v2('2027-03-01', '2027-08-01'), v2('2027-06-01', '2027-09-01')]

  it('vivace face à deux annuelles successives (témoin ADV39) : acceptée, une seule voisine à la fois', () => {
    const v = verdict(successives, true)
    expect(v.verifie && v.possible).toBe(true)
    expect(v.verifie && v.largeurOccupee).toBeCloseTo(0.25)
  })
  it('vivace face aux mêmes annuelles simultanées (juin-août) : refusée', () => {
    const v = verdict(simultanees, true)
    expect(v.verifie && v.possible).toBe(false)
    expect(v.verifie && v.largeurOccupee).toBeCloseTo(0.5)
    expect(v.verifie && v.message).toMatch(/^Largeur insuffisante/)
  })
  it('même règle pour une annuelle qui couvre les deux voisines successives', () => {
    expect(verdict(successives, false).possible).toBe(true)
    expect(verdict(simultanees, false).possible).toBe(false)
  })
  it('une voisine arrivée avant la période et toujours en place compte avec celle qui arrive ensuite', () => {
    expect(verdict([v2('2026-11-01', '2027-07-01'), v2('2027-06-01', '2027-08-01')], true).possible).toBe(false)
  })
  it('une vivace voisine est présente à toute tranche postérieure à son arrivée', () => {
    expect(verdict([v2('2027-02-01', null, true), v2('2027-06-01', '2027-08-01')], true).possible).toBe(false)
    expect(verdict([v2('2027-09-01', null, true), v2('2027-06-01', '2027-08-01')], true).possible).toBe(true)
  })
  it('prudence : une voisine aux dates inconnues est présente dans chaque tranche', () => {
    const inconnue = { ...v2('2027-03-01', '2027-04-01'), dateSemis: null }
    expect(verdict([inconnue, v2('2027-06-01', '2027-08-01')], true).possible).toBe(false)
  })
  it('prudence : une annuelle évaluée sans fin de cycle additionne toutes ses voisines', () => {
    const v = evaluerOccupationPlanche({ planche: PLANCHE, culturesEnPlace: successives, espacementRangs: 25,
      nbRangs: 2, longueur: 20, debut: jour('2027-01-01'), fin: null })
    expect(v.possible).toBe(false)
  })
  it('les deux voisines qui se touchent sans se croiser (fin = arrivée) ne sont pas simultanées', () => {
    expect(verdict([v2('2027-03-01', '2027-06-01'), v2('2027-06-01', '2027-08-01')], true).possible).toBe(true)
  })
  it('modification : le report de la vivace sur des annuelles successives est accepté', () => {
    expect(evaluerModificationOccupation({ planche: PLANCHE, autresCultures: successives,
      avant: { ...etat('2027-09-01', '2027-10-01', true), nbRangs: 2 },
      apres: { ...etat('2027-01-01', '2027-01-31', true), nbRangs: 2 } })).toBeNull()
  })

  it('modification : un nouveau dépassement dans une autre tranche aggrave, même à largeur maximale égale', () => {
    // Avant (vivace de septembre) : dépassement hérité avec l'annuelle d'octobre.
    // Après (vivace de janvier) : s'y ajoute un dépassement avec celle de mars,
    // tranche différente et de même largeur : la largeur maximale ne bouge pas.
    const voisines = [voisine('2027-03-01', '2027-04-01'), voisine('2027-10-01', '2027-11-01')]
    const refus = evaluerModificationOccupation({ planche: PLANCHE, autresCultures: voisines,
      avant: etat('2027-09-01', '2027-09-30', true), apres: etat('2027-01-01', '2027-01-31', true) })
    expect(refus).not.toBeNull()
    expect(evaluerModificationOccupation({ planche: PLANCHE, autresCultures: voisines,
      avant: etat('2027-09-01', '2027-09-30', true), apres: etat('2027-08-01', '2027-08-31', true) })).toBeNull()
  })
})

/**
 * Contre-revues ADV106 / QA105 — la non-aggravation se juge tranche par
 * tranche, sur les voisines qui prennent réellement de la largeur.
 * Planche de 20 m ; vivace de 10 m à 3 rangs (0,50 m).
 */
describe('evaluerModificationOccupation : tranche par tranche, contributions effectives', () => {
  const v = (debut: string, fin: string, nbRangs: number, longueur: number) =>
    ({ ...voisine(debut, fin, false, nbRangs), longueur })
  const vivace = (debut: string, longueur: number) =>
    ({ espacementRangs: 25, nbRangs: 3, longueur, debut: jour(debut), fin: jour('2027-12-31'), vivace: true })

  it('une tranche aggravée sous le maximum d’une autre tranche est refusée (agrandissement)', () => {
    // Mars : 0,25 m pleine longueur + partielle de 10 m (bout à bout à 10 m,
    // plus à 15 m) ; juin-août : 0,50 m, dépassement hérité.
    const autresCultures = [v('2027-03-01', '2027-04-01', 2, 20), v('2027-03-01', '2027-04-01', 2, 10),
      v('2027-06-01', '2027-08-01', 3, 20)]
    const modifier = (longueur: number) => evaluerModificationOccupation({ planche: PLANCHE, autresCultures,
      avant: vivace('2027-01-01', 10), apres: vivace('2027-01-01', longueur) })
    expect(modifier(15)).toMatchObject({ verifie: true, possible: false, largeurOccupee: 0.5 })
    expect(modifier(10)).toBeNull()
    expect(modifier(8)).toBeNull()
  })

  it('une nouvelle partielle logée bout à bout n’est pas un conflit (report)', () => {
    const pleine = v('2027-06-01', '2027-08-01', 3, 20)
    const partielle = v('2027-03-01', '2027-07-01', 3, 10)
    const modifier = (autresCultures: ReturnType<typeof v>[]) => evaluerModificationOccupation({ planche: PLANCHE,
      autresCultures, avant: vivace('2027-07-15', 10), apres: vivace('2027-05-15', 10) })
    expect(modifier([pleine, partielle])).toBeNull()
    expect(modifier([pleine])).toBeNull()
    // La même partielle, rendue pleine longueur, prend de la largeur : refus.
    expect(modifier([pleine, { ...partielle, longueur: 20 }])).not.toBeNull()
  })

})
