/**
 * Bilan matière du lait (2026-11-03) : collecté, écarté, livré, vendu cru,
 * transformé et non affecté, sur les 7 derniers jours et le mois en cours.
 * GET ?date=AAAA-MM-JJ (jour civil de Paris, aujourd'hui par défaut).
 * Règles : src/lib/elevage/bilan-lait.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { chargerBilansLait, jourParis } from '@/lib/elevage/bilan-lait'

/** AAAA-MM-JJ d'un jour qui existe (le 31/02 est refusé). */
function jourValide(jour: string): boolean {
  const t = Date.parse(`${jour}T12:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) && !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === jour
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const demande = new URL(request.url).searchParams.get('date')
  if (demande !== null && !jourValide(demande)) {
    return NextResponse.json({ error: 'Date invalide (AAAA-MM-JJ attendu)' }, { status: 400 })
  }
  const jour = demande ?? jourParis(new Date())
  return NextResponse.json(await chargerBilansLait(prisma, session.user.id, jour))
}
