/**
 * API — Référentiel des races animales (partagé, communautaire).
 * GET    /api/elevage/races[?especeAnimaleId=&avis=1] — liste (+ stats d'avis)
 * POST   /api/elevage/races                           — créer une race
 * DELETE /api/elevage/races?id=<id>                   — supprimer (+ ses avis)
 *
 * Édition / suppression par id : voir /api/elevage/races/[id].
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { statsAvisPourRefs } from '@/lib/avis/stats-liste'
import {
  visibiliteReferentiel,
  attributionCreation,
  peutEditerReferentiel,
} from '@/lib/referentiel-communaute'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  const { searchParams } = new URL(request.url)
  const especeAnimaleId = searchParams.get('especeAnimaleId')
  const includeAvis = searchParams.get('avis') === '1'

  // Visibilité catalogue communautaire : Gleba officiel (userId null) +
  // communauté (partagé) + mes propres races perso. On combine avec le filtre
  // d'espèce existant via AND.
  const where = {
    AND: [
      especeAnimaleId ? { especeAnimaleId } : {},
      visibiliteReferentiel(userId),
    ],
  }

  const races = await prisma.raceAnimale.findMany({
    where,
    include: { especeAnimale: { select: { id: true, nom: true } } },
    orderBy: [{ especeAnimaleId: 'asc' }, { nom: 'asc' }],
  })

  const statsMap = includeAvis ? await statsAvisPourRefs(prisma, 'RACE', races.map((r) => r.id)) : null
  const data = statsMap ? races.map((r) => ({ ...r, avisStats: statsMap.get(r.id) })) : races

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const body = await request.json()
    const nom = String(body.nom || '').trim()
    const especeAnimaleId = String(body.especeAnimaleId || '').trim()
    if (!nom || !especeAnimaleId) {
      return NextResponse.json({ error: 'Nom et espèce requis' }, { status: 400 })
    }
    // L'espèce parente doit être VISIBLE par l'utilisateur (Gleba/communauté/sienne),
    // sinon on pourrait rattacher une race à — et divulguer — l'espèce privée d'autrui.
    const espece = await prisma.especeAnimale.findFirst({
      where: { AND: [{ id: especeAnimaleId }, visibiliteReferentiel(session!.user.id)] },
      select: { id: true },
    })
    if (!espece) return NextResponse.json({ error: 'Espèce introuvable' }, { status: 400 })

    // Création : admin → catalogue Gleba officiel (userId null) ;
    // utilisateur → perso (userId = lui), proposé à la communauté ou privé.
    const race = await prisma.raceAnimale.create({
      data: {
        nom,
        especeAnimaleId,
        origine: body.origine || null,
        aptitudes: Array.isArray(body.aptitudes) ? body.aptitudes : [],
        rusticite: typeof body.rusticite === 'number' ? body.rusticite : null,
        description: body.description || null,
        ...attributionCreation(isAdmin, session!.user.id, body.partageCommunaute === true),
      },
    })
    return NextResponse.json({ data: race }, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Cette race existe déjà pour cette espèce' }, { status: 409 })
    }
    console.error('POST /api/elevage/races error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const existing = await prisma.raceAnimale.findUnique({
    where: { id },
    include: { _count: { select: { animaux: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Race non trouvée' }, { status: 404 })

  // Seul l'auteur d'une race perso (ou un admin) peut la supprimer.
  if (!peutEditerReferentiel(existing, session!.user.id, isAdmin)) {
    return NextResponse.json(
      { error: 'Vous ne pouvez supprimer que vos propres races.' },
      { status: 403 }
    )
  }

  // Une race utilisée par des animaux (potentiellement d'autres tenants si elle est
  // partagée) ne peut être supprimée — sinon leur raceAnimaleId serait nullé en silence.
  if (existing._count.animaux > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer : ${existing._count.animaux} animal(aux) référencent cette race.` },
      { status: 409 }
    )
  }

  // Nettoyage best-effort des avis liés (pas de FK polymorphe).
  await prisma.avis.deleteMany({ where: { refType: 'RACE', refId: id } })
  await prisma.raceAnimale.delete({ where: { id } })
  return NextResponse.json({ data: { ok: true } })
}
