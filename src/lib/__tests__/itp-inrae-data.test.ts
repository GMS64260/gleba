import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sourcePath = path.join(process.cwd(), 'prisma/data/itp-inrae-mesclun-v1.1.json')
interface InraeCycle {
  id: string
  sourceRecordId: string
  nom: string
  cultureSource: string
  actif: boolean
  statutValidation: string
  [key: string]: string | number | boolean | null | Record<string, number | null>
}

interface InraeDataset {
  metadata: {
    rows: number
    doi: string
    licence: string
    xlsxSha256: string
  }
  speciesMap: Record<string, string>
  speciesCatalog: Array<{ id: string }>
  cycles: InraeCycle[]
}

const dataset = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as InraeDataset

describe('jeu ITP INRAE Pépinière-Mesclun v1.1', () => {
  it('conserve les 529 scénarios et couvre les 76 catégories source', () => {
    expect(dataset.metadata.rows).toBe(529)
    expect(dataset.cycles).toHaveLength(529)
    expect(Object.keys(dataset.speciesMap)).toHaveLength(76)
    expect(dataset.speciesCatalog).toHaveLength(65)

    const cultures = new Set(dataset.cycles.map((cycle) => cycle.cultureSource))
    expect(cultures.size).toBe(76)
    expect([...cultures].every((culture) => dataset.speciesMap[culture])).toBe(true)
    const catalogIds = new Set(dataset.speciesCatalog.map((species) => species.id))
    expect(Object.values(dataset.speciesMap).every((species) => catalogIds.has(species))).toBe(true)
  })

  it('utilise des identifiants stables et uniques', () => {
    const ids = dataset.cycles.map((cycle) => cycle.id)
    const sourceIds = dataset.cycles.map((cycle) => cycle.sourceRecordId)
    const names = dataset.cycles.map((cycle) => cycle.nom)

    expect(new Set(ids).size).toBe(529)
    expect(new Set(sourceIds).size).toBe(529)
    expect(new Set(names).size).toBe(529)
  })

  it('active uniquement les scénarios aux semaines ISO valides', () => {
    const weekFields = [
      'semaineSemis',
      'semainePlantation',
      'semaineRecolte',
      'semaineImplantationDebut',
      'semaineImplantationFin',
      'semaineRecolteFin',
    ]

    expect(dataset.cycles.filter((cycle) => cycle.actif)).toHaveLength(525)
    expect(dataset.cycles.filter((cycle) => !cycle.actif)).toHaveLength(4)

    for (const cycle of dataset.cycles) {
      for (const field of weekFields) {
        const value = cycle[field]
        if (typeof value === 'number') {
          expect(value, `${cycle.id}.${field}`).toBeGreaterThanOrEqual(1)
          expect(value, `${cycle.id}.${field}`).toBeLessThanOrEqual(52)
        }
      }
      expect(cycle.actif ? cycle.statutValidation : 'a_revoir').toBe(
        cycle.actif ? 'source_documentee' : 'a_revoir'
      )
    }
  })

  it('porte la provenance et ne prétend pas à une validation par IA', () => {
    expect(dataset.metadata.doi).toBe('10.57745/IQVM2I')
    expect(dataset.metadata.licence).toContain('Etalab 2.0')
    expect(dataset.metadata.xlsxSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(dataset).toLowerCase()).not.toContain('chatgpt')
  })
})
