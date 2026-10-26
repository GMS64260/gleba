import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { lireAnnee } from '@/lib/api/annee'
import { creationDocumentSchema } from '@/lib/commercial/regles'
import { creerDocument, relationsDocument } from '@/lib/commercial/service'
import { erreurCommerciale } from '@/lib/commercial/http'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const q = request.nextUrl.searchParams
    const type = q.get('type')
    if (type && type !== 'devis' && type !== 'livraison') return NextResponse.json({ error: 'Type inconnu' }, { status: 400 })
    const { bornes } = lireAnnee(q)
    const page = Math.floor(Math.max(1, Math.min(10000, Number(q.get('page')) || 1)))
    const recherche = q.get('q')?.trim().slice(0, 100)
    const statut = q.get('statut')
    const id = q.get('id')?.slice(0, 80)
    const where = {
      userId: session.user.id, ...(type ? { type } : {}), ...(id ? { id } : bornes ? { date: bornes } : {}),
      ...(recherche ? { OR: ['numero', 'clientNom', 'objet'].map((champ) => ({ [champ]: { contains: recherche, mode: 'insensitive' as const } })) } : {}),
      ...(statut === 'a_facturer' ? { statut: 'livre', factureId: null } : statut ? { statut } : {}),
    }
    const [data, total] = await Promise.all([
      prisma.documentCommercial.findMany({ where, include: relationsDocument, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 50, skip: (page - 1) * 50 }),
      prisma.documentCommercial.count({ where }),
    ])
    return NextResponse.json({ data, total, page }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return erreurCommerciale(error) }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const d = creationDocumentSchema.parse(await request.json())
    return NextResponse.json({ data: await creerDocument(session.user.id, d.cle, d.contenu) }, { status: 201 })
  } catch (error) { return erreurCommerciale(error) }
}
