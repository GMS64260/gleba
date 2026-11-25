import PDFDocument from 'pdfkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { genererPdfCommercial } from './pdf'
import type { DocumentComplet } from './service'

function bon(statut: string, type = 'livraison', factureId: number | null = null) {
  return {
    id: 'bon-fictif', type, statut, numero: 'BL-2026-0001', factureId,
    date: new Date('2026-11-24T00:00:00Z'), dateValidite: null, dateLivraison: new Date('2026-11-25T00:00:00Z'),
    adresseLivraison: null, devisOrigine: null, objet: 'Bon fictif', notes: null,
    clientNom: 'Client fictif', clientAdresse: '1 voie fictive', clientEmail: null, clientSiret: null, clientSiren: null, clientTvaIntra: null,
    emetteurSnapshot: { raisonSociale: 'Ferme fictive', formeJuridique: 'EI', adresseSiege: '1 voie fictive', codePostal: '75001', ville: 'Paris', pays: 'France', devise: 'EUR' },
    lignes: [], totalHT: 0, totalTVA: 0, totalTTC: 0,
  } as unknown as DocumentComplet
}

async function textes(d: DocumentComplet) {
  const ecrit = vi.spyOn(PDFDocument.prototype, 'text')
  await genererPdfCommercial(d)
  return ecrit.mock.calls.map(appel => String(appel[0]))
}

describe('PDF d’un bon de livraison : date de livraison', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['brouillon', 'emis'])('annonce une livraison prévue pour un bon %s', async statut => {
    expect(await textes(bon(statut))).toContain('Livraison prévue le 25/11/2026')
  })

  // Le retour en stock garde la date posée par « Marquer livré ».
  it.each([['livre', null], ['retourne', null], ['retourne', 12]] as const)('garde la livraison effectuée pour un bon %s (facture %s)', async (statut, factureId) => {
    const lignes = await textes(bon(statut, 'livraison', factureId))
    expect(lignes).toContain('Livraison effectuée le 25/11/2026')
    expect(lignes.join('\n')).not.toContain('Livraison prévue')
  })

  it('laisse la date d’un devis accepté en livraison prévue', async () => {
    expect(await textes(bon('accepte', 'devis'))).toContain('Livraison prévue le 25/11/2026')
  })
})
