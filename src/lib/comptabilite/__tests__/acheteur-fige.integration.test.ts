/**
 * BX03 (2026-11-16) — l'identité complète de l'acheteur est figée à
 * l'émission : une fiche client modifiée ensuite (ville, passage en
 * professionnel avec SIRET) ne change ni le Factur-X (XML CII), ni l'UBL, ni
 * les données du PDF d'une facture émise. Une facture antérieure, sans
 * acheteur figé, garde uniquement ses champs archivés, est signalée dans le rapport
 * d'export et n'est jamais réécrite.
 *
 * Base PostgreSQL jetable uniquement (DATABASE_URL = TEST_DATABASE_URL),
 * sinon la suite est ignorée :
 *
 *   DATABASE_URL="$TEST_DATABASE_URL" lourd node node_modules/vitest/vitest.mjs run \
 *     src/lib/comptabilite/__tests__/acheteur-fige.integration.test.ts \
 *     --pool=threads --poolOptions.threads.singleThread --testTimeout=30000
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const identite = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: identite.userId, email: 'qa@example.invalid' } } }),
}))
vi.mock('@/lib/abonnement/serveur', () => ({ serviceAutorise: async () => true }))

import prisma from '@/lib/prisma'
import { PATCH, POST } from '@/app/api/comptabilite/factures/route'
import { GET as ubl } from '@/app/api/comptabilite/factures/[id]/ubl/route'
import { AVERTISSEMENT_ACHETEUR_NON_FIGE } from '@/lib/comptabilite/rattachement-client'
import { blocAcheteurPdf } from '@/lib/facture-pdf'
import { ENTETE_ACHETEUR_FIGE, preparerExportFacture } from '@/lib/facture-structuree'
import { buildCiiInvoice, validerCii } from '@/lib/facturx/cii'
import { validerFactureStructuree } from '@/lib/facture-ubl'

const url = process.env.DATABASE_URL
const active = !!url && url === process.env.TEST_DATABASE_URL && new URL(url).pathname === '/gleba_tests'

const ligne = (ttc: number) => {
  const ht = Math.round((ttc / 1.055) * 100) / 100
  return { description: 'Légumes fictifs', quantite: 1, unite: 'unité', prixUnitaire: ht, tauxTVA: 5.5, montantHT: ht, montantTVA: Math.round((ttc - ht) * 100) / 100, montantTTC: ttc }
}
const corps = (type: 'facture' | 'avoir', ttc: number, extra: object = {}) => {
  const l = ligne(ttc)
  return { type, clientNom: 'Client fictif', objet: 'Pièce fictive', totalHT: l.montantHT, totalTVA: l.montantTVA, totalTTC: ttc, lignes: [l], ...extra }
}
const appel = async (methode: 'POST' | 'PATCH', data: object, attendu: number) => {
  const reponse = await (methode === 'POST' ? POST : PATCH)(new NextRequest('http://localhost/api/comptabilite/factures', {
    method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }))
  const json = await reponse.json()
  expect(reponse.status, JSON.stringify(json)).toBe(attendu)
  return json.data as { id: number }
}

/** Tout ce qu'un acheteur imprime ou transmet : XML CII, XML UBL, bloc « Facturé à » du PDF. */
async function editions(userId: string, id: number) {
  const facture = await prisma.facture.findFirstOrThrow({ where: { id, userId }, include: { client: true, lignes: { orderBy: { ordre: 'asc' } } } })
  const preparation = await preparerExportFacture(facture, userId, 'Factur-X')
  if (!preparation.ok) throw new Error(preparation.error)
  const reponseUbl = await ubl(new NextRequest(`http://localhost/api/comptabilite/factures/${id}/ubl`), { params: Promise.resolve({ id: String(id) }) })
  expect(reponseUbl.status).toBe(200)
  return {
    cii: buildCiiInvoice(preparation.donnees),
    ubl: await reponseUbl.text(),
    pdf: blocAcheteurPdf(facture),
    acheteur: preparation.donnees.customer,
    traitement: preparation.donnees.traitement,
    avertissements: preparation.avertissements,
    entete: reponseUbl.headers.get(ENTETE_ACHETEUR_FIGE),
  }
}

