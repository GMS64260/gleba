import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { datesDepuisItp, semaineSemisEffective, type DatesCycle, type SemainesItp } from '@/lib/cultures/dates-itp'
import { formatSemaine } from '@/lib/assistant-helpers'
import { jourLocalISO } from '@/lib/jour-civil'
import { ecartJoursCivils } from './jours-civils'

// Le fuseau doit être posé AVANT le démarrage de Vitest (pool threads).
console.info(`Fuseau effectif B6 : ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)

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

describe('écart en jours civils — Europe/Paris', () => {
  it('utilise effectivement Europe/Paris', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Paris')
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
