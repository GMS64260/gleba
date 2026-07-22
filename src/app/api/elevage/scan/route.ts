import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const code = new URL(request.url).searchParams.get('code')?.trim()
  if (!code || code.length > 120) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 })
  const animal = await prisma.animal.findFirst({
    where: { userId: session.user.id, identifiant: { equals: code, mode: 'insensitive' } },
    select: { id: true, identifiant: true, nom: true, statut: true, lotId: true, especeAnimale: { select: { nom: true } } },
  })
  if (!animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
  return NextResponse.json({ data: animal })
}