describe.skipIf(!active)('acheteur figé à l’émission (BX03)', () => {
  beforeAll(() => { process.env.GLEBA_ABONNEMENTS_ACTIFS = 'false' })
  afterAll(async () => { await prisma.$disconnect() })

  async function ferme() {
    const userId = randomUUID(); identite.userId = userId
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
    await prisma.exploitation.create({ data: { userId, raisonSociale: 'Ferme fictive', formeJuridique: 'EI', regimeFiscal: 'micro-BA',
      regimeTva: 'reel-normal', territoire: 'METROPOLE', devise: 'EUR', siren: '000000000', siret: '00000000000000',
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai', emailContact: 'qa@example.invalid' } })
    const client = await prisma.client.create({ data: { userId, nom: 'Camille Fictive', type: 'particulier', email: 'camille@example.invalid',
      adresse: '3 chemin fictif', codePostal: '64000', ville: 'Pau', pays: 'France' } })
    return { userId, clientId: client.id }
  }
  /** La cliente déménage et devient professionnelle (SIRET fictif). */
  const devientPro = (clientId: number) => prisma.client.update({ where: { id: clientId }, data: {
    nom: 'Fictive SARL', type: 'professionnel', email: 'achats@example.invalid', adresse: '9 quai fictif', codePostal: '64100', ville: 'Bayonne',
    siret: '12345678900017', siren: '123456789', tvaIntra: 'FR00123456789',
  } })

  it('facture émise, fiche client modifiée : Factur-X, UBL et PDF identiques à l’émission ; nouvelle facture à la nouvelle identité', async () => {
    const { userId, clientId } = await ferme()
    const emise = await appel('POST', corps('facture', 105.5, { clientId }), 201)
    const avant = await editions(userId, emise.id)
    expect(avant.acheteur).toMatchObject({ name: 'Camille Fictive', email: 'camille@example.invalid', siret: null, address: { city: 'Pau', postalCode: '64000', country: 'France' } })
    expect(avant.traitement).toBe('B2C')
    expect(avant.avertissements).toEqual([])
    expect(avant.entete).toBe('oui')

    await devientPro(clientId)

    const apres = await editions(userId, emise.id)
    expect(apres.cii).toBe(avant.cii)
    expect(apres.ubl).toBe(avant.ubl)
    expect(apres.pdf).toEqual(avant.pdf)
    expect(apres.traitement).toBe('B2C')
    expect(apres.cii).not.toContain('Bayonne')
    expect(apres.cii).not.toContain('123456789')

    // Nouvelle facture au même client : elle porte la nouvelle identité.
    const nouvelle = await editions(userId, (await appel('POST', corps('facture', 52.75, { clientId }), 201)).id)
    expect(nouvelle.acheteur).toMatchObject({ name: 'Fictive SARL', email: 'achats@example.invalid', siret: '12345678900017', siren: '123456789',
      vatId: 'FR00123456789', address: { city: 'Bayonne', postalCode: '64100' } })
    expect(nouvelle.traitement).toBe('B2B')
    expect(nouvelle.pdf.lignes).toContain('SIRET : 123 456 789 00017')
  })

  it('avoir : il reprend l’acheteur figé de sa facture d’origine, pas la fiche modifiée', async () => {
    const { userId, clientId } = await ferme()
    const origine = await appel('POST', corps('facture', 105.5, { clientId }), 201)
    const avantOrigine = await editions(userId, origine.id)
    await devientPro(clientId)
    const avoir = await appel('POST', corps('avoir', 52.75, { factureOrigineId: origine.id, clientId }), 201)
    const ed = await editions(userId, avoir.id)
    expect(ed.acheteur).toEqual(avantOrigine.acheteur)
    expect(ed.pdf).toEqual(avantOrigine.pdf)
    expect(ed.traitement).toBe('B2C')
    expect(await prisma.facture.findUniqueOrThrow({ where: { id: avoir.id } })).toMatchObject({ clientId, clientVille: 'Pau', clientType: 'particulier', acheteurFigeLe: expect.any(Date) })
  })

  it('brouillon : l’acheteur est figé à l’émission, puis ne bouge plus', async () => {
    const { userId, clientId } = await ferme()
    const brouillon = await appel('POST', corps('facture', 105.5, { clientId, statut: 'brouillon' }), 201)
    expect((await prisma.facture.findUniqueOrThrow({ where: { id: brouillon.id } })).acheteurFigeLe).toBeNull()
    await devientPro(clientId)
    await appel('PATCH', { id: brouillon.id, statut: 'emise' }, 200)
    const emise = await editions(userId, brouillon.id)
    expect(emise.acheteur).toMatchObject({ name: 'Fictive SARL', siret: '12345678900017', address: { city: 'Bayonne' } })
    expect(emise.traitement).toBe('B2B')
    await prisma.client.update({ where: { id: clientId }, data: { ville: 'Biarritz', codePostal: '64200', type: 'particulier', email: 'autre@example.invalid' } })
    const ensuite = await editions(userId, brouillon.id)
    expect(ensuite.cii).toBe(emise.cii)
    expect(ensuite.pdf).toEqual(emise.pdf)
  })

  it('facture antérieure : identité archivée seule, signalée incomplète et jamais réécrite', async () => {
    const { userId, clientId } = await ferme()
    const ancienne = await appel('POST', corps('facture', 105.5, { clientId }), 201)
    // État d'une facture émise avant la migration : seuls nom, adresse et
    // identifiants légaux étaient figés.
    await prisma.$executeRaw`UPDATE factures SET client_email = NULL, client_code_postal = NULL, client_ville = NULL, client_pays = NULL,
      client_type = NULL, acheteur_fige_le = NULL WHERE id = ${ancienne.id}`
    const ligneAvant = await prisma.facture.findUniqueOrThrow({ where: { id: ancienne.id } })

    const preparation = await preparerExportFacture({ ...ligneAvant, client: await prisma.client.findUniqueOrThrow({ where: { id: clientId } }), lignes: [] }, userId, 'Factur-X')
    expect(preparation.ok).toBe(true)
    if (!preparation.ok) throw new Error(preparation.error)
    expect(preparation.avertissements).toEqual([AVERTISSEMENT_ACHETEUR_NON_FIGE])
    expect(preparation.donnees.customer).toMatchObject({ name: 'Camille Fictive', email: null, siret: null,
      address: { street: '3 chemin fictif, 64000, Pau', city: null, postalCode: null, country: null } })
    await devientPro(clientId)
    const actuelle = await prisma.facture.findFirstOrThrow({ where: { id: ancienne.id, userId }, include: { client: true, lignes: true } })
    const apres = await preparerExportFacture(actuelle, userId, 'Factur-X')
    if (!apres.ok) throw new Error(apres.error)
    expect(apres.donnees.customer).toEqual(preparation.donnees.customer)
    expect(apres.donnees.traitement).toBe(preparation.donnees.traitement)
    expect(blocAcheteurPdf(actuelle)).toEqual({ nom: 'Camille Fictive', lignes: ['3 chemin fictif, 64000, Pau'] })
    expect(await prisma.facture.findUniqueOrThrow({ where: { id: ancienne.id } })).toEqual(ligneAvant)
  })

  it('QA59 : ancien PDF sans adresse stable dès le premier export ; XML incomplet toujours refusé', async () => {
    const { userId, clientId } = await ferme()
    await prisma.client.update({ where: { id: clientId }, data: { adresse: null, codePostal: null, ville: null } })
    const ancienne = await appel('POST', corps('facture', 105.5, { clientId }), 201)
    await prisma.$executeRaw`UPDATE factures SET client_adresse = NULL, client_email = NULL, client_code_postal = NULL, client_ville = NULL,
      client_pays = NULL, client_type = NULL, acheteur_fige_le = NULL WHERE id = ${ancienne.id}`
    const relire = () => prisma.facture.findFirstOrThrow({ where: { id: ancienne.id, userId }, include: { client: true, lignes: true } })
    // Lecture PDF en premier, avant toute préparation XML.
    const avant = blocAcheteurPdf(await relire())
    expect(avant).toEqual({ nom: 'Camille Fictive', lignes: [] })
    for (const modifier of [false, true]) {
      if (modifier) await devientPro(clientId)
      const facture = await relire()
      expect(blocAcheteurPdf(facture)).toEqual(avant)
      const preparation = await preparerExportFacture(facture, userId, 'Factur-X')
      if (!preparation.ok) throw new Error(preparation.error)
      expect(preparation.avertissements).toEqual([AVERTISSEMENT_ACHETEUR_NON_FIGE])
      expect(preparation.donnees.customer.address?.street).toBeNull()
      expect(validerFactureStructuree(preparation.donnees)).toContain('Adresse complète client manquante')
      expect(validerCii(preparation.donnees)).toContain('Adresse complète client manquante')
      const reponse = await ubl(new NextRequest(`http://localhost/api/comptabilite/factures/${ancienne.id}/ubl`), { params: Promise.resolve({ id: String(ancienne.id) }) })
      expect(reponse.status).toBe(422)
      expect(blocAcheteurPdf(await relire())).toEqual(avant)
    }
  })

  it('avoir sur facture antérieure : champs historiques absents conservés, même après émission du brouillon', async () => {
    const { userId, clientId } = await ferme()
    const origine = await appel('POST', corps('facture', 105.5, { clientId }), 201)
    await prisma.$executeRaw`UPDATE factures SET client_email = NULL, client_code_postal = NULL, client_ville = NULL,
      client_pays = NULL, client_type = NULL, acheteur_fige_le = NULL WHERE id = ${origine.id}`
    await devientPro(clientId)
    await prisma.client.update({ where: { id: clientId }, data: { exonererTVA: true } })
    for (const statut of ['emise', 'brouillon']) {
      const avoir = await appel('POST', corps('avoir', 52.75, { factureOrigineId: origine.id, clientId, statut }), 201)
      if (statut === 'brouillon') await appel('PATCH', { id: avoir.id, statut: 'emise' }, 200)
      const piece = await prisma.facture.findFirstOrThrow({ where: { id: avoir.id, userId } })
      expect(piece).toMatchObject({ clientNom: 'Camille Fictive', clientAdresse: '3 chemin fictif, 64000, Pau',
        clientSiret: null, clientEmail: null, clientVille: null, clientType: null, acheteurFigeLe: null, totalTVA: 2.75 })
    }
  })

  describe('avoir : TVA de la facture d’origine, jamais l’exonération actuelle de la fiche', () => {
    /** Origine 100 HT + 5,50 TVA ; la fiche passe ensuite exonérée de TVA. */
    async function origineEtFicheExoneree() {
      const f = await ferme()
      const origine = await appel('POST', corps('facture', 105.5, { clientId: f.clientId }), 201)
      await prisma.client.update({ where: { id: f.clientId }, data: { exonererTVA: true } })
      return { ...f, origine }
    }
    const fiscalite = async (id: number) => {
      const p = await prisma.facture.findUniqueOrThrow({ where: { id }, include: { lignes: true } })
      return { ht: p.totalHT, tva: p.totalTVA, ttc: p.totalTTC, taux: p.lignes.map((l) => l.tauxTVA) }
    }

    for (const [cas, extra] of [['clientId null', { clientId: null }], ['clientId omis', {}], ['clientId fourni', 'fiche']] as const) {
      it(`création directe, ${cas}`, async () => {
        const { clientId, origine } = await origineEtFicheExoneree()
        const avoir = await appel('POST', corps('avoir', 105.5, { factureOrigineId: origine.id, ...(extra === 'fiche' ? { clientId } : extra) }), 201)
        expect(await fiscalite(avoir.id)).toEqual(await fiscalite(origine.id))
        expect(await fiscalite(avoir.id)).toMatchObject({ ht: 100, tva: 5.5, taux: [5.5] })
      })
    }

    it('brouillon d’avoir émis après le passage de la fiche en exonéré', async () => {
      const { clientId, origine } = await origineEtFicheExoneree()
      const brouillon = await appel('POST', corps('avoir', 105.5, { factureOrigineId: origine.id, clientId, statut: 'brouillon' }), 201)
      await appel('PATCH', { id: brouillon.id, statut: 'emise' }, 200)
      expect(await fiscalite(brouillon.id)).toEqual(await fiscalite(origine.id))
      expect((await prisma.facture.findUniqueOrThrow({ where: { id: brouillon.id } })).statut).toBe('emise')
    })

    it('facture (non avoir) : l’exonération de la fiche s’applique toujours', async () => {
      const { clientId } = await origineEtFicheExoneree()
      const facture = await appel('POST', corps('facture', 105.5, { clientId }), 201)
      expect(await fiscalite(facture.id)).toMatchObject({ ht: 105.5, tva: 0, taux: [0] })
    })
  })
})

