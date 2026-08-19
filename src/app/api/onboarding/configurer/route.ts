/**
 * POST /api/onboarding/configurer — écritures du parcours de première connexion.
 *
 * Refonte 2026-08-17. Une seule route, un payload par étape, chaque étape
 * IDEMPOTENTE : le wizard persiste sa progression et se reprend après un
 * abandon (invariant du 2026-08-06), donc rejouer une étape ne doit jamais
 * dupliquer une parcelle, une planche, un arbre ou un lot.
 *
 *   { etape: "exploitation", nomExploitation?, commune?, zoneClimat? }
 *      → Exploitation minimale (codePostal/ville), parcelle géolocalisée à la
 *        commune (créée, ou RECALÉE si le compte n'a que le décor Paris),
 *        surcharge éventuelle de la zone climatique.
 *   { etape: "production", planche?, arbre?, cheptel? }
 *      → crée réellement ce que l'ancien wizard collectait puis jetait.
 *   { etape: "exemple", avecExemple }
 *      → décor de démonstration ANCRÉ sur la parcelle de l'utilisateur et
 *        borné à ses modules actifs — plus jamais Paris 4ᵉ d'office.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { ZONES_CLIMAT, type ZoneClimat } from '@/lib/terroir'
import { estCentroidExemple } from '@/lib/localisation-exemple'
import { normaliserLibelle } from '@/lib/libelle-libre'
import { sanitizeModulesActifs } from '@/lib/modules'
import {
  CHEPTEL_ONBOARDING,
  coordonneesValides,
  libelleCheptel,
  parcelleCarreeAutour,
  TYPES_SOL_ONBOARDING,
} from '@/lib/onboarding-config'

const communeSchema = z.object({
  nom: z.string().min(1).max(200),
  codePostal: z.string().max(10).optional().nullable(),
  lat: z.number(),
  lng: z.number(),
})

const exploitationSchema = z.object({
  etape: z.literal('exploitation'),
  nomExploitation: z.string().max(200).optional().nullable(),
  commune: communeSchema.optional().nullable(),
  zoneClimat: z.enum(ZONES_CLIMAT).optional().nullable(),
})

const productionSchema = z.object({
  etape: z.literal('production'),
  planche: z
    .object({
      nom: z.string().min(1).max(100),
      longueur: z.number().positive().max(1000).optional().nullable(),
      largeur: z.number().positive().max(100).optional().nullable(),
      typeSol: z.enum(TYPES_SOL_ONBOARDING).optional().nullable(),
    })
    .optional()
    .nullable(),
  arbre: z
    .object({
      espece: z.string().min(1).max(120),
      nom: z.string().max(120).optional().nullable(),
    })
    .optional()
    .nullable(),
  cheptel: z
    .array(
      z.object({
        especeAnimaleId: z.string().min(1),
        effectif: z.number().int().min(1).max(100_000),
      }),
    )
    .max(CHEPTEL_ONBOARDING.length)
    .optional()
    .nullable(),
})

const exempleSchema = z.object({
  etape: z.literal('exemple'),
  avecExemple: z.boolean(),
})

const payloadSchema = z.discriminatedUnion('etape', [
  exploitationSchema,
  productionSchema,
  exempleSchema,
])

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const parsed = payloadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const d = parsed.data

    if (d.etape === 'exploitation') {
      return NextResponse.json(await etapeExploitation(userId, d))
    }
    if (d.etape === 'production') {
      return NextResponse.json(await etapeProduction(userId, d))
    }
    return NextResponse.json(await etapeExemple(userId, d.avecExemple))
  } catch (err) {
    console.error('POST /api/onboarding/configurer error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Étape « exploitation » : nom, commune, zone climatique
// ---------------------------------------------------------------------------

async function etapeExploitation(
  userId: string,
  d: z.infer<typeof exploitationSchema>,
) {
  const nom = normaliserLibelle(d.nomExploitation) ?? null
  const commune = d.commune ?? null

  const resultat = {
    parcelle: null as null | { id: string; nom: string; action: 'creee' | 'recalee' | 'existante' },
    zoneClimat: null as ZoneClimat | null,
  }

  await prisma.$transaction(async (tx) => {
    // 1. Exploitation minimale : le siège porte le code postal, dont dérive la
    // zone climatique (terroirDeUser). Ne jamais écraser une saisie existante.
    const existante = await tx.exploitation.findUnique({ where: { userId } })
    if (!existante) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      })
      await tx.exploitation.create({
        data: {
          userId,
          raisonSociale: nom || user?.name || 'Mon exploitation',
          formeJuridique: 'EI',
          regimeFiscal: 'micro-BA',
          regimeTva: 'franchise-293b',
          adresseSiege: '',
          codePostal: commune?.codePostal ?? '',
          ville: commune?.nom ?? '',
          emailContact: user?.email ?? '',
        },
      })
    } else {
      const data: Record<string, string> = {}
      if (nom && !existante.raisonSociale?.trim()) data.raisonSociale = nom
      if (commune?.codePostal && !existante.codePostal?.trim()) data.codePostal = commune.codePostal
      if (commune?.nom && !existante.ville?.trim()) data.ville = commune.nom
      if (Object.keys(data).length > 0) {
        await tx.exploitation.update({ where: { userId }, data })
      }
    }

    // 2. Parcelle géolocalisée — l'ancrage de la météo, de l'irrigation, des
    // éphémérides et de Hub'Eau. Créée au centre de la commune, à affiner sur
    // la carte. Si le compte ne possède QUE le décor Paris (comptes d'avant la
    // refonte qui repassent ici), on le recale au lieu d'en créer une seconde.
    if (commune && coordonneesValides(commune.lat, commune.lng)) {
      const carre = parcelleCarreeAutour(commune.lat, commune.lng)
      const notes = `Position approximative : centre de ${commune.nom}. Affinez le contour depuis la carte.`
      const parcelles = await tx.parcelleGeo.findMany({
        where: { userId },
        select: { id: true, nom: true, centroidLat: true, centroidLng: true },
      })
      const decorParis = parcelles.find((p) => estCentroidExemple(p.centroidLat, p.centroidLng))

      if (parcelles.length === 0) {
        const creee = await tx.parcelleGeo.create({
          data: {
            userId,
            nom: nom || 'Mon exploitation',
            geometry: carre.geometry,
            centroidLat: carre.centroidLat,
            centroidLng: carre.centroidLng,
            surface: carre.surfaceHa,
            commune: commune.nom,
            usage: 'culture',
            couleur: '#4ade80',
            notes,
          },
        })
        resultat.parcelle = { id: creee.id, nom: creee.nom, action: 'creee' }
      } else if (decorParis) {
        await tx.parcelleGeo.update({
          where: { id: decorParis.id },
          data: {
            geometry: carre.geometry,
            centroidLat: carre.centroidLat,
            centroidLng: carre.centroidLng,
            commune: commune.nom,
            notes,
          },
        })
        resultat.parcelle = { id: decorParis.id, nom: decorParis.nom, action: 'recalee' }
      } else {
        // Des parcelles réelles existent déjà : on ne touche à rien.
        resultat.parcelle = { id: parcelles[0].id, nom: parcelles[0].nom, action: 'existante' }
      }
    }

    // 3. Surcharge explicite de la zone climatique. En son absence, la
    // dérivation automatique (code postal, puis centroïde) fait foi.
    if (d.zoneClimat) {
      await tx.user.update({ where: { id: userId }, data: { zoneClimat: d.zoneClimat } })
      resultat.zoneClimat = d.zoneClimat
    }
  })

  return resultat
}

// ---------------------------------------------------------------------------
// Étape « production » : planche / arbre / cheptel réellement créés
// ---------------------------------------------------------------------------

async function etapeProduction(userId: string, d: z.infer<typeof productionSchema>) {
  const resultat = {
    planche: null as null | { id: string; nom: string },
    arbre: null as null | { id: number; nom: string },
    lots: [] as { id: number; nom: string; effectif: number }[],
  }

  // Parcelle d'ancrage (créée à l'étape exploitation, s'il y en a une).
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  // Planche — seulement si le compte n'en a encore aucune (garde de reprise).
  if (d.planche) {
    const nomPlanche = normaliserLibelle(d.planche.nom)
    const dejaUnePlanche = await prisma.planche.count({ where: { userId } })
    if (nomPlanche && dejaUnePlanche === 0) {
      const longueur = d.planche.longueur ?? null
      const largeur = d.planche.largeur ?? null
      const creee = await prisma.planche.create({
        data: {
          userId,
          nom: nomPlanche,
          longueur,
          largeur,
          surface: longueur && largeur ? Math.round(longueur * largeur * 100) / 100 : null,
          typeSol: d.planche.typeSol ?? null,
          parcelleGeoId: parcelle?.id ?? null,
        },
      })
      resultat.planche = { id: creee.id, nom: creee.nom }
    }
  }

  // Arbre — l'ancien wizard collectait l'espèce puis la jetait.
  if (d.arbre) {
    const espece = normaliserLibelle(d.arbre.espece)
    const dejaUnArbre = await prisma.arbre.count({ where: { userId } })
    if (espece && dejaUnArbre === 0) {
      // Rattacher au référentiel officiel quand l'espèce y figure (id = nom).
      const officielle = await prisma.espece.findFirst({
        where: { id: espece, userId: null },
        select: { id: true },
      })
      const creee = await prisma.arbre.create({
        data: {
          userId,
          nom: normaliserLibelle(d.arbre.nom) || espece,
          type: 'fruitier',
          espece,
          especeId: officielle?.id ?? null,
          parcelleGeoId: parcelle?.id ?? null,
          // Position sur le plan 2D : origine par défaut, comme POST /api/arbres.
          posX: 0,
          posY: 0,
          // Sans date de plantation on ne présume rien : jamais « productif »
          // à l'aveugle (invariant du 2026-08-12, le défaut Prisma étant true).
          productif: false,
        },
      })
      resultat.arbre = { id: creee.id, nom: creee.nom }
    }
  }

  // Cheptel — un lot par espèce cochée, avec effectif. Garde par espèce.
  for (const entree of d.cheptel ?? []) {
    const catalogue = CHEPTEL_ONBOARDING.find(
      (c) => c.especeAnimaleId === entree.especeAnimaleId,
    )
    if (!catalogue) continue // hors catalogue express : ignoré, pas d'erreur
    const dejaUnLot = await prisma.lotAnimaux.count({
      where: { userId, especeAnimaleId: catalogue.especeAnimaleId },
    })
    if (dejaUnLot > 0) continue
    const lot = await prisma.lotAnimaux.create({
      data: {
        userId,
        especeAnimaleId: catalogue.especeAnimaleId,
        nom: catalogue.libelle,
        quantiteInitiale: entree.effectif,
        quantiteActuelle: entree.effectif,
        statut: 'actif',
        dateArrivee: new Date(),
        notes: `Créé à la configuration initiale (${libelleCheptel(catalogue.especeAnimaleId)}). Affinez la race depuis la fiche du lot.`,
      },
    })
    resultat.lots.push({ id: lot.id, nom: lot.nom ?? catalogue.libelle, effectif: entree.effectif })
  }

  return resultat
}

// ---------------------------------------------------------------------------
// Étape « exemple » : décor de démonstration, sur choix explicite
// ---------------------------------------------------------------------------

async function etapeExemple(userId: string, avecExemple: boolean) {
  if (!avecExemple) return { exemple: 'refuse' as const }

  const [prefModules, nbCultures, nbArbres, parcelle] = await Promise.all([
    prisma.userPreference.findUnique({
      where: { userId_key: { userId, key: 'modulesActifs' } },
    }),
    prisma.culture.count({ where: { userId } }),
    prisma.arbre.count({ where: { userId } }),
    prisma.parcelleGeo.findFirst({
      where: { userId },
      orderBy: { id: 'asc' },
      select: { id: true },
    }),
  ])

  let modules: ReturnType<typeof sanitizeModulesActifs>
  try {
    modules = sanitizeModulesActifs(prefModules ? JSON.parse(prefModules.value) : null)
  } catch {
    modules = sanitizeModulesActifs(null)
  }

  // Gardes de reprise : le décor maraîchage ne se rejoue pas sur un compte qui
  // a déjà des cultures, ni le décor verger sur un compte qui a déjà un arbre
  // (y compris celui saisi à l'étape production).
  const avecMaraichage = modules.includes('maraichage') && nbCultures === 0
  const avecVerger = modules.includes('verger') && nbArbres === 0
  if (!avecMaraichage && !avecVerger) {
    return { exemple: 'sans_objet' as const }
  }

  const { createSampleDataForUser } = await import('@/lib/user-sample-data')
  await createSampleDataForUser(userId, {
    parcelleGeoId: parcelle?.id ?? null,
    avecMaraichage,
    avecVerger,
  })
  return { exemple: 'cree' as const, avecMaraichage, avecVerger }
}
