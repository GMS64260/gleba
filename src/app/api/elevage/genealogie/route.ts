/**
 * Arbre généalogique sur N générations.
 * GET /api/elevage/genealogie?animalId=42&generations=3
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { genealogie } from '@/lib/reproduction'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const animalIdStr = searchParams.get('animalId')
  const generations = parseInt(searchParams.get('generations') || '2', 10)
  if (!animalIdStr) return NextResponse.json({ error: 'animalId requis' }, { status: 400 })

  const animalId = parseInt(animalIdStr, 10)
  // Vérifie l'appartenance à l'utilisateur
  const a = await prisma.animal.findFirst({ where: { id: animalId, userId: session.user.id }, select: { id: true } })
  if (!a) return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })

  const tree = await genealogie(prisma, animalId, Math.min(generations, 4))
  return NextResponse.json({ data: tree })
}
