import { describe, expect, it, vi } from 'vitest'

import { acheteurPiece } from './acheteur-piece'
import { acheteurDeFacture, instantaneAcheteur } from './rattachement-client'

const GRAINE = 20261118

describe(`identité historique de l’acheteur (graine ${GRAINE})`, () => {
  it('512 identités : aucun champ archivé, même vide, ne dépend de la fiche courante', () => {
    let etat = GRAINE
    const champ = (valeur: string) => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return [null, '', valeur][etat % 3]
    }
    for (let i = 0; i < 512; i++) {
      const archive = {
        clientNom: `Acheteur fictif ${i}`, clientAdresse: champ(`Rue archivée ${i}`),
        clientEmail: champ(`archive-${i}@example.invalid`), clientCodePostal: champ('64000'),
        clientVille: champ('Ville archivée'), clientPays: champ('FR'), clientType: champ('particulier'),
        clientSiret: champ('12345678900017'), clientSiren: champ('123456789'), clientTvaIntra: champ('FR00123456789'),
        acheteurFigeLe: i % 2 ? new Date('2026-11-18') : null,
      }
      const courant = { nom: `Nouvelle identité ${i}`, adresse: 'Adresse actuelle', email: 'actuel@example.invalid',
        codePostal: '75000', ville: 'Ville actuelle', pays: 'DE', type: 'professionnel', siret: '98765432100019',
        siren: '987654321', tvaIntra: 'FR00987654321' }
      const avant = acheteurDeFacture(archive)
      expect(acheteurDeFacture({ ...archive, client: courant }), `cas ${i}`).toEqual(avant)
      expect(avant.fige).toBe(archive.acheteurFigeLe !== null)
      if (avant.fige) expect(avant.siren).toBe(archive.clientSiren)
    }
  })

  it('256 avoirs : identité d’origine et TVA indépendantes de la fiche exonérée ou supprimée', async () => {
    for (let i = 0; i < 256; i++) {
      const instantane = instantaneAcheteur({ nom: `Origine fictive ${i}`, email: i % 3 ? null : 'origine@example.invalid' })
      const origine = { ...instantane, clientId: i + 1, acheteurFigeLe: i % 2 ? new Date('2026-11-18') : null }
      const findFirst = vi.fn().mockResolvedValue(i % 3 ? { id: i + 1, nom: 'Nouvelle identité', exonererTVA: true } : null)
      const facture = vi.fn().mockResolvedValue(origine)
      const tx = { facture: { findFirst: facture }, client: { findFirst } } as unknown as Parameters<typeof acheteurPiece>[0]
      const avoir = await acheteurPiece(tx, 'ferme-fictive', { type: 'avoir', factureOrigineId: i + 1000, clientId: i + 1 })
      expect(avoir.instantane, `cas ${i}`).toEqual(instantane)
      expect(avoir.exonere).toBe(false)
      expect(avoir.fige).toBe(origine.acheteurFigeLe !== null)
      expect(facture).toHaveBeenCalledWith(expect.objectContaining({ where: { id: i + 1000, userId: 'ferme-fictive' } }))
      expect(findFirst).toHaveBeenCalledWith({ where: { id: i + 1, userId: 'ferme-fictive' }, select: { id: true } })
    }
  })
})
