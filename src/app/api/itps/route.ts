/**
 * API Routes pour les ITPs (Itinéraires Techniques de Plantes)
 * GET /api/itps - Liste des ITPs (referentiel global)
 * POST /api/itps - Créer un ITP
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createITPSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import { statsAvisPourRefs } from '@/lib/avis/stats-liste'
import { visibiliteReferentiel, attributionCreation } from '@/lib/referentiel-communaute'
import { normalizeReferentielKey } from '@/lib/normalize'
import {
  conflitNomItp,
  doublonVisibleItp,
  estConflitPeriodeItp,
  itpMemePeriode,
  messageConflitNomItp,
  messageConflitPeriodeItp,
  nomItpDepuisSaisie,
} from '@/lib/itp-nom'
import { zoneEffectiveUser } from '@/lib/terroir'
import { appliquerDecalageItp, decalageItpPourLecteur } from '@/lib/calendrier-climat'
import { whereItpApplicable, whereItpUtilisable } from '@/lib/itp-acces'

const SORT_FIELDS = new Set([
  'id',
  'nom',
  'especeId',
  'semaineSemis',
  'semainePlantation',
  'semaineRecolte',
  'typePlanche',
  'statutValidation',
  'confiance',
])

/**
 * Ordre de confiance du catalogue : références sourcées d'abord, puis le
 * catalogue Gleba officiel, puis les contributions de membres.
 *
 * Les huit sélecteurs d'ITP de l'application demandaient
 * `sortBy=statutValidation&sortOrder=desc`, un tri ALPHABÉTIQUE sur les valeurs
 * `source_documentee` / `personnel` / `a_revoir` : l'itinéraire personnel d'un
 * membre, partagé à la communauté, passait donc devant les 218 références
 * officielles « à confirmer », en tête de liste et sans rien qui le signale.
 * L'ordre voulu n'est pas exprimable sur cette colonne : on le tire de deux
 * colonnes qui le portent réellement.
 */
const ORDRE_CONFIANCE: Prisma.ITPOrderByWithRelationInput[] = [
  { sourceRecordId: { sort: 'asc', nulls: 'last' } },
  { userId: { sort: 'asc', nulls: 'first' } },
  { statutValidation: 'desc' },
  { id: 'asc' },
]

