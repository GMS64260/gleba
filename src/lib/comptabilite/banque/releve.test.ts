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

// Exports SYNTHÉTIQUES (données fictives) reprenant la forme des exports CSV des
// banques françaises, tels que décodés par le navigateur (decoderReleve).
const resume = (csv: string) =>
  lireReleveCsv(csv).map((l) => [l.date.toISOString().slice(0, 10), l.montantCentimes])
describe('relevé bancaire : exports des banques', () => {
  it.each([
    [
      'lignes d’information avant l’en-tête, Débit/Crédit en euros, libellés sur deux lignes',
      'Téléchargement du 01/11/2026;\r\n\r\nEXPLOITATION FICTIVE;\r\nSolde au 31/10/2026 1 234,56 €\r\n\r\n' +
        'Date;Libellé;Débit euros;Crédit euros;\r\n02/10/2026;"PAIEMENT PAR CARTE  \r\nCOOP FICTIVE\r\n";45,60;;\r\n' +
        '05/10/2026;"VIREMENT EN VOTRE FAVEUR\r\nMARCHE FICTIF";;320,00;\r\n',
    ],
    [
      'Montant(EUROS) préféré à Montant(FRANCS)',
      'Numéro Compte   ;0000000A000\nDate   ;31/10/2026\nSolde (EUROS)   ;1 234,56\n\n' +
        'Date;Libellé;Montant(EUROS);Montant(FRANCS)\n02/10/2026;"ACHAT CB FICTIF";-45,60;-299,12\n05/10/2026;"VIREMENT FICTIF";320,00;2 099,07\n',
    ],
    [
      'débit écrit négatif et crédit signé',
      // eslint-disable-next-line no-restricted-syntax -- en-têtes d'un export bancaire, sans accent
      '\uFEFFDate de comptabilisation;Libelle simplifie;Libelle operation;Reference;Debit;Credit;Date operation\n' +
        '03/10/2026;COOP;CB COOP FICTIVE;0000001;-45,6;;02/10/2026\n06/10/2026;VIR;VIR CLIENT FICTIF;0000002;;+320,00;05/10/2026\n',
    ],
    [
      'Débit négatif, colonne Solde ignorée',
      'Date;Date de valeur;Débit;Crédit;Libellé;Solde\n02/10/2026;02/10/2026;-45,60;;CARTE FICTIVE;1234,56\n05/10/2026;05/10/2026;;320,00;VIR FICTIF;1554,56\n',
    ],
    [
      'Montant de l’opération après une ligne de compte',
      '="00000000001";Compte courant;1 234,56;EUR\n\nDate de l\'opération;Libellé;Détail de l\'écriture;Montant de l\'opération;Devise\n' +
        '02/10/2026;CARTE;CARTE FICTIVE;-45,60;EUR\n05/10/2026;VIR RECU;VIR CLIENT FICTIF;320,00;EUR\n',
    ],
    [
      'Montant operation',
      // eslint-disable-next-line no-restricted-syntax -- en-têtes d'un export bancaire, sans accent
      'Compte de chèques;****0001;31/10/2026;1 234,56\n\nDate operation;Categorie operation;Libelle operation;Montant operation\n' +
        '02/10/2026;Achats;CARTE FICTIVE;-45,60\n05/10/2026;Revenus;VIR FICTIF;320,00\n',
    ],
    [
      'CSV réenregistré par Excel : années sur deux chiffres, symbole €, colonnes vides',
      'Date;Libellé;Débit;Crédit;;;\n02/10/26;Coop fictive;45,60 €;;;;\n05/10/26;Marché fictif;;320,00 €;;;\n;;;;;;\n',
    ],
  ])('%s', (_cas, csv) =>
    expect(resume(csv)).toEqual([
      ['2026-10-02', -4560],
      ['2026-10-05', 32000],
    ]))
  it('lit les milliers, les dates horodatées et ignore les lignes sans date ni montant', () =>
    expect(
      resume(
        'Date;Libellé;Montant\n02.10.2026 10:12;A;1.234,56\n2026-10-05T08:00:00Z;B;-1,234.50\n;Total;\n05-10-2026;C;"1 000,00"\n',
      ),
    ).toEqual([
      ['2026-10-02', 123456],
      ['2026-10-05', -123450],
      ['2026-10-05', 100000],
    ]))
  it('complète une ligne plus courte que l’en-tête (crédit vide omis)', () =>
    expect(resume('Date;Libellé;Débit;Crédit\n02/10/2026;A;45,60\n')).toEqual([['2026-10-02', -4560]]))
  it.each([
    ['trois décimales', 'Date;Libellé;Montant\n02/10/2026;A;1,234'],
    ['crédit négatif', 'Date;Libellé;Débit;Crédit\n02/10/2026;A;;-5'],
    ['cellule remplie au-delà de l’en-tête', 'Date;Libellé;Montant\n02/10/2026;A;5;décalé'],
    ['date sans montant', 'Date;Libellé;Montant\n02/10/2026;A;'],
  ])('refuse toujours : %s', (_cas, csv) => expect(() => lireReleveCsv(csv)).toThrow())
  it('montre l’en-tête lu et signale un fichier mal décodé', () => {
    expect(() => lireReleveCsv('Compte;0001\nDate;Libell�;D�bit;Cr�dit\n02/10/2026;A;1;')).toThrow(
      /mal encodé.*En-tête lu : « Date;Libell�;D�bit;Cr�dit »/,
    )
    expect(() => lireReleveCsv('Date;Opération;Valeur\n02/10/2026;A;1')).toThrow(
      /Colonnes requises.*En-tête lu : « Date;Opération;Valeur »/,
    )
  })
})
