import { describe, expect, it } from 'vitest'
import { celluleCsv } from './csv-cellule'

describe('cellule CSV', () => {
  it('neutralise les préfixes de formule d’un texte', () => {
    expect(celluleCsv('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`)
    expect(celluleCsv('+33 6 00 00 00 00')).toBe(`"'+33 6 00 00 00 00"`)
    expect(celluleCsv('-cmd|calc')).toBe(`"'-cmd|calc"`)
    expect(celluleCsv('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(celluleCsv('\t=1+1')).toBe(`"'\t=1+1"`)
  })

  it('met entre guillemets, sans toucher un texte ordinaire ni un nombre', () => {
    expect(celluleCsv('Paniers ; marché du samedi')).toBe('"Paniers ; marché du samedi"')
    expect(celluleCsv('dit "le grand"')).toBe('"dit ""le grand"""')
    expect(celluleCsv(-12.5)).toBe('-12.5')
    expect(celluleCsv(0)).toBe('0')
    expect(celluleCsv(null)).toBe('""')
    expect(celluleCsv(undefined)).toBe('""')
    expect(celluleCsv(Number.NaN)).toBe('""')
  })
})
