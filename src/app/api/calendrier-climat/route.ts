/**
 * API zone climatique du calendrier de semis.
 *
 * GET  /api/calendrier-climat
 *   → zone effective (manuelle si surchargée, sinon dérivée du code postal),
 *     décalage de semis associé, dates moyennes de gelées, et liste des zones.
 *
 * PUT  /api/calendrier-climat   body: { zone: ZoneClimat | null }
 *   → enregistre une surcharge manuelle (null = revenir à la détection auto).
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
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

function estZoneValide(v: unknown): v is ZoneClimat {
  return typeof v === 'string' && (ZONES_CLIMAT as readonly string[]).includes(v)
}

function payloadPourZone(
  zone: ZoneClimat | null,
  source: 'manuelle' | 'auto' | 'inconnue',
  zoneDerivee: ZoneClimat | null
) {
  return {
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
    const [user, terroir] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { zoneClimat: true } }),
      terroirDeUser(prisma, userId),
    ])

    const zoneDerivee = terroir.zoneClimat
    const surcharge = estZoneValide(user?.zoneClimat) ? user!.zoneClimat as ZoneClimat : null

    if (surcharge) {
      return NextResponse.json(payloadPourZone(surcharge, 'manuelle', zoneDerivee))
    }
    if (zoneDerivee) {
      return NextResponse.json(payloadPourZone(zoneDerivee, 'auto', zoneDerivee))
    }
    return NextResponse.json(payloadPourZone(null, 'inconnue', null))
  } catch (err) {
    console.error('GET /api/calendrier-climat error:', err)
    return NextResponse.json({ error: 'Erreur lecture zone climatique' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
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

    const terroir = await terroirDeUser(prisma, userId)
    const zoneDerivee = terroir.zoneClimat

    if (zone) {
      return NextResponse.json(payloadPourZone(zone as ZoneClimat, 'manuelle', zoneDerivee))
    }
    if (zoneDerivee) {
      return NextResponse.json(payloadPourZone(zoneDerivee, 'auto', zoneDerivee))
    }
    return NextResponse.json(payloadPourZone(null, 'inconnue', null))
  } catch (err) {
    console.error('PUT /api/calendrier-climat error:', err)
    return NextResponse.json({ error: 'Erreur enregistrement zone climatique' }, { status: 500 })
  }
}
