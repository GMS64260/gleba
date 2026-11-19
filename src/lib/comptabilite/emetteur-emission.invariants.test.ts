import { describe, expect, it, vi } from 'vitest'
import { creerFacture, emetteurEtFiscalitePiece, snapshotEmetteurPiece } from '@/lib/facture-utils'

vi.mock('@/lib/abonnement/serveur', () => ({ serviceAutorise: async () => true }))

const GRAINE = 0x20261118
function generateur() {
  let n = GRAINE
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n }
}
const identite = { raisonSociale: 'Ferme fictive', adresseSiege: '1 voie fictive', ville: 'Essai', regimeTva: 'reel-normal', indemniteRecouvrement: 40 }

describe(`émetteur à l’émission — graine ${GRAINE} (0x20261118)`, () => {
  it('600 identités : toute facture/acompte accepté a trois champs non blancs et une devise reconnue', async () => {
    const alea = generateur()
    let acceptes = 0, refuses = 0
    for (let i = 0; i < 600; i++) {
      const champs = ['raisonSociale', 'adresseSiege', 'ville'] as const
      const blancs = ['', ' ', '\t\n', '\u00a0']
      const e = { ...identite, devise: i % 2 ? 'EUR' : 'XPF' }
      if (i % 3 === 0) e[champs[alea() % champs.length]] = blancs[alea() % blancs.length]
      if (i % 5 === 0) e.devise = ['USD', '', 'eur', ' EUR '][alea() % 4]
      const courant = i % 7 === 0 ? null : e
      const valide = courant !== null && champs.every(c => courant[c].trim().length > 0) && ['EUR', 'XPF'].includes(courant.devise)
      const tx = {
        exploitation: { findUnique: vi.fn().mockResolvedValue(courant) },
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        $queryRawUnsafe: vi.fn(async (sql: string) => sql.includes('FOR UPDATE')
          ? [{ prochain_num: 1, prefixe: 'F-FICTIVE-', format: '%04d' }] : [{ max_num: 0 }]),
        facture: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data) },
      }
      const appel = snapshotEmetteurPiece(tx as never, 'ferme-fictive', { type: i % 2 ? 'facture' : 'acompte' })
      if (valide) {
        acceptes++
        await expect(appel).resolves.toMatchObject(e)
      } else {
        refuses++
        await expect(appel).rejects.toMatchObject({ status: 400 })
      }
      const creation = creerFacture(tx as never, {
        userId: 'ferme-fictive', type: i % 2 ? 'facture' : 'acompte', statut: i % 2 ? 'payee' : undefined,
        objet: 'Vente fictive', totalHT: 1, totalTVA: 0, totalTTC: 1,
        lignes: [{ description: 'Ligne fictive', quantite: 1, unite: 'kg', prixUnitaire: 1, tauxTVA: 0, montantHT: 1, montantTVA: 0, montantTTC: 1 }],
      })
      if (valide) await expect(creation).resolves.toMatchObject({ emetteurSnapshot: e })
      else {
        await expect(creation).rejects.toMatchObject({ status: 400 })
        expect(tx.facture.create).not.toHaveBeenCalled()
        expect(tx.$executeRawUnsafe).not.toHaveBeenCalled()
      }
      expect(tx.exploitation.findUnique).toHaveBeenCalledWith({ where: { userId: 'ferme-fictive' } })
    }
    expect(acceptes).toBeGreaterThan(100)
    expect(refuses).toBeGreaterThan(300)
  })

  it('320 avoirs : seule l’origine décide de l’identité, de la devise et de la TVA', async () => {
    const alea = generateur()
    for (let i = 0; i < 320; i++) {
      const devise = alea() % 2 ? 'EUR' : 'XPF'
      const origine = { ...identite, devise: i % 5 === 0 ? 'USD' : devise }
      const tx = {
        exploitation: { findUnique: vi.fn().mockResolvedValue(i % 2 ? null : { ...identite, devise: devise === 'EUR' ? 'XPF' : 'EUR' }) },
        $queryRaw: vi.fn().mockResolvedValue([{ numero: `F-FICTIVE-${i}`, emetteur_snapshot: origine, date: new Date('2026-11-18'), taxee: true }]),
      }
      const appel = emetteurEtFiscalitePiece(tx as never, 'ferme-fictive', { type: 'avoir', factureOrigineId: i + 1 })
      if (origine.devise === 'USD') await expect(appel).rejects.toThrow('Devise de la facture d’origine inconnue')
      else await expect(appel).resolves.toEqual({ emetteur: origine, sansTaxe: false })
      expect(tx.exploitation.findUnique).not.toHaveBeenCalled()
    }
  })
})
