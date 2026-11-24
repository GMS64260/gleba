import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { datesDepuisItp, semaineSemisEffective, type DatesCycle, type SemainesItp } from '@/lib/cultures/dates-itp'
import { formatSemaine } from '@/lib/assistant-helpers'
import { jourLocalISO } from '@/lib/jour-civil'
import { ecartJoursCivils, rangJourAnnee } from './jours-civils'

// Les dates sont locales au processus : lancer aussi cette suite avec
// TZ=Europe/Paris pour couvrir les changements d’heure, et avec TZ=UTC.
const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone

// Exécuter la vraie fonction pure de la page sans monter ses dépendances navigateur.
// Garder son emplacement évite de déplacer le code partagé avec le lot pr73.
const source = readFileSync('src/app/maraichage/cultures/new/page.tsx', 'utf8')
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const fonction = ast.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'cycleItpPropose')
if (!fonction) throw new Error('Fonction cycleItpPropose introuvable')
const js = ts.transpileModule(fonction.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const cycleItpPropose = new Function('datesDepuisItp', 'semaineSemisEffective', 'formatSemaine', 'ecartJoursCivils',
  `${js}; return cycleItpPropose`)(datesDepuisItp, semaineSemisEffective, formatSemaine, ecartJoursCivils) as
  (itp: SemainesItp, year: number, today: Date) => DatesCycle & { info: string | null }

describe(`écart en jours civils — ${fuseau}`, () => {
  it('utilise le fuseau demandé au lancement, y compris pour les dates locales', () => {
    // La CI et scripts/test-tz.mjs fixent TZ avant la création des workers.
    // Vérifier aussi Date : modifier seulement process.env.TZ dans un worker
    // peut laisser Date sur le fuseau précédent.
    const attendu = process.env.TZ ?? fuseau
    expect(fuseau).toBe(new Intl.DateTimeFormat('fr', { timeZone: attendu }).resolvedOptions().timeZone)
    if (attendu === 'Europe/Paris') {
      expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60)
      expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120)
    } else if (attendu === 'UTC') {
      expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0)
      expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(0)
    }
  })
  it("compte 46 jours à travers le passage à l'heure d'hiver", () => {
    expect(ecartJoursCivils(new Date(2026, 8, 28), new Date(2026, 10, 13))).toBe(46)
  })
  it("compte deux jours à travers le passage à l'heure d'été", () => {
    expect(ecartJoursCivils(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2)
  })
  it("ignore l'heure dans une même journée et conserve le signe", () => {
    expect(ecartJoursCivils(new Date(2026, 10, 13), new Date(2026, 10, 13, 23, 59))).toBe(0)
    expect(ecartJoursCivils(new Date(2026, 10, 13), new Date(2026, 8, 28))).toBe(-46)
  })
  it('recale le cycle S40/S42/S46 et annonce 46 j dans la vraie fonction du formulaire', () => {
    const cycle = cycleItpPropose({ semaineSemis: 40, semainePlantation: 42, semaineRecolte: 46 },
      2026, new Date(2026, 10, 13, 15, 30))
    expect(jourLocalISO(cycle.dateSemis!)).toBe('2026-11-13')
    expect(jourLocalISO(cycle.datePlantation!)).toBe('2026-11-27')
    expect(jourLocalISO(cycle.dateRecolte!)).toBe('2026-12-25')
    expect(cycle.info).toContain('46 j')
  })
})

// FB-M89SKJ — le curseur du plan relit le rang du jour qu'il vient de poser :
// chaque pas doit redonner le rang demandé, changement d'heure compris.
describe('rangJourAnnee', () => {
  const tzAvant = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Europe/Paris' })
  afterAll(() => {
    if (tzAvant === undefined) delete process.env.TZ
    else process.env.TZ = tzAvant
  })

  it.each([2026, 2027, 2028])('redonne chaque rang posé par le curseur en %i', (annee) => {
    for (let rang = 0; rang <= 364; rang++) {
      expect(rangJourAnnee(new Date(annee, 0, 1 + rang))).toBe(rang)
    }
  })

  it('compte le 30 mars 2026 au rang 88, après le passage à l’heure d’été', () => {
    expect(rangJourAnnee(new Date(2026, 2, 30))).toBe(88)
    expect(rangJourAnnee(new Date(2026, 2, 30, 23, 30))).toBe(88)
  })
})