function positiveInteger(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

// GET /api/itps - Référentiel global (lecture)
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = positiveInteger(searchParams.get('page'), 1, 100_000)
    const pageSize = positiveInteger(searchParams.get('pageSize'), 50, 1000)
    const skip = (page - 1) * pageSize

    // Tri
    const requestedSort = searchParams.get('sortBy') || 'id'
    const sortBy = SORT_FIELDS.has(requestedSort) ? requestedSort : 'id'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'

    // Filtres
    const search = searchParams.get('search') || ''
    const especeId = searchParams.get('especeId')
    const typePlanche = searchParams.get('typePlanche')
    const statutValidation = searchParams.get('statutValidation')
    const applicable = searchParams.get('applicable') === '1'
    const calibrer = searchParams.get('calibre') === '1'
    const userZone = applicable || calibrer
      ? await zoneEffectiveUser(prisma, userId)
      : null

    // Construction du where
    const where: Prisma.ITPWhereInput = {}

    if (search) {
      // QA cmswxyuoi — la recherche était sensible à la ponctuation : chercher
      // « TEST-Marc-Phacelie-v7 » ne trouvait pas « TEST Marc Phacelie v7 »
      // (et réciproquement). La colonne `nomNormalise` existe précisément pour
      // comparer sans tiret, underscore, accent ni casse : on l'interroge avec
      // la même normalisation appliquée à la saisie.
      // Une saisie qui se réduit à de la ponctuation (« - ») donne une clé VIDE,
      // et `contains: ''` rend tout le catalogue : on n'ajoute alors pas ce
      // critère.
      const cleNormalisee = normalizeReferentielKey(search)
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { nom: { contains: search, mode: 'insensitive' } },
        ...(cleNormalisee ? [{ nomNormalise: { contains: cleNormalisee } }] : []),
        { notes: { contains: search, mode: 'insensitive' } },
        { sourceReference: { contains: search, mode: 'insensitive' } },
        { contexteClimatique: { contains: search, mode: 'insensitive' } },
        { espece: { id: { contains: search, mode: 'insensitive' } } },
        { espece: { nom: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (especeId) {
      where.especeId = especeId
    }
    if (typePlanche) {
      where.typePlanche = typePlanche
    }
    if (statutValidation) {
      where.statutValidation = statutValidation
    }

    if (applicable) {
      where.AND = [whereItpApplicable(userZone)]
    }

    // Visibilité catalogue communautaire : Gleba officiel (userId null) +
    // communauté (partagé par un membre) + mes propres ITP perso. Jamais le
    // perso privé d'un autre. On combine avec les filtres existants via AND.
    const whereVisible: Prisma.ITPWhereInput = {
      AND: [where, whereItpUtilisable(userId)],
    }

    // Audit Marc 2026-05-14 — Bug 13 : "ITP Tomate hâtive serre · 3
    // cultures affichées (réel = 2)". Le `_count.cultures` était global,
    // ce qui agrégeait les cultures des autres tenants (comptes démo).
    // On filtre désormais sur l'utilisateur courant.
    const [itps, total] = await Promise.all([
      prisma.iTP.findMany({
        where: whereVisible,
        include: {
          espece: {
            include: {
              famille: true,
            },
          },
          _count: {
            select: {
              cultures: { where: { userId } },
              rotationsDetails: true,
            },
          },
        },
        orderBy: sortBy === 'confiance' ? ORDRE_CONFIANCE : { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.iTP.count({ where: whereVisible }),
    ])

    // Avis communautaires (opt-in via ?avis=1)
    const includeAvis = searchParams.get('avis') === '1'
    const statsMap = includeAvis
      ? await statsAvisPourRefs(prisma, 'ITP', itps.map((i) => i.id))
      : null
    let data = statsMap
      ? itps.map((i) => ({ ...i, avisStats: statsMap.get(i.id) }))
      : itps

    // `calibre=1` sert aux écrans qui transforment directement les semaines en
    // dates de culture. Le référentiel reste stocké dans son climat source ;
    // seule la réponse est convertie vers la zone de l'exploitation.
    if (calibrer) {
      data = data.map((itp) => {
        // QA cmsqmujo9 — un ITP perso sans zone de calage appartient à quelqu'un
        // qui a saisi ses semaines dans SON climat : aucun décalage pour son
        // auteur. Cette exception vit désormais dans `decalageItpPourLecteur`,
        // partagée avec la planification, les notifications et les calendriers,
        // qui l'ignoraient tous (le même ITP n'avait pas les mêmes semaines
        // selon l'écran).
        const decalage = decalageItpPourLecteur(itp, userZone, userId)
        return {
          ...appliquerDecalageItp(itp, decalage),
          decalageClimatiqueApplique: decalage,
          zoneClimatCible: userZone,
        }
      })
    }

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/itps error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des ITPs', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// POST /api/itps
// - Admin : crée un ITP du catalogue Gleba officiel (userId null).
// - Utilisateur : crée un ITP perso (userId = lui), proposé à la communauté
//   (partageCommunaute=true) ou gardé privé (false).
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const body = await request.json()

    // Validation
    const validationResult = createITPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // `data.id` porte le NOM saisi. Le nom affiché vit dans `nom` ; l'id technique
    // dépend de l'origine (officiel = nom lisible, perso = cuid).
    // QA cmswxyuoi — le libellé est conservé TEL QUE SAISI (tirets compris) ;
    // seule la clé de dédup normalise la ponctuation. Avant, un nom
    // « TEST-Marc-Phacelie-v7 » était stocké « TEST Marc Phacelie v7 » et
    // devenait introuvable par le nom tapé.
    const { nom: nomSaisi, nomNormalise } = nomItpDepuisSaisie(data.id)
    const attrib = attributionCreation(isAdmin, session!.user.id, body.partageCommunaute === true)
    const estOfficiel = attrib.userId === null

    // Dédup : même règle qu'au renommage (cf. src/lib/itp-nom.ts).
    const conflit = await conflitNomItp(prisma, {
      nom: nomSaisi,
      nomNormalise,
      proprietaireId: attrib.userId,
    })
    if (conflit) {
      return NextResponse.json(
        { error: messageConflitNomItp(conflit, estOfficiel), conflit: conflit.id },
        { status: 409 }
      )
    }

    // Vérifier que l'espece existe si fournie + cohérence du type de culture
    // (Audit Marc Bug F : un semis_direct ne doit pas avoir de plantation,
    // sinon le trigger PG la met à NULL silencieusement — on rejette en
    // 400 plutôt avec un message clair côté UI).
    if (data.especeId) {
      // L'espèce parente doit être VISIBLE (sinon rattachement/divulgation d'un privé d'autrui).
      const espece = await prisma.espece.findFirst({
        where: { AND: [{ id: data.especeId }, visibiliteReferentiel(session!.user.id)] },
        select: { id: true, typeCultureSemis: true },
      })
      if (!espece) {
        return NextResponse.json(
          { error: `L'espèce "${data.especeId}" n'existe pas` },
          { status: 400 }
        )
      }
      if (espece.typeCultureSemis === 'semis_direct' && data.semainePlantation != null) {
        return NextResponse.json(
          {
            error: `L'espèce "${data.especeId}" est en semis direct (racine pivot ou semis en place). Le champ Plantation doit être vide.`,
          },
          { status: 400 }
        )
      }
    }

    // Zone de calage. Si non précisée par un membre en zone d'outre-mer, on
    // hérite de SA zone : sinon son ITP (zoneClimat null = référentiel métropole)
    // serait masqué de son propre calendrier, qui n'affiche que les ITP de sa zone.
    // Les ITP officiels (admin) gardent la valeur transmise (null par défaut).
    let zoneClimat = data.zoneClimat ?? null
    if (zoneClimat == null && !estOfficiel) {
      // QA cmsqmujo9 — un ITP perso sans zone était réputé calé sur le
      // référentiel métropole (océanique altéré) puis TRANSPOSÉ vers la zone
      // de son auteur : S10 saisi devenait S9 partout (liste, cultures
      // générées) sans un mot. Or les semaines d'un ITP personnel décrivent
      // la pratique de l'auteur DANS SON climat : on le cale sur sa zone,
      // le décalage devient nul pour lui (et correct pour les autres zones).
      const zone = await zoneEffectiveUser(prisma, session!.user.id)
      if (zone) {
        zoneClimat = zone
      }
    }

    // Création : officiel → id = nom lisible ; perso → id omis → cuid (@default).
    const { id: _nomBrut, ...rest } = data
    void _nomBrut
    const itp = await prisma.iTP.create({
      data: {
        ...rest,
        ...(estOfficiel ? { id: nomSaisi } : {}),
        nom: nomSaisi,
        nomNormalise,
        zoneClimat,
        statutValidation: estOfficiel ? 'a_revoir' : 'personnel',
        ...attrib,
      },
      include: {
        espece: true,
      },
    })

    // Doublon non bloquant : un itinéraire du même nom existe déjà dans le
    // catalogue visible, hors du périmètre d'unicité contrôlé plus haut.
    const doublon = await doublonVisibleItp(prisma, {
      nomNormalise,
      lecteurId: session!.user.id,
      exclureId: itp.id,
    })

    return NextResponse.json(
      {
        ...itp,
        ...(doublon
          ? { doublonPotentiel: { id: doublon.id, nom: doublon.nom ?? doublon.id } }
          : {}),
      },
      { status: 201 }
    )
  } catch (error) {
    // Conflit de période (index `itps_periode_unique_idx`) : le dire, au lieu du
    // 500 muet « Erreur lors de la création de l'ITP ».
    if (estConflitPeriodeItp(error)) {
      const body = await request.clone().json().catch(() => ({}))
      const conflit = await itpMemePeriode(prisma, {
        proprietaireId: session!.user.role === 'ADMIN' ? null : session!.user.id,
        especeId: body?.especeId,
        semaineSemis: body?.semaineSemis,
        semainePlantation: body?.semainePlantation,
        semaineRecolte: body?.semaineRecolte,
        typePlanche: body?.typePlanche,
      })
      return NextResponse.json(
        { error: messageConflitPeriodeItp(conflit), conflit: conflit?.id },
        { status: 409 }
      )
    }
    console.error('POST /api/itps error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'ITP' },
      { status: 500 }
    )
  }
}
