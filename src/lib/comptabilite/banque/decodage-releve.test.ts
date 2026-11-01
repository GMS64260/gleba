import { describe, expect, it } from 'vitest'
import { decoderReleve } from './decodage-releve'
import { lireReleveCsv } from './releve'

const csv = 'Date;Libellé;Débit;Crédit\n02/10/2026;Coop fictive;45,60;\n05/10/2026;Marché fictif;;320,00\n'
describe('décodage du relevé choisi dans le navigateur', () => {
  it('lit un export Windows-1252 (Crédit Agricole, La Banque Postale, Excel) sans perdre les accents', () => {
    const texte = decoderReleve(Buffer.from(csv, 'latin1'))
    expect(texte).toBe(csv)
    expect(lireReleveCsv(texte).map((l) => [l.libelle, l.montantCentimes])).toEqual([
      ['Coop fictive', -4560],
      ['Marché fictif', 32000],
    ])
  })
  it('témoin : lu comme UTF-8 (ancien File.text()), le même fichier perdait ses colonnes', () =>
    expect(() => lireReleveCsv(new TextDecoder('utf-8').decode(Buffer.from(csv, 'latin1')))).toThrow(
      /mal encodé/,
    ))
  it('garde l’UTF-8, avec ou sans BOM', () => {
    expect(decoderReleve(Buffer.from(csv, 'utf8'))).toBe(csv)
    expect(decoderReleve(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]))).toBe(csv)
  })
  it('lit l’UTF-16 d’Excel', () =>
    expect(decoderReleve(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv, 'utf16le')]))).toBe(csv))
})
