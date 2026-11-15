/**
 * API zone climatique du calendrier de semis.
 *
 * GET  /api/calendrier-climat
 *   → zone effective (manuelle si surchargée, sinon dérivée du code postal),
 *     décalage de semis associé, dates moyennes de gelées, et liste des zones.
 *     Quand l'historique climatique de la parcelle de référence est prêt,
 *     `geleesMesurees` porte les dates réellement observées sur trente ans ;
 *     les dates de zone restent le repli.
 *
 * PUT  /api/calendrier-climat   body: { zone: ZoneClimat | null }
 *   → enregistre une surcharge manuelle (null = revenir à la détection auto).
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import {
  ZONES_CLIMAT,
  ZONE_CLIMAT_LABEL,
  terroirDeUser,
  type ZoneClimat,
} from '@/lib/terroir'
import {
  decalageZone,
  zoneHorsReferenceMetropole,
  SEMAINE_DERNIERES_GELEES,
  SEMAINE_PREMIERES_GELEES,
} from '@/lib/calendrier-climat'
import { gelDeLaParcelle } from '@/lib/agroclimat/gel-parcelle'

function estZoneValide(v: unknown): v is ZoneClimat {
  return typeof v === 'string' && (ZONES_CLIMAT as readonly string[]).includes(v)
}

/**
 * Gel mesuré sur la parcelle de référence, ou `null` tant qu'il n'existe pas
 * (historique en préparation, hors métropole, pas de parcelle, parcelle
 * d'exemple). Une panne ici ne doit jamais priver l'écran de sa zone.
 */
async function geleesMesureesDe(userId: string) {
  try {
    const gel = await gelDeLaParcelle(userId)
    if (gel.etat !== 'pret' || gel.parcelle.exemple || gel.gelee.printemps.annees === 0) return null
    return {
      parcelle: gel.parcelle.nom,
      annees: gel.gelee.printemps.annees,
      // Cases du calendrier à 366 cases (`src/lib/agroclimat/calendrier.ts`).
      derniereMediane: gel.gelee.printemps.mediane,
      dernierePrudence: gel.gelee.printemps.prudence,
      premiereMediane: gel.gelee.automne.mediane,
      premierePrudence: gel.gelee.automne.prudence,
    }
  } catch (err) {
    console.warn('GET /api/calendrier-climat: gel mesuré indisponible:', err)
    return null
  }
}

type GeleesMesurees = Awaited<ReturnType<typeof geleesMesureesDe>>

function payloadPourZone(
  zone: ZoneClimat | null,
  source: 'manuelle' | 'auto' | 'inconnue',
  zoneDerivee: ZoneClimat | null,
  geleesMesurees: GeleesMesurees
) {
  return {
    geleesMesurees,
    zone,
    label: zone ? ZONE_CLIMAT_LABEL[zone] : null,
    source, // manuelle | auto | inconnue
    zoneDerivee,
    labelDerivee: zoneDerivee ? ZONE_CLIMAT_LABEL[zoneDerivee] : null,
    decalage: decalageZone(zone),
    // Zone d'outre-mer : le décalage métropolitain n'a pas de sens, le calendrier
    // s'appuie sur des ITP calés sur la zone (cf. itpApplicableAZone côté client).
    horsReference: zoneHorsReferenceMetropole(zone),
    dernieresGelees: zone ? SEMAINE_DERNIERES_GELEES[zone] : null,
    premieresGelees: zone ? SEMAINE_PREMIERES_GELEES[zone] : null,
    options: ZONES_CLIMAT.map((z) => ({
      value: z,
      label: ZONE_CLIMAT_LABEL[z],
      decalage: decalageZone(z),
      horsReference: zoneHorsReferenceMetropole(z),
    })),
  }
}

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const [user, terroir, gelees] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { zoneClimat: true } }),
      terroirDeUser(prisma, userId),
      geleesMesureesDe(userId),
    ])

    const zoneDerivee = terroir.zoneClimat
    const surcharge = estZoneValide(user?.zoneClimat) ? user!.zoneClimat as ZoneClimat : null

    if (surcharge) {
      return NextResponse.json(payloadPourZone(surcharge, 'manuelle', zoneDerivee, gelees))
    }
    if (zoneDerivee) {
      return NextResponse.json(payloadPourZone(zoneDerivee, 'auto', zoneDerivee, gelees))
    }
    return NextResponse.json(payloadPourZone(null, 'inconnue', null, gelees))
  } catch (err) {
    console.error('GET /api/calendrier-climat error:', err)
    return NextResponse.json({ error: 'Erreur lecture zone climatique' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const refus = refusSiLectureSeule(session)
  if (refus) return refus
  const userId = session!.user.id

  try {
    const body = await request.json().catch(() => ({}))
    const zone = body?.zone ?? null

    if (zone !== null && !estZoneValide(zone)) {
      return NextResponse.json({ error: 'Zone climatique invalide' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { zoneClimat: zone },
    })

    const [terroir, gelees] = await Promise.all([terroirDeUser(prisma, userId), geleesMesureesDe(userId)])
    const zoneDerivee = terroir.zoneClimat

    if (zone) {
      return NextResponse.json(payloadPourZone(zone as ZoneClimat, 'manuelle', zoneDerivee, gelees))
    }
    if (zoneDerivee) {
      return NextResponse.json(payloadPourZone(zoneDerivee, 'auto', zoneDerivee, gelees))
    }
    return NextResponse.json(payloadPourZone(null, 'inconnue', null, gelees))
  } catch (err) {
    console.error('PUT /api/calendrier-climat error:', err)
    return NextResponse.json({ error: 'Erreur enregistrement zone climatique' }, { status: 500 })
  }
}
