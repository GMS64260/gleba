/**
 * Registre phytosanitaire, semences et plants traités : arrêté du 24 décembre
 * 2025 (NOR AGRG2536515A), annexe II, tableaux C (traitement de semences ou de
 * plants) et D (semis de semences traitées).
 *
 * Parcours réel sur PostgreSQL : saisie par /api/interventions, lecture par
 * `genererRegistrePhyto`, export CSV, cloisonnement entre deux exploitations,
 * historique en ajout seul et contexte figé.
 *
 * Base jetable du banc uniquement :
 *   DATABASE_URL="$TEST_DATABASE_URL" lourd node node_modules/vitest/vitest.mjs run \
 *     src/lib/tracabilite/__tests__/registre-semences.integration.test.ts \
 *     --pool=threads --poolOptions.threads.singleThread --testTimeout=30000
 */
import { randomUUID } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const identite = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: identite.userId, email: 'qa@example.invalid' } } }),
}))
vi.mock('@/lib/abonnement/serveur', () => ({ serviceAutorise: async () => true }))

import prisma from '@/lib/prisma'
import { DELETE, PATCH, POST } from '@/app/api/interventions/route'
import { GET as exporter } from '@/app/api/registre-phyto/export/route'
import { DELETE as supprimerArbre } from '@/app/api/arbres/[id]/route'
import { genererRegistrePhyto } from '@/lib/tracabilite/registre-phyto'
import { estBaseTestJetable } from '@/lib/__tests__/helpers/base-test-jetable'

const active = estBaseTestJetable(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL)

const suffixe = randomUUID().slice(0, 8)
const A = `c2-a-${suffixe}`
const B = `c2-b-${suffixe}`
const PRODUIT_C = `Enrobage C ${suffixe}`
const PRODUIT_D = `Semence traitée D ${suffixe}`
const PRODUIT_B = `Produit de B ${suffixe}`

async function creerExploitation(userId: string, siret: string) {
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.invalid` } })
  await prisma.exploitation.create({
    data: {
      userId, raisonSociale: `Ferme fictive ${userId}`, formeJuridique: 'EI', regimeFiscal: 'micro-BA',
      regimeTva: 'reel-normal', territoire: 'METROPOLE', devise: 'EUR', siren: siret.slice(0, 9), siret,
      adresseSiege: '1 voie fictive', codePostal: '64000', ville: 'Essai', emailContact: 'qa@example.invalid',
    },
  })
}

async function enregistrer(userId: string, corps: Record<string, unknown>) {
  identite.userId = userId
  const reponse = await POST(new NextRequest('http://localhost/api/interventions', {
    method: 'POST', body: JSON.stringify(corps),
  }))
  return { status: reponse.status, json: await reponse.json() }
}

async function modifier(userId: string, corps: Record<string, unknown>) {
  identite.userId = userId
  const reponse = await PATCH(new NextRequest('http://localhost/api/interventions', {
    method: 'PATCH', body: JSON.stringify(corps),
  }))
  return { status: reponse.status, json: await reponse.json() }
}

/** Cellules d'une ligne CSV « ; » : guillemets et « ; » dans une valeur respectés. */
function cellules(ligne: string): string[] {
  return [...ligne.matchAll(/(?:^|;)(?:"((?:[^"]|"")*)"|([^;]*))/g)].map((m) =>
    m[1] !== undefined ? m[1].replace(/""/g, '"') : m[2],
  )
}

async function supprimer(userId: string, id: number, motif: string) {
  identite.userId = userId
  const reponse = await DELETE(new NextRequest(
    `http://localhost/api/interventions?id=${id}&motif=${encodeURIComponent(motif)}`, { method: 'DELETE' },
  ))
  return reponse.status
}

/** Sans espaces ni retours à la ligne : le PDF coupe les cellules là où la colonne finit. */
const compact = (t: string) => t.replace(/\s+/g, '')

/**
 * Texte du PDF réellement généré (flux décompressés, chaînes hexadécimales de
 * PDFKit), rendu sans espaces : comparer à `compact(attendu)`.
 */
async function exportPdfTexte(userId: string, from: string, to: string) {
  identite.userId = userId
  const reponse = await exporter(
    new NextRequest(`http://localhost/api/registre-phyto/export?from=${from}&to=${to}&format=pdf`),
  )
  expect(reponse.status).toBe(200)
  const pdf = Buffer.from(await reponse.arrayBuffer())
  const morceaux: string[] = []
  for (const m of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const flux = inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')
      morceaux.push([...flux.matchAll(/<([0-9a-f]+)>/gi)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''))
    } catch {
      // Flux non compressé (polices, métadonnées) : sans texte de page.
    }
  }
  return compact(morceaux.join(''))
}

/** Export CSV (année 2026 par défaut), lu par nom de colonne ; rectifications comprises. */
async function exportCsv(userId: string, from = '2026-01-01', to = '2026-12-31') {
  identite.userId = userId
  const reponse = await exporter(
    new NextRequest(`http://localhost/api/registre-phyto/export?from=${from}&to=${to}&format=csv`),
  )
  expect(reponse.status).toBe(200)
  const texte = await reponse.text()
  const lignes = texte.split('\r\n')
  const entete = cellules(lignes[lignes.findIndex((l) => l.startsWith('Date;'))])
  const valeur = (ligne: string, colonne: string) => {
    const i = entete.indexOf(colonne)
    expect(i, `colonne « ${colonne} » absente de l'export`).toBeGreaterThanOrEqual(0)
    return cellules(ligne)[i]
  }
  const ligneDe = (produit: string) => lignes.find((l) => l.includes(produit))
  // Tableau des rectifications et suppressions : une entrée par ligne, lue par nom de colonne.
  const iRectif = lignes.findIndex((l) => l.startsWith('"Rectifié le"') || l.startsWith('Rectifié le'))
  const enteteRectif = iRectif >= 0 ? cellules(lignes[iRectif]) : []
  const rectifications = iRectif >= 0
    ? lignes.slice(iRectif + 1).filter((l) => l.trim() !== '').map((l) => {
        const c = cellules(l)
        return Object.fromEntries(enteteRectif.map((nom, i) => [nom, c[i] ?? ''])) as Record<string, string>
      })
    : []
  return { texte, entete, valeur, ligneDe, rectifications }
}

