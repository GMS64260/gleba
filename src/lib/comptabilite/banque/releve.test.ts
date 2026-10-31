import { describe, expect, it } from 'vitest'
import { lireReleveCsv } from './releve'
describe('relevé bancaire', () => {
  it('lit les décimales françaises, les libellés cités et les débits/crédits', () => {
    const lignes = lireReleveCsv(
      '\uFEFFDate;Libellé;Débit;Crédit;Référence\r\n27/10/2026;"Achat; outils";"30,03";;A\r\n2026-10-27;"Client ""QA""";;"70,07";B',
    )
    expect(lignes.map((l) => [l.libelle, l.montantCentimes, l.reference])).toEqual([
      ['Achat; outils', -3003, 'A'],
      ['Client "QA"', 7007, 'B'],
    ])
  })
  it('garde deux mouvements identiques distincts, avec des empreintes stables au rejeu', () => {
    const csv = 'Date,Libelle,Montant\n2026-10-27,Caisse,10\n2026-10-27,Caisse,10'
    const lignes = lireReleveCsv(csv)
    expect(lignes).toHaveLength(2)
    expect(lignes[0].reference).not.toBe(lignes[1].reference)
    expect(lireReleveCsv(csv).map((l) => l.reference)).toEqual(lignes.map((l) => l.reference))
  })
  it.each(['2026-02-30;Client;10', '2026-10-27;Client;1,001', '2026-10-27;Client;0'])(
    'refuse une donnée qui fausserait le rapprochement',
    (ligne) => expect(() => lireReleveCsv('Date;Libelle;Montant\n' + ligne)).toThrow(),
  )
  it('refuse les références répétées et les colonnes déséquilibrées', () => {
    expect(() =>
      // eslint-disable-next-line no-restricted-syntax -- en-têtes d'un relevé bancaire, sans accent
      lireReleveCsv('Date;Libelle;Montant;Reference\n2026-10-27;A;10;R\n2026-10-27;B;20;R'),
    ).toThrow()
    expect(() => lireReleveCsv('Date;Libelle;Montant\n2026-10-27;A;10;surplus')).toThrow()
  })
  it('refuse un débit et un crédit simultanés', () =>
    expect(() => lireReleveCsv('Date;Libelle;Debit;Credit\n2026-10-27;A;10;20')).toThrow())
})