describe.skipIf(!active)('registre phyto : semences et plants traités (tableaux C et D)', () => {
  let plancheA = ''
  let cultureA = 0
  let produitRefId = ''
  let idC = 0
  let idD = 0
  let produitRef2Id = ''

  beforeAll(async () => {
    await creerExploitation(A, '11111111100013')
    await creerExploitation(B, '22222222200027')
    const parcelle = await prisma.parcelleGeo.create({
      data: {
        userId: A, nom: 'Champ du bas', geometry: '{"type":"Polygon","coordinates":[]}',
        commune: 'Essai', centroidLat: 43.2951234, centroidLng: -0.370789,
      },
    })
    const planche = await prisma.planche.create({
      data: { userId: A, nom: `P-${suffixe}`, parcelleGeoId: parcelle.id, statutBio: 'AB' },
    })
    plancheA = planche.id
    const espece = await prisma.espece.create({ data: { userId: A, nom: 'Maïs doux' } })
    cultureA = (await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: planche.id } })).id
    produitRefId = (await prisma.produitPhyto.create({
      data: { nomCommercial: PRODUIT_D, substanceActive: 'fludioxonil ; métalaxyl-M', classification: 'Chimique conventionnel', amm: '2100456' },
    })).id
  })

  afterAll(async () => {
    await prisma.intervention.deleteMany({ where: { userId: { in: [A, B] } } })
    await prisma.culture.deleteMany({ where: { userId: A } })
    await prisma.espece.deleteMany({ where: { userId: A } })
    await prisma.produitPhyto.deleteMany({ where: { id: { in: [produitRefId, produitRef2Id].filter(Boolean) } } })
    // L'historique (ajout seul) part avec le compte fictif.
    await prisma.user.deleteMany({ where: { id: { in: [A, B] } } })
    await prisma.$disconnect()
  })

  it('cas C : un traitement de plants enregistré sort au registre avec les mentions du tableau C', async () => {
    const { status, json } = await enregistrer(A, {
      date: '2026-03-12', type: 'traitement_phyto', utilisationPhyto: 'traitement_semences',
      produitPhyto: PRODUIT_C, numAMM: '2100123', doseAppliquee: '0,6', uniteDose: 'L/t',
      quantiteSemences: 1.5, uniteQuantiteSemences: 't', gpsLat: 43.3012345, gpsLng: -0.3698765,
      cultureRegistre: 'Pomme de terre (plants)', intrantNumLot: 'PLANT-2026-07',
      // Annexe I, item 11 : mention commune, due aussi pour un traitement de plants.
      conduiteBio: false,
    })
    expect(status).toBe(201)
    idC = json.id

    const { registre } = await genererRegistrePhyto(A, 2026)
    const ligne = registre.find((l) => l.id === idC)!
    expect(ligne).toMatchObject({
      typeUtilisation: 'traitement_semences',
      typeUtilisationLibelle: 'Traitement de semences ou de plants',
      date: '2026-03-12',
      produit: PRODUIT_C,
      numAMM: '2100123',
      doseAppliquee: 0.6,
      uniteDose: 'L/t',
      quantiteSemences: 1.5,
      uniteQuantiteSemences: 't',
      localisationInstallation: '43.30123 , -0.36988',
      culture: 'Pomme de terre (plants)',
      conduiteBio: false,
      intrantNumLot: 'PLANT-2026-07',
      champsManquants: [],
      aCompleter: [],
      complet: true,
    })
  })

  it('cas D : un semis de semences traitées sort au registre avec les mentions du tableau D', async () => {
    const { status, json } = await enregistrer(A, {
      date: '2026-04-10', type: 'semis', utilisationPhyto: 'semis_semences_traitees',
      cultureId: cultureA, produitPhytoId: produitRefId,
      densiteSemis: 80000, uniteDensiteSemis: 'semences/ha', surfaceTraitee: 2500,
      intrantNumLot: 'SEM-2026-041',
    })
    expect(status).toBe(201)
    idD = json.id

    const { registre, stats } = await genererRegistrePhyto(A, 2026)
    const ligne = registre.find((l) => l.id === idD)!
    expect(ligne).toMatchObject({
      typeUtilisation: 'semis_semences_traitees',
      typeUtilisationLibelle: 'Semis de semences traitées',
      date: '2026-04-10',
      // Produit et substances copiés du référentiel au jour de la saisie.
      produit: PRODUIT_D,
      substancesActives: 'fludioxonil ; métalaxyl-M',
      densiteSemis: 80000,
      uniteDensiteSemis: 'semences/ha',
      surfaceSemeeM2: 2500,
      // Une surface semée n'est pas une surface traitée.
      surfaceTraitee: null,
      culture: 'Maïs doux',
      localisationGpsSemis: '43.29512 , -0.37079',
      conduiteBio: true,
      contexteFige: true,
      intrantNumLot: 'SEM-2026-041',
      champsManquants: [],
      complet: true,
    })
    expect(ligne.localisationReglementaire).toContain(`Planche P-${suffixe}`)
    expect(stats.surfaceTotalTraitee).toBe(0)
  })

  it('une mention obligatoire manquante est signalée « à compléter » sans bloquer la saisie', async () => {
    const semis = await enregistrer(A, {
      date: '2026-05-02', type: 'semis', utilisationPhyto: 'semis_semences_traitees',
      produitPhyto: `Incomplet D ${suffixe}`,
    })
    expect(semis.status).toBe(201)
    const traitement = await enregistrer(A, {
      date: '2026-05-03', type: 'traitement_phyto', utilisationPhyto: 'traitement_semences',
      produitPhyto: `Incomplet C ${suffixe}`, doseAppliquee: 2,
    })
    expect(traitement.status).toBe(201)

    const { registre, stats } = await genererRegistrePhyto(A, 2026)
    const d = registre.find((l) => l.id === semis.json.id)!
    expect(d.complet).toBe(false)
    expect(d.champsManquants).toEqual([
      'substancesActives', 'localisationSemis', 'surfaceSemee', 'densiteSemis', 'culture', 'conduiteBio',
    ])
    expect(d.aCompleter).toContain('Substance(s) active(s)')
    expect(d.aCompleter).toContain('Localisation de la surface semée (référence RPG ou GPS)')
    // Le numéro de lot est « le cas échéant » (annexe I) : jamais signalé manquant.
    expect(d.champsManquants).not.toContain('intrantNumLot')

    const c = registre.find((l) => l.id === traitement.json.id)!
    expect(c.complet).toBe(false)
    expect(c.champsManquants).toEqual([
      'numAMM', 'uniteDose', 'localisationInstallation', 'quantiteSemences', 'culture', 'conduiteBio',
    ])
    expect(c.aCompleter).toContain('Conduite biologique de la production')
    expect(stats.nbIncomplets).toBe(2)
  })

  it('refuse un type d\'utilisation incohérent avec le type d\'intervention, et un semis ordinaire reste hors registre', async () => {
    const incoherent = await enregistrer(A, {
      date: '2026-05-04', type: 'traitement_phyto', utilisationPhyto: 'semis_semences_traitees', produitPhyto: 'X',
    })
    expect(incoherent.status).toBe(400)
    expect(incoherent.json.champ).toBe('utilisationPhyto')
    const inconnu = await enregistrer(A, { date: '2026-05-04', type: 'semis', utilisationPhyto: 'autre' })
    expect(inconnu.status).toBe(400)

    const ordinaire = await enregistrer(A, { date: '2026-05-05', type: 'semis', cultureId: cultureA })
    expect(ordinaire.status).toBe(201)
    const { registre } = await genererRegistrePhyto(A, 2026)
    expect(registre.some((l) => l.id === ordinaire.json.id)).toBe(false)
  })

  it('l\'export restitue les colonnes des tableaux C et D, dates JJ/MM/AAAA, lot inclus', async () => {
    const { valeur, ligneDe } = await exportCsv(A)
    const c = ligneDe(PRODUIT_C)!
    expect(valeur(c, 'Date')).toBe('12/03/2026')
    expect(valeur(c, "Type d'utilisation")).toBe('Traitement de semences ou de plants')
    expect(valeur(c, 'SIRET détenteur')).toBe('11111111100013')
    expect(valeur(c, 'Produit')).toBe(PRODUIT_C)
    expect(valeur(c, 'N° AMM')).toBe('2100123')
    expect(valeur(c, 'Dose (valeur)')).toBe('0.6')
    expect(valeur(c, 'Unité de dose')).toBe('L/t')
    expect(valeur(c, "Localisation de l'installation de traitement (GPS WGS84)")).toBe('43.30123 , -0.36988')
    expect(valeur(c, 'Quantité de semences ou plants traitée (valeur)')).toBe('1.5')
    expect(valeur(c, 'Quantité de semences ou plants traitée (unité)')).toBe('t')
    expect(valeur(c, 'Culture')).toBe('Pomme de terre (plants)')
    expect(valeur(c, 'N° lot')).toBe('PLANT-2026-07')
    expect(valeur(c, 'Conduite biologique')).toBe('Non')

    const d = ligneDe(PRODUIT_D)!
    expect(valeur(d, 'Date')).toBe('10/04/2026')
    expect(valeur(d, "Type d'utilisation")).toBe('Semis de semences traitées')
    expect(valeur(d, 'SIRET détenteur')).toBe('11111111100013')
    expect(valeur(d, 'Produit')).toBe(PRODUIT_D)
    expect(valeur(d, 'Substance active')).toBe('fludioxonil ; métalaxyl-M')
    expect(valeur(d, 'Localisation de la surface semée (GPS WGS84)')).toBe('43.29512 , -0.37079')
    expect(valeur(d, 'Surface semée (ha)')).toBe('0.25')
    expect(valeur(d, 'Surface traitée (ha)')).toBe('')
    expect(valeur(d, 'Densité de semis (valeur)')).toBe('80000')
    expect(valeur(d, 'Densité de semis (unité)')).toBe('semences/ha')
    expect(valeur(d, 'Culture')).toBe('Maïs doux')
    expect(valeur(d, 'N° lot')).toBe('SEM-2026-041')
    expect(valeur(d, 'Conduite biologique')).toBe('Oui')
  })

  it('référence RPG saisie : elle localise le semis et sort à l\'export', async () => {
    const { status, json } = await enregistrer(A, {
      date: '2026-04-20', type: 'semis', utilisationPhyto: 'semis_semences_traitees',
      produitPhyto: `RPG D ${suffixe}`, substancesActives: 'téfluthrine', densiteSemis: 120, uniteDensiteSemis: 'kg/ha',
      surfaceTraitee: 10000, cultureRegistre: 'Blé tendre', conduiteBio: false,
      rpgIlot: '12', rpgParcelle: '3', rpgCommuneInsee: '64445',
    })
    expect(status).toBe(201)
    const { registre } = await genererRegistrePhyto(A, 2026)
    const ligne = registre.find((l) => l.id === json.id)!
    expect(ligne.complet).toBe(true)
    expect(ligne.localisationRpg).toBe('îlot 12, parcelle 3, commune 64445')
    const { valeur, ligneDe } = await exportCsv(A)
    const l = ligneDe(`RPG D ${suffixe}`)!
    expect(valeur(l, "RPG : numéro d'îlot")).toBe('12')
    expect(valeur(l, 'RPG : numéro de parcelle')).toBe('3')
    expect(valeur(l, 'RPG : code commune Insee')).toBe('64445')
    expect(valeur(l, 'Conduite biologique')).toBe('Non')
  })

  it('cloisonnement : les lignes C et D de B n\'apparaissent ni au registre ni à l\'export de A', async () => {
    const cB = await enregistrer(B, {
      date: '2026-03-15', type: 'traitement_phyto', utilisationPhyto: 'traitement_semences',
      produitPhyto: `${PRODUIT_B} C`, numAMM: '2100789', doseAppliquee: 1, uniteDose: 'L/t',
      quantiteSemences: 2, uniteQuantiteSemences: 't', gpsLat: 44.1, gpsLng: 0.5, cultureRegistre: 'Blé',
    })
    const dB = await enregistrer(B, {
      date: '2026-04-15', type: 'semis', utilisationPhyto: 'semis_semences_traitees',
      produitPhyto: `${PRODUIT_B} D`, substancesActives: 'x', densiteSemis: 100, uniteDensiteSemis: 'kg/ha',
      surfaceTraitee: 100, intrantNumLot: `LOT-B-${suffixe}`,
      // Référence forgée vers la culture de A : refusée, rien n'est lu chez A.
    })
    expect(cB.status).toBe(201)
    expect(dB.status).toBe(201)
    const forge = await enregistrer(B, {
      date: '2026-04-16', type: 'semis', utilisationPhyto: 'semis_semences_traitees', cultureId: cultureA,
    })
    expect(forge.status).toBe(400)

    const registreA = (await genererRegistrePhyto(A, 2026)).registre
    expect(registreA.some((l) => l.id === cB.json.id || l.id === dB.json.id)).toBe(false)
    expect(registreA.some((l) => String(l.produit).includes(PRODUIT_B))).toBe(false)
    const exportA = await exportCsv(A)
    expect(exportA.texte).not.toContain(PRODUIT_B)
    expect(exportA.texte).not.toContain(`LOT-B-${suffixe}`)
    expect(exportA.texte).not.toContain('22222222200027')

    const registreB = (await genererRegistrePhyto(B, 2026)).registre
    expect(registreB.map((l) => l.id).sort()).toEqual([cB.json.id, dB.json.id].sort())
    const exportB = await exportCsv(B)
    expect(exportB.texte).not.toContain(PRODUIT_C)
    expect(exportB.texte).not.toContain(PRODUIT_D)

    // B ne peut pas modifier la ligne de A.
    const intrusion = await modifier(B, { id: idD, densiteSemis: 1 })
    expect(intrusion.status).toBe(404)
  })

  it('modifier une ligne C ou D ajoute une entrée à l\'historique en ajout seul', async () => {
    const avant = await prisma.registrePhytoHistorique.count({ where: { userId: A } })
    const d = await modifier(A, { id: idD, densiteSemis: 85000, motif: 'Erreur de saisie de la densité' })
    expect(d.status).toBe(200)
    const c = await modifier(A, { id: idC, quantiteSemences: 1.8 })
    expect(c.status).toBe(200)

    const historique = await prisma.registrePhytoHistorique.findMany({
      where: { userId: A, source: 'intervention', sourceId: { in: [idC, idD] } },
      orderBy: { id: 'asc' },
    })
    expect(await prisma.registrePhytoHistorique.count({ where: { userId: A } })).toBe(avant + 2)
    const entreeD = historique.find((h) => h.sourceId === idD)!
    expect(entreeD.action).toBe('modification')
    expect(entreeD.motif).toBe('Erreur de saisie de la densité')
    expect(entreeD.auteurId).toBe(A)
    expect((entreeD.avant as { densiteSemis: number }).densiteSemis).toBe(80000)
    expect((entreeD.apres as { densiteSemis: number }).densiteSemis).toBe(85000)
    expect((entreeD.avant as { utilisationPhyto: string }).utilisationPhyto).toBe('semis_semences_traitees')
    const entreeC = historique.find((h) => h.sourceId === idC)!
    expect((entreeC.avant as { quantiteSemences: number }).quantiteSemences).toBe(1.5)

    // Ajout seul : ni mise à jour ni suppression d'une entrée.
    await expect(
      prisma.registrePhytoHistorique.update({ where: { id: entreeD.id }, data: { motif: 'réécrit' } }),
    ).rejects.toThrow()

    // La rectification sort à l'export avec l'état d'origine.
    const { texte } = await exportCsv(A)
    expect(texte).toContain('Rectifications et suppressions')
    expect(texte).toContain('Erreur de saisie de la densité')
  })

  it('le contexte (culture, localisation, produit) reste celui figé à la saisie', async () => {
    await prisma.planche.update({ where: { id: plancheA }, data: { nom: `Renommée-${suffixe}`, statutBio: 'Conventionnel' } })
    await prisma.espece.updateMany({ where: { userId: A }, data: { nom: 'Maïs renommé' } })
    await prisma.produitPhyto.update({
      where: { id: produitRefId },
      data: { nomCommercial: `${PRODUIT_D} NOUVEAU`, substanceActive: 'autre substance', amm: '9999999' },
    })

    const { registre } = await genererRegistrePhyto(A, 2026)
    const ligne = registre.find((l) => l.id === idD)!
    expect(ligne.culture).toBe('Maïs doux')
    expect(ligne.localisationReglementaire).toContain(`Planche P-${suffixe}`)
    expect(ligne.conduiteBio).toBe(true)
    expect(ligne.produit).toBe(PRODUIT_D)
    expect(ligne.substancesActives).toBe('fludioxonil ; métalaxyl-M')
    expect(ligne.densiteSemis).toBe(85000)
    expect(ligne.contexteFige).toBe(true)

    const { valeur, ligneDe } = await exportCsv(A)
    const d = ligneDe('SEM-2026-041')!
    expect(valeur(d, 'Produit')).toBe(PRODUIT_D)
    expect(valeur(d, 'Culture')).toBe('Maïs doux')
    expect(valeur(d, 'Substance active')).toBe('fludioxonil ; métalaxyl-M')
    expect(valeur(d, 'Conduite biologique')).toBe('Oui')
  })
  it('une rectification qui renvoie date, type, fait et utilisation inchangés garde le contexte figé', async () => {
    // Planche, espèce et statut bio ont changé depuis la saisie (test précédent).
    const r = await modifier(A, {
      id: idD, date: '2026-04-10', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      cultureId: cultureA, densiteSemis: 90000, motif: 'Densité corrigée',
    })
    expect(r.status).toBe(200)
    expect(r.json.densiteSemis).toBe(90000)
    expect(r.json.cultureRegistre).toBe('Maïs doux')
    expect(r.json.localisationRegistre).toContain(`Planche P-${suffixe}`)
    expect(r.json.conduiteBio).toBe(true)
    expect(r.json.substancesActives).toBe('fludioxonil ; métalaxyl-M')

    const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === idD)!
    expect(ligne).toMatchObject({ culture: 'Maïs doux', conduiteBio: true, densiteSemis: 90000, complet: true })

    // Témoin inverse : une date réellement changée relit les fiches du jour.
    const deplace = await modifier(A, { id: idD, date: '2026-04-11' })
    expect(deplace.status).toBe(200)
    expect(deplace.json.cultureRegistre).toBe('Maïs renommé')
    expect(deplace.json.localisationRegistre).toContain(`Renommée-${suffixe}`)
    expect(deplace.json.conduiteBio).toBe(false)
  })

  it('remplacer le produit recopie les substances du nouveau produit ; référence inchangée, le cliché reste', async () => {
    const ancien = await prisma.produitPhyto.create({
      data: { nomCommercial: `Ancien ${suffixe}`, substanceActive: 'ANCIENNE SUBSTANCE', classification: 'Chimique conventionnel', amm: '2100111' },
    })
    const nouveau = await prisma.produitPhyto.create({
      data: { nomCommercial: `Nouveau ${suffixe}`, substanceActive: 'NOUVELLE SUBSTANCE', classification: 'Chimique conventionnel', amm: '2100222' },
    })
    produitRef2Id = nouveau.id
    try {
      const saisie = await enregistrer(A, {
        date: '2026-06-10', type: 'semis', utilisationPhyto: 'semis_semences_traitees', produitPhytoId: ancien.id,
        densiteSemis: 50, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 2000, gpsLat: 43.5, gpsLng: -0.4,
        cultureRegistre: 'Orge', conduiteBio: false, intrantNumLot: `LOT-PROD-${suffixe}`,
      })
      expect(saisie.status).toBe(201)
      expect(saisie.json.substancesActives).toBe('ANCIENNE SUBSTANCE')

      const r = await modifier(A, {
        id: saisie.json.id, produitPhytoId: nouveau.id, produitPhyto: `Nouveau ${suffixe}`, numAMM: '2100222',
        motif: 'Mauvais produit choisi',
      })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ produitPhyto: `Nouveau ${suffixe}`, numAMM: '2100222', substancesActives: 'NOUVELLE SUBSTANCE' })

      const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === saisie.json.id)!
      expect(ligne.substancesActives).toBe('NOUVELLE SUBSTANCE')
      const csv = await exportCsv(A, '2026-06-10', '2026-06-10')
      expect(csv.valeur(csv.ligneDe(`LOT-PROD-${suffixe}`)!, 'Substance active')).toBe('NOUVELLE SUBSTANCE')
      // L'état d'avant garde l'ancien produit et ses substances.
      const origine = csv.rectifications.find((x) => x['Motif'] === 'Mauvais produit choisi')!
      expect(origine['Produit']).toBe(`Ancien ${suffixe}`)
      expect(origine['Substance active']).toBe('ANCIENNE SUBSTANCE')

      // Référence renvoyée à l'identique après une mise à jour du référentiel : cliché gardé.
      await prisma.produitPhyto.update({ where: { id: nouveau.id }, data: { substanceActive: 'RÉFÉRENTIEL MODIFIÉ' } })
      const identique = await modifier(A, { id: saisie.json.id, produitPhytoId: nouveau.id, densiteSemis: 55 })
      expect(identique.status).toBe(200)
      expect(identique.json.substancesActives).toBe('NOUVELLE SUBSTANCE')
      // Substances saisies avec le changement de produit : elles priment.
      const saisies = await modifier(A, { id: saisie.json.id, produitPhytoId: ancien.id, substancesActives: 'saisie à la main' })
      expect(saisies.json.substancesActives).toBe('saisie à la main')
    } finally {
      await prisma.intervention.updateMany({ where: { userId: A, produitPhytoId: ancien.id }, data: { produitPhytoId: null } })
      await prisma.produitPhyto.delete({ where: { id: ancien.id } })
    }
  })

  it('PDF : un semis localisé par ses seules coordonnées GPS garde sa localisation ; le point saisi prime sur celui de la planche', async () => {
    const sansRpg = await enregistrer(A, {
      date: '2026-06-01', type: 'semis', utilisationPhyto: 'semis_semences_traitees',
      produitPhyto: `PDF-GPS-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 100, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 1000,
      gpsLat: 47.12345, gpsLng: 3.98765, cultureRegistre: 'Culture témoin', conduiteBio: false,
      intrantNumLot: `LOT-PDF-${suffixe}`,
    })
    expect(sansRpg.status).toBe(201)
    const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === sansRpg.json.id)!
    expect(ligne.complet).toBe(true)
    expect(ligne.localisationGpsSemis).toBe('47.12345 , 3.98765')
    const pdf = await exportPdfTexte(A, '2026-06-01', '2026-06-01')
    expect(pdf).toContain(compact(`PDF-GPS-${suffixe}`))
    expect(pdf).toContain(compact('47.12345'))
    expect(pdf).toContain(compact('3.98765'))
    expect(pdf).toContain(compact(`LOT-PDF-${suffixe}`))
    expect(pdf).toContain(compact('01/06/2026'))

    // Point saisi différent de celui de la planche (43.2951234, -0.370789) : seul le point retenu sort.
    const surPlanche = await enregistrer(A, {
      date: '2026-06-02', type: 'semis', utilisationPhyto: 'semis_semences_traitees', cultureId: cultureA,
      produitPhyto: `PDF-PLANCHE-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 100, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 1000, gpsLat: 44.55555, gpsLng: 1.22222,
    })
    expect(surPlanche.status).toBe(201)
    const pdf2 = await exportPdfTexte(A, '2026-06-02', '2026-06-02')
    expect(pdf2).toContain(compact('44.55555'))
    expect(pdf2).toContain(compact('1.22222'))
    expect(pdf2).not.toContain(compact('43.2951234'))
    // Sans point saisi, celui figé avec la planche localise le semis.
    const planche = await enregistrer(A, {
      date: '2026-06-03', type: 'semis', utilisationPhyto: 'semis_semences_traitees', cultureId: cultureA,
      produitPhyto: `PDF-FIGE-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 100, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 1000,
    })
    expect(planche.status).toBe(201)
    expect(await exportPdfTexte(A, '2026-06-03', '2026-06-03')).toContain(compact('Surface semée : GPS 43.29512 , -0.37079'))
  })

  it('après modification puis suppression, l\'export de la période d\'utilisation restitue les mentions C et D d\'origine', async () => {
    // D : saisie complète, rectifiée, puis supprimée.
    const d = await enregistrer(A, {
      date: '2026-07-01', type: 'semis', utilisationPhyto: 'semis_semences_traitees',
      produitPhyto: `SUPPR-D-${suffixe}`, substancesActives: 'SUBSTANCE-SUPPRIMEE', numAMM: '2100333',
      densiteSemis: 54321, uniteDensiteSemis: 'semences/ha', surfaceTraitee: 3000,
      gpsLat: 45.11111, gpsLng: 2.22222, rpgIlot: '7', rpgParcelle: '2', rpgCommuneInsee: '64445',
      cultureRegistre: 'Tournesol', conduiteBio: true, intrantNumLot: `LOT-SUPPR-D-${suffixe}`,
    })
    expect(d.status).toBe(201)
    expect((await modifier(A, { id: d.json.id, densiteSemis: 60000, motif: 'Rectification D' })).status).toBe(200)
    expect(await supprimer(A, d.json.id, 'Suppression D')).toBe(200)

    const csvD = await exportCsv(A, '2026-07-01', '2026-07-01')
    // La ligne supprimée n'est plus un traitement en vigueur : elle ne sort que dans l'état d'origine.
    expect(csvD.texte.split('Rectifications et suppressions')[0]).not.toContain(`SUPPR-D-${suffixe}`)
    const modifD = csvD.rectifications.find((x) => x['Motif'] === 'Rectification D')!
    const supprD = csvD.rectifications.find((x) => x['Motif'] === 'Suppression D')!
    expect(modifD['Action']).toBe('modification')
    expect(modifD['Densité de semis (valeur)']).toBe('54321')
    expect(supprD).toMatchObject({
      'Action': 'suppression',
      "Date d'utilisation d'origine": '01/07/2026',
      "Type d'utilisation": 'Semis de semences traitées',
      'Produit': `SUPPR-D-${suffixe}`,
      'N° AMM': '2100333',
      'Substance active': 'SUBSTANCE-SUPPRIMEE',
      'N° lot': `LOT-SUPPR-D-${suffixe}`,
      'Surface traitée (ha)': '',
      'Surface semée (ha)': '0.3',
      'Densité de semis (valeur)': '60000',
      'Densité de semis (unité)': 'semences/ha',
      "RPG : numéro d'îlot": '7',
      'RPG : numéro de parcelle': '2',
      'RPG : code commune Insee': '64445',
      'Localisation de la surface semée (GPS WGS84)': '45.11111 , 2.22222',
      'Culture': 'Tournesol',
      'Conduite biologique': 'Oui',
    })
    const pdfD = await exportPdfTexte(A, '2026-07-01', '2026-07-01')
    for (const attendu of ['Semis de semences trait', 'SUBSTANCE-SUPPRIMEE', `LOT-SUPPR-D-${suffixe}`, '60000 semences/ha', '45.11111', 'surface sem']) {
      expect(pdfD, `PDF sans « ${attendu} »`).toContain(compact(attendu))
    }

    // C : la ligne du premier test (quantité rectifiée de 1,5 à 1,8 t), supprimée.
    expect(await supprimer(A, idC, 'Suppression C')).toBe(200)
    const csvC = await exportCsv(A, '2026-03-12', '2026-03-12')
    expect(csvC.texte.split('Rectifications et suppressions')[0]).not.toContain(PRODUIT_C)
    const modifC = csvC.rectifications.find((x) => x['Action'] === 'modification')!
    expect(modifC['Quantité de semences ou plants traitée (valeur)']).toBe('1.5')
    const supprC = csvC.rectifications.find((x) => x['Motif'] === 'Suppression C')!
    expect(supprC).toMatchObject({
      "Type d'utilisation": 'Traitement de semences ou de plants',
      'Produit': PRODUIT_C,
      'N° AMM': '2100123',
      'Dose (valeur)': '0.6',
      'Unité de dose': 'L/t',
      'N° lot': 'PLANT-2026-07',
      'Quantité de semences ou plants traitée (valeur)': '1.8',
      'Quantité de semences ou plants traitée (unité)': 't',
      "Localisation de l'installation de traitement (GPS WGS84)": '43.30123 , -0.36988',
      'Surface semée (ha)': '',
      'Culture': 'Pomme de terre (plants)',
      'Conduite biologique': 'Non',
    })
    const pdfC = await exportPdfTexte(A, '2026-03-12', '2026-03-12')
    for (const attendu of ['Traitement de semences ou de plants', '1.8 t', 'PLANT-2026-07', '43.30123']) {
      expect(pdfC, `PDF sans « ${attendu} »`).toContain(compact(attendu))
    }
  })
  // ── Contre-revue ADV251 (tour 3) ──────────────────────────────────────────

  it('changer l\'heure d\'un traitement sans changer son jour civil (fuseau du serveur) garde le contexte figé', async () => {
    // Instants construits dans le fuseau du processus (`jourCivilStocke` lit
    // le jour local : Europe/Paris en production) : le test vaut sous
    // TZ=Europe/Paris comme sous TZ=UTC.
    const midi = new Date(2026, 7, 10, 12, 0)
    const apresMidi = new Date(2026, 7, 10, 16, 30)
    const soir = new Date(2026, 7, 10, 23, 30)
    const lendemainMinuitTrente = new Date(2026, 7, 11, 0, 30)
    const parcelle = await prisma.parcelleGeo.create({
      data: { userId: A, nom: `Parcelle heure ${suffixe}`, geometry: '{"type":"Polygon","coordinates":[]}', commune: 'Essai' },
    })
    const planche = await prisma.planche.create({
      data: { userId: A, nom: `Heure-${suffixe}`, parcelleGeoId: parcelle.id, statutBio: 'AB' },
    })
    const espece = await prisma.espece.create({ data: { userId: A, nom: `Haricot ${suffixe}` } })
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: planche.id } })
    // Traitement saisi horodaté : 10 août 2026 à 12:00 (10:00 UTC à Paris).
    const saisie = await enregistrer(A, {
      date: midi.toISOString(), type: 'traitement_phyto', fait: true, dureeMinutes: 30,
      cultureId: culture.id, plancheId: planche.id, produitPhyto: `HEURE-${suffixe}`, numAMM: '2100555',
      doseAppliquee: 1, uniteDose: 'L/ha', surfaceTraitee: 500,
    })
    expect(saisie.status).toBe(201)
    expect(saisie.json.cultureRegistre).toBe(`Haricot ${suffixe}`)
    expect(saisie.json.conduiteBio).toBe(true)
    const localisationFigee = saisie.json.localisationRegistre as string
    expect(localisationFigee).toContain(`Heure-${suffixe}`)

    // Les fiches changent après la saisie.
    await prisma.planche.update({ where: { id: planche.id }, data: { nom: `HeureRenommée-${suffixe}`, statutBio: 'Conventionnel' } })
    await prisma.espece.update({ where: { id: espece.id }, data: { nom: `Haricot renommé ${suffixe}` } })

    // Heure modifiée, même jour civil (16:30) : contexte inchangé, heure enregistrée.
    const heure = await modifier(A, { id: saisie.json.id, date: apresMidi.toISOString(), doseAppliquee: 1.2, motif: 'Heure corrigée' })
    expect(heure.status).toBe(200)
    expect(new Date(heure.json.date).toISOString()).toBe(apresMidi.toISOString())
    expect(heure.json).toMatchObject({ cultureRegistre: `Haricot ${suffixe}`, localisationRegistre: localisationFigee, conduiteBio: true, doseAppliquee: 1.2 })
    // Même jour renvoyé par le formulaire au format AAAA-MM-JJ : contexte inchangé.
    const jourSeul = await modifier(A, { id: saisie.json.id, date: '2026-08-10', doseAppliquee: 1.3, motif: 'Dose corrigée' })
    expect(jourSeul.status).toBe(200)
    expect(jourSeul.json).toMatchObject({ cultureRegistre: `Haricot ${suffixe}`, localisationRegistre: localisationFigee, conduiteBio: true })
    const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === saisie.json.id)!
    expect(ligne).toMatchObject({ culture: `Haricot ${suffixe}`, conduiteBio: true })

    // 23:30 le 10 août (21:30 UTC à Paris) : même jour, contexte inchangé.
    const tard = await modifier(A, { id: saisie.json.id, date: soir.toISOString(), motif: 'Heure corrigée' })
    expect(tard.status).toBe(200)
    expect(tard.json).toMatchObject({ cultureRegistre: `Haricot ${suffixe}`, localisationRegistre: localisationFigee, conduiteBio: true })

    // Témoin : 00:30 le 11 août (22:30 UTC le 10 à Paris, donc même jour UTC) : jour civil changé, contexte relu.
    const lendemain = await modifier(A, { id: saisie.json.id, date: lendemainMinuitTrente.toISOString(), motif: 'Jour corrigé' })
    expect(lendemain.status).toBe(200)
    expect(lendemain.json).toMatchObject({ cultureRegistre: `Haricot renommé ${suffixe}`, conduiteBio: false })
    expect(lendemain.json.localisationRegistre).toContain(`HeureRenommée-${suffixe}`)
  })

  it('remplacer la seule référence produit recopie nom, AMM et substances du nouveau produit, jamais un mélange', async () => {
    const ancien = await prisma.produitPhyto.create({
      data: { nomCommercial: `REF-ANCIEN-${suffixe}`, substanceActive: 'SUBSTANCE-ANCIENNE', classification: 'Chimique conventionnel', amm: '2100777' },
    })
    const nouveau = await prisma.produitPhyto.create({
      data: { nomCommercial: `REF-NOUVEAU-${suffixe}`, substanceActive: 'SUBSTANCE-NOUVELLE', classification: 'Chimique conventionnel', amm: '2100888' },
    })
    try {
      const saisie = await enregistrer(A, {
        date: '2026-09-02', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees', produitPhytoId: ancien.id,
        densiteSemis: 40, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 1500, gpsLat: 43.6, gpsLng: -0.5,
        cultureRegistre: 'Seigle', conduiteBio: false, intrantNumLot: `LOT-REF-${suffixe}`,
      })
      expect(saisie.status).toBe(201)
      expect(saisie.json).toMatchObject({ produitPhyto: `REF-ANCIEN-${suffixe}`, numAMM: '2100777', substancesActives: 'SUBSTANCE-ANCIENNE' })

      // Seule la référence change : nom, AMM et substances suivent ensemble.
      const r = await modifier(A, { id: saisie.json.id, produitPhytoId: nouveau.id, motif: 'Référence corrigée' })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ produitPhyto: `REF-NOUVEAU-${suffixe}`, numAMM: '2100888', substancesActives: 'SUBSTANCE-NOUVELLE' })
      const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === saisie.json.id)!
      expect(ligne).toMatchObject({ produit: `REF-NOUVEAU-${suffixe}`, numAMM: '2100888', substancesActives: 'SUBSTANCE-NOUVELLE' })
      const csv = await exportCsv(A, '2026-09-02', '2026-09-02')
      const l = csv.ligneDe(`LOT-REF-${suffixe}`)!
      expect(csv.valeur(l, 'Produit')).toBe(`REF-NOUVEAU-${suffixe}`)
      expect(csv.valeur(l, 'N° AMM')).toBe('2100888')
      expect(csv.valeur(l, 'Substance active')).toBe('SUBSTANCE-NOUVELLE')
      // L'état d'avant garde l'ancien produit complet.
      const origine = csv.rectifications.find((x) => x['Motif'] === 'Référence corrigée')!
      expect(origine).toMatchObject({ 'Produit': `REF-ANCIEN-${suffixe}`, 'N° AMM': '2100777', 'Substance active': 'SUBSTANCE-ANCIENNE' })

      // Référence retirée : le cliché reste celui du dernier produit, entier.
      const retiree = await modifier(A, { id: saisie.json.id, produitPhytoId: null, motif: 'Référence retirée' })
      expect(retiree.status).toBe(200)
      expect(retiree.json).toMatchObject({ produitPhytoId: null, produitPhyto: `REF-NOUVEAU-${suffixe}`, numAMM: '2100888', substancesActives: 'SUBSTANCE-NOUVELLE' })

      // Traitement de surface : nom et AMM suivent aussi la référence.
      const surface = await enregistrer(A, {
        date: '2026-09-03', type: 'traitement_phyto', fait: true, dureeMinutes: 20, produitPhytoId: ancien.id,
        doseAppliquee: 1, uniteDose: 'L/ha', surfaceTraitee: 100,
      })
      expect(surface.status).toBe(201)
      const rs = await modifier(A, { id: surface.json.id, produitPhytoId: nouveau.id, motif: 'Référence corrigée A' })
      expect(rs.json).toMatchObject({ produitPhyto: `REF-NOUVEAU-${suffixe}`, numAMM: '2100888' })
    } finally {
      await prisma.intervention.updateMany({ where: { userId: A, produitPhytoId: { in: [ancien.id, nouveau.id] } }, data: { produitPhytoId: null } })
      await prisma.produitPhyto.deleteMany({ where: { id: { in: [ancien.id, nouveau.id] } } })
    }
  })

  it('le SIRET du bénéficiaire d\'une prestation figure au PDF et à l\'export de l\'historique', async () => {
    const SIRET = '11111111100014'
    const c = await enregistrer(A, {
      date: '2026-10-05', type: 'traitement_phyto', fait: true, dureeMinutes: 45, utilisationPhyto: 'traitement_semences',
      produitPhyto: `PRESTA-C-${suffixe}`, numAMM: '2100999', doseAppliquee: 0.5, uniteDose: 'L/t',
      quantiteSemences: 2, uniteQuantiteSemences: 't', gpsLat: 43.1, gpsLng: -0.2,
      cultureRegistre: 'Blé tendre', conduiteBio: false, siretBeneficiaire: SIRET,
    })
    expect(c.status).toBe(201)
    expect(c.json.siretBeneficiaire).toBe(SIRET)
    const csvAvant = await exportCsv(A, '2026-10-05', '2026-10-05')
    expect(csvAvant.valeur(csvAvant.ligneDe(`PRESTA-C-${suffixe}`)!, 'SIRET bénéficiaire (prestation)')).toBe(SIRET)
    expect(await exportPdfTexte(A, '2026-10-05', '2026-10-05')).toContain(SIRET)

    expect(await supprimer(A, c.json.id, 'Prestation annulée')).toBe(200)
    const csv = await exportCsv(A, '2026-10-05', '2026-10-05')
    const origine = csv.rectifications.find((x) => x['Motif'] === 'Prestation annulée')!
    expect(origine['Produit']).toBe(`PRESTA-C-${suffixe}`)
    expect(origine['SIRET bénéficiaire (prestation)']).toBe(SIRET)
    const pdf = await exportPdfTexte(A, '2026-10-05', '2026-10-05')
    expect(pdf).toContain(compact(`PRESTA-C-${suffixe}`))
    expect(pdf).toContain(SIRET)
  })

  it('effacer explicitement la dénomination et la conduite biologique d\'une ligne C ou D les remet « à compléter »', async () => {
    const d = await enregistrer(A, {
      date: '2026-09-20', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      produitPhyto: `EFFACE-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 30, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
      cultureRegistre: 'CULTURE ERRONEE', conduiteBio: true,
    })
    expect(d.status).toBe(201)
    const r = await modifier(A, { id: d.json.id, cultureRegistre: null, conduiteBio: null, motif: 'Mentions incertaines' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ cultureRegistre: null, conduiteBio: null })
    const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === d.json.id)!
    expect(ligne.complet).toBe(false)
  })

  // ---------------------------------------------------------------------
  // Contre-revue ADV34
  // ---------------------------------------------------------------------

  it('ADV34-1 : l\'export filtré sur un lieu garde le périmètre du registre (ni arrosage ni semis ordinaire ; C et D du lieu conservés)', async () => {
    const jour = '2026-10-10'
    const arrosage = `ARROSAGE-HORS-REGISTRE-${suffixe}`
    const ordinaire = `SEMIS-ORDINAIRE-${suffixe}`
    expect((await enregistrer(A, { date: jour, type: 'arrosage', fait: true, plancheId: plancheA, produitPhyto: arrosage })).status).toBe(201)
    expect((await enregistrer(A, { date: jour, type: 'semis', fait: true, plancheId: plancheA, produitPhyto: ordinaire })).status).toBe(201)
    const c = await enregistrer(A, {
      date: jour, type: 'traitement_phyto', fait: true, utilisationPhyto: 'traitement_semences', plancheId: plancheA,
      produitPhyto: `LIEU-C-${suffixe}`, numAMM: '2100123', doseAppliquee: 1, uniteDose: 'L/t',
    })
    const d = await enregistrer(A, {
      date: jour, type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees', plancheId: plancheA,
      produitPhyto: `LIEU-D-${suffixe}`, substancesActives: 'substance fictive',
    })
    expect(c.status).toBe(201)
    expect(d.status).toBe(201)

    for (const filtre of ['', `&parcelleId=${plancheA}`]) {
      identite.userId = A
      const reponse = await exporter(new NextRequest(
        `http://localhost/api/registre-phyto/export?from=${jour}&to=${jour}&format=csv${filtre}`,
      ))
      expect(reponse.status).toBe(200)
      const texte = await reponse.text()
      expect(texte, `filtre « ${filtre} »`).not.toContain(arrosage)
      expect(texte, `filtre « ${filtre} »`).not.toContain(ordinaire)
      expect(texte, `filtre « ${filtre} »`).toContain(`LIEU-C-${suffixe}`)
      expect(texte, `filtre « ${filtre} »`).toContain(`LIEU-D-${suffixe}`)
    }
  })

  it('ADV34-2 : effacer la dénomination d\'un semis lié à une culture la remet « à compléter » (registre, CSV, PDF), renommage d\'espèce sans effet', async () => {
    const espece = await prisma.espece.create({ data: { userId: A, nom: `Seigle fourrager ${suffixe}` } })
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: plancheA } })
    const jour = '2026-10-11'
    const r = await enregistrer(A, {
      date: jour, type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      cultureId: culture.id, produitPhyto: `EFFACE-LIE-${suffixe}`, substancesActives: 'substance fictive',
      conduiteBio: false, densiteSemis: 30, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
    })
    expect(r.status).toBe(201)
    expect(r.json.cultureRegistre).toBe(`Seigle fourrager ${suffixe}`)
    const patch = await modifier(A, { id: r.json.id, cultureRegistre: null, motif: 'Dénomination incertaine' })
    expect(patch.status).toBe(200)
    expect(patch.json.cultureRegistre).toBeNull()
    // Le contexte reste figé (localisation conservée) : ce n'est pas une ligne ancienne.
    expect(patch.json.localisationRegistre).toContain('Planche ')
    await prisma.espece.update({ where: { id: espece.id }, data: { nom: `Espèce renommée ${suffixe}` } })

    const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
    expect(ligne.contexteFige).toBe(true)
    expect(ligne.culture).toBe('Non renseigné')
    expect(ligne.champsManquants).toContain('culture')
    expect(ligne.aCompleter).toContain('Dénomination de la culture')
    expect(ligne.complet).toBe(false)

    const csv = await exportCsv(A, jour, jour)
    expect(csv.valeur(csv.ligneDe(`EFFACE-LIE-${suffixe}`)!, 'Culture')).toBe('')
    // Les colonnes informatives Espèce et Variété restent relues des fiches ;
    // la colonne réglementaire Culture est celle du contexte figé.
    const pdf = await exportPdfTexte(A, jour, jour)
    expect(pdf).toContain(compact(`EFFACE-LIE-${suffixe}`))
    expect(pdf).not.toContain(compact(`Espèce renommée ${suffixe}`))
  })

  it('ADV34-3 : retirer la référence qui donnait la conduite bio ou la dénomination les remet « à compléter » ; une saisie survit', async () => {
    const ab = await prisma.planche.create({ data: { userId: A, nom: `AB-${suffixe}`, statutBio: 'AB' } })
    const neutre1 = await prisma.planche.create({ data: { userId: A, nom: `N1-${suffixe}` } })
    const neutre2 = await prisma.planche.create({ data: { userId: A, nom: `N2-${suffixe}` } })
    const base = {
      date: '2026-10-12', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      substancesActives: 'substance fictive', densiteSemis: 30, uniteDensiteSemis: 'kg/ha',
      surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
    }

    // Conduite bio déduite de la planche AB, dénomination saisie.
    const planche = await enregistrer(A, { ...base, plancheId: ab.id, produitPhyto: `BIO-LIE-${suffixe}`, cultureRegistre: 'Seigle' })
    expect(planche.status).toBe(201)
    expect(planche.json.conduiteBio).toBe(true)
    const sansPlanche = await modifier(A, { id: planche.json.id, plancheId: null, motif: 'Planche retirée' })
    expect(sansPlanche.status).toBe(200)
    expect(sansPlanche.json).toMatchObject({ localisationRegistre: null, conduiteBio: null, cultureRegistre: 'Seigle' })
    const lp = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === planche.json.id)!
    expect(lp.champsManquants).toContain('conduiteBio')
    expect(lp.champsManquants).not.toContain('culture')

    // Dénomination et conduite déduites de la culture (planche AB) : culture retirée.
    const espece = await prisma.espece.create({ data: { userId: A, nom: `Orge ${suffixe}` } })
    const fiche = await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: ab.id } })
    const culture = await enregistrer(A, { ...base, cultureId: fiche.id, produitPhyto: `CULTURE-LIEE-${suffixe}` })
    expect(culture.status).toBe(201)
    expect(culture.json).toMatchObject({ cultureRegistre: `Orge ${suffixe}`, conduiteBio: true })
    const sansCulture = await modifier(A, { id: culture.json.id, cultureId: null, motif: 'Culture retirée' })
    expect(sansCulture.status).toBe(200)
    expect(sansCulture.json).toMatchObject({ cultureRegistre: null, conduiteBio: null })
    const lc = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === culture.json.id)!
    expect(lc.champsManquants).toEqual(expect.arrayContaining(['culture', 'conduiteBio']))
    expect(lc.complet).toBe(false)

    // Valeurs SAISIES (les fiches ne les donnaient pas) : un changement de planche les garde.
    const saisie = await enregistrer(A, {
      ...base, plancheId: neutre1.id, produitPhyto: `SAISIE-${suffixe}`, cultureRegistre: 'Avoine', conduiteBio: false,
    })
    expect(saisie.status).toBe(201)
    const deplace = await modifier(A, { id: saisie.json.id, plancheId: neutre2.id, motif: 'Planche corrigée' })
    expect(deplace.status).toBe(200)
    expect(deplace.json).toMatchObject({ cultureRegistre: 'Avoine', conduiteBio: false })
    expect(deplace.json.localisationRegistre).toContain(`Planche N2-${suffixe}`)
  })

  it('ADV34-4 : convertir une ligne C en traitement de surface en changeant de produit ne garde aucune substance de l\'ancien produit', async () => {
    const ancien = await prisma.produitPhyto.create({
      data: { nomCommercial: `SEMENCES-ANCIEN-${suffixe}`, substanceActive: 'fludioxonil ; métalaxyl-M', amm: '2100555', classification: 'Chimique conventionnel' },
    })
    const nouveau = await prisma.produitPhyto.create({
      data: { nomCommercial: `SURFACE-NEUF-${suffixe}`, substanceActive: 'SUBSTANCE-SURFACE', amm: '2100666', classification: 'Chimique conventionnel' },
    })
    try {
      const jour = '2026-10-13'
      const r = await enregistrer(A, {
        date: jour, type: 'traitement_phyto', fait: true, utilisationPhyto: 'traitement_semences',
        produitPhytoId: ancien.id, cultureRegistre: 'Seigle', conduiteBio: false,
      })
      expect(r.status).toBe(201)
      expect(r.json.substancesActives).toBe('fludioxonil ; métalaxyl-M')
      const patch = await modifier(A, { id: r.json.id, utilisationPhyto: null, produitPhytoId: nouveau.id, motif: 'Correction du type et du produit' })
      expect(patch.status).toBe(200)
      expect(patch.json).toMatchObject({
        utilisationPhyto: null, produitPhyto: `SURFACE-NEUF-${suffixe}`, numAMM: '2100666', substancesActives: 'SUBSTANCE-SURFACE',
      })
      const ligne = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
      expect(ligne).toMatchObject({
        typeUtilisation: 'surface', produit: `SURFACE-NEUF-${suffixe}`, numAMM: '2100666', substanceActive: 'SUBSTANCE-SURFACE',
      })
      const csv = await exportCsv(A, jour, jour)
      const l = csv.ligneDe(`SURFACE-NEUF-${suffixe}`)!
      expect(csv.valeur(l, 'Substance active')).toBe('SUBSTANCE-SURFACE')
      expect(csv.valeur(l, 'N° AMM')).toBe('2100666')
      expect(l).not.toContain('fludioxonil')
    } finally {
      const ids = [ancien.id, nouveau.id]
      await prisma.intervention.updateMany({ where: { userId: A, produitPhytoId: { in: ids } }, data: { produitPhytoId: null } })
      await prisma.produitPhyto.deleteMany({ where: { id: { in: ids } } })
    }
  })

  // ---------------------------------------------------------------------
  // Contre-revue ADV89 (et QA88) : contexte vidé, provenance des mentions
  // ---------------------------------------------------------------------

  it('ADV89-1 : une dénomination effacée reste effacée quand les trois mentions du contexte deviennent nulles (registre, CSV, relecture)', async () => {
    const espece = await prisma.espece.create({ data: { userId: A, nom: `EFFACEMENT-SANS-LIEU-${suffixe}` } })
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id } })
    const r = await enregistrer(A, {
      date: '2026-10-14', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      cultureId: culture.id, produitPhyto: `SANS-LIEU-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 30, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({
      cultureRegistre: `EFFACEMENT-SANS-LIEU-${suffixe}`, localisationRegistre: null, conduiteBio: null,
      contexteFige: true, origineCultureRegistre: 'deduite',
    })
    const patch = await modifier(A, { id: r.json.id, cultureRegistre: null, motif: 'Dénomination incertaine' })
    expect(patch.status).toBe(200)
    const stockee = await prisma.intervention.findFirstOrThrow({ where: { id: r.json.id, userId: A } })
    expect([stockee.cultureRegistre, stockee.localisationRegistre, stockee.conduiteBio]).toEqual([null, null, null])
    expect(stockee).toMatchObject({ contexteFige: true, origineCultureRegistre: 'saisie' })

    const l = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
    expect(l.contexteFige).toBe(true)
    expect(l.culture).toBe('Non renseigné')
    expect(l.champsManquants).toEqual(expect.arrayContaining(['culture', 'conduiteBio']))
    expect(l.aCompleter).toContain('Dénomination de la culture')
    expect(l.complet).toBe(false)
    const csv = await exportCsv(A, '2026-10-14', '2026-10-14')
    expect(csv.valeur(csv.ligneDe(`SANS-LIEU-${suffixe}`)!, 'Culture')).toBe('')

    // Une rectification ultérieure sans changement de lieu ni de jour ne
    // relit pas les fiches : la ligne n'est pas « jamais figée ».
    const densite = await modifier(A, { id: r.json.id, densiteSemis: 32, motif: 'Densité corrigée' })
    expect(densite.status).toBe(200)
    expect(densite.json.cultureRegistre).toBeNull()
    // Le jour change : le contexte est relu, la saisie vidée reste vidée
    // (même culture référencée).
    const jour = await modifier(A, { id: r.json.id, date: '2026-10-15', motif: 'Jour corrigé' })
    expect(jour.status).toBe(200)
    expect(jour.json).toMatchObject({ cultureRegistre: null, origineCultureRegistre: 'saisie', contexteFige: true })
  })

  it('ADV89-2 : une valeur déduite perd sa source au retrait, même si la fiche source a changé entre-temps', async () => {
    const ab = await prisma.planche.create({ data: { userId: A, nom: `SOURCE-AB-${suffixe}`, statutBio: 'AB' } })
    const espece = await prisma.espece.create({ data: { userId: A, nom: `CULTURE-SOURCE-${suffixe}` } })
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: ab.id } })
    const r = await enregistrer(A, {
      date: '2026-10-15', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      cultureId: culture.id, produitPhyto: `SOURCE-MODIFIEE-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 30, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({
      cultureRegistre: `CULTURE-SOURCE-${suffixe}`, conduiteBio: true,
      origineCultureRegistre: 'deduite', origineConduiteBio: 'deduite',
    })
    await prisma.espece.update({ where: { id: espece.id }, data: { nom: `SOURCE-RENOMMEE-${suffixe}` } })
    await prisma.planche.update({ where: { id: ab.id }, data: { statutBio: 'Conventionnel' } })
    const patch = await modifier(A, { id: r.json.id, cultureId: null, motif: 'Culture retirée' })
    expect(patch.status).toBe(200)
    expect(patch.json).toMatchObject({ cultureId: null, cultureRegistre: null, conduiteBio: null })
    const l = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
    expect(l.champsManquants).toEqual(expect.arrayContaining(['culture', 'conduiteBio']))
    expect(l.complet).toBe(false)
    const csv = await exportCsv(A, '2026-10-15', '2026-10-15')
    expect(csv.valeur(csv.ligneDe(`SOURCE-MODIFIEE-${suffixe}`)!, 'Culture')).toBe('')
  })

  it('ADV89-2 : une saisie explicite survit au retrait de la référence, même quand la fiche donnait une autre valeur', async () => {
    const ab = await prisma.planche.create({ data: { userId: A, nom: `SAISIE-AB-${suffixe}`, statutBio: 'AB' } })
    const espece = await prisma.espece.create({ data: { userId: A, nom: `FICHE-${suffixe}` } })
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: ab.id } })
    const r = await enregistrer(A, {
      date: '2026-10-16', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      cultureId: culture.id, produitPhyto: `SAISIE-PRIME-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 30, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
      cultureRegistre: 'Blé tendre (lot semencier)', conduiteBio: false,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({
      cultureRegistre: 'Blé tendre (lot semencier)', conduiteBio: false,
      origineCultureRegistre: 'saisie', origineConduiteBio: 'saisie',
    })
    const patch = await modifier(A, { id: r.json.id, cultureId: null, motif: 'Culture retirée' })
    expect(patch.status).toBe(200)
    expect(patch.json).toMatchObject({ cultureRegistre: 'Blé tendre (lot semencier)', conduiteBio: false })
    const l = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
    expect(l.champsManquants).not.toContain('culture')
    expect(l.champsManquants).not.toContain('conduiteBio')
  })

  it('ligne enregistrée sans provenance : au retrait de la référence, ses mentions repassent « à compléter » (stratégie prudente)', async () => {
    const ab = await prisma.planche.create({ data: { userId: A, nom: `ANCIENNE-AB-${suffixe}`, statutBio: 'AB' } })
    const espece = await prisma.espece.create({ data: { userId: A, nom: `ANCIENNE-${suffixe}` } })
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id, plancheId: ab.id } })
    const r = await enregistrer(A, {
      date: '2026-10-17', type: 'semis', fait: true, utilisationPhyto: 'semis_semences_traitees',
      cultureId: culture.id, produitPhyto: `SANS-PROVENANCE-${suffixe}`, substancesActives: 'substance fictive',
      densiteSemis: 30, uniteDensiteSemis: 'kg/ha', surfaceTraitee: 800, gpsLat: 43.7, gpsLng: -0.6,
    })
    expect(r.status).toBe(201)
    // État d'une ligne écrite avant le suivi de provenance (colonnes par défaut de la migration).
    await prisma.intervention.update({
      where: { id: r.json.id, userId: A },
      data: { contexteFige: false, origineCultureRegistre: null, origineConduiteBio: null },
    })
    const avant = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
    expect(avant.contexteFige).toBe(true) // mentions enregistrées : figée sans marqueur
    const patch = await modifier(A, { id: r.json.id, cultureId: null, motif: 'Culture retirée' })
    expect(patch.status).toBe(200)
    expect(patch.json).toMatchObject({ cultureRegistre: null, conduiteBio: null, contexteFige: true })
  })

  it('ADV158-1 : supprimer l\'arbre garde le contexte C explicitement vidé (mentions nulles, figé, « à compléter » au registre et à l\'export)', async () => {
    const espece = await prisma.espece.create({ data: { userId: A, nom: `CULTURE-VIDEE-${suffixe}` } })
    // Culture sans planche, arbre sans GPS ni parcelle : aucune localisation déductible.
    const culture = await prisma.culture.create({ data: { userId: A, especeId: espece.id } })
    const arbre = await prisma.arbre.create({ data: { userId: A, nom: `ARBRE-ESSAI-${suffixe}`, type: 'fruitier', posX: 0, posY: 0 } })
    const produit = `CONTEXTE-C-${suffixe}`
    const r = await enregistrer(A, {
      date: '2026-10-16', type: 'traitement_phyto', fait: true, utilisationPhyto: 'traitement_semences',
      cultureId: culture.id, arbreId: arbre.id, produitPhyto: produit,
      quantiteSemences: 10, uniteQuantiteSemences: 'kg', doseAppliquee: 2, uniteDose: 'L/t',
      gpsLat: 43.7, gpsLng: -0.6,
    })
    expect(r.status).toBe(201)
    expect(r.json.localisationRegistre).toBeNull()
    const vide = await modifier(A, { id: r.json.id, cultureRegistre: null, conduiteBio: null, motif: 'Mention incertaine' })
    expect(vide.status).toBe(200)
    expect(vide.json).toMatchObject({ contexteFige: true, cultureRegistre: null, localisationRegistre: null, conduiteBio: null })

    identite.userId = A
    const suppression = await supprimerArbre(
      new NextRequest(`http://localhost/api/arbres/${arbre.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(arbre.id) }) },
    )
    expect(suppression.status).toBe(200)

    const stockee = await prisma.intervention.findFirstOrThrow({ where: { id: r.json.id, userId: A } })
    expect(stockee.arbreId).toBeNull()
    expect([stockee.cultureRegistre, stockee.localisationRegistre, stockee.conduiteBio]).toEqual([null, null, null])
    expect(stockee).toMatchObject({ contexteFige: true, origineCultureRegistre: 'saisie', origineConduiteBio: 'saisie' })

    const l = (await genererRegistrePhyto(A, 2026)).registre.find((l) => l.id === r.json.id)!
    expect(l.contexteFige).toBe(true)
    expect(l.culture).toBe('Non renseigné')
    expect(l.champsManquants).toEqual(expect.arrayContaining(['culture', 'conduiteBio']))
    expect(l.aCompleter).toContain('Dénomination de la culture')
    expect(l.complet).toBe(false)
    const csv = await exportCsv(A, '2026-10-16', '2026-10-16')
    expect(csv.valeur(csv.ligneDe(produit)!, 'Culture')).toBe('')
  })

  it('ADV248-1 : suppression concurrente relit le semis devenu D avant de conserver son état', async () => {
    const produit = `COURSE-D-${suffixe}`
    const creation = await enregistrer(A, { date: '2026-10-17', type: 'semis', fait: true, dureeMinutes: 20, cultureId: cultureA })
    expect(creation.status).toBe(201)
    const interventionId = creation.json.id
    const transaction = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>
    let signalLecture!: () => void
    let debloquer!: () => void
    const lue = new Promise<void>(r => { signalLecture = r })
    const reprise = new Promise<void>(r => { debloquer = r })
    let retenir = true
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation((async (...args: unknown[]) => {
      if (retenir) { retenir = false; signalLecture(); await reprise }
      return transaction(...args)
    }) as unknown as typeof prisma.$transaction)
    let suppression: Promise<number> | undefined
    try {
      suppression = supprimer(A, interventionId, 'Suppression demandée en parallèle de la correction')
      await lue
      const correction = await modifier(A, {
        id: interventionId, utilisationPhyto: 'semis_semences_traitees', produitPhyto: produit,
        substancesActives: 'Substance course fictive', intrantNumLot: 'LOT-COURSE-FICTIF',
        surfaceTraitee: 100, densiteSemis: 20, uniteDensiteSemis: 'kg/ha', gpsLat: 43.5, gpsLng: -0.4,
      })
      expect(correction.status).toBe(200)
      expect(correction.json.utilisationPhyto).toBe('semis_semences_traitees')
      debloquer()
      const statutSuppression = await suppression
      const historique = await prisma.registrePhytoHistorique.findMany({ where: { userId: A, source: 'intervention', sourceId: interventionId } })
      const restante = await prisma.intervention.findFirst({ where: { userId: A, id: interventionId } })
      const csv = await exportCsv(A, '2026-10-17', '2026-10-17')
      console.log('ADV248-1', JSON.stringify({ creation: creation.status, correction: correction.status, suppression: statutSuppression, restante, nombreHistorique: historique.length, produitDansExport: csv.texte.includes(produit) }))
      expect(statutSuppression).toBe(200)
      expect(restante).toBeNull()
      expect(historique).toHaveLength(1)
      expect(historique[0].avant).toMatchObject({ utilisationPhyto: 'semis_semences_traitees', produitPhyto: produit })
      expect(csv.texte).toContain(produit)
    } finally {
      debloquer()
      await suppression
      spy.mockRestore()
    }
  })
})
