import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { smtpConfigure } from '@/lib/mail'
import { estEmailDemo } from '@/lib/demo'
import { cibleEnvoiSchema, chargerCible, envoiSchema, envoyerCommercial, projectionEnvoi, statutEnvoi } from '@/lib/commercial/envois'
import { erreurCommerciale } from '@/lib/commercial/http'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const q = request.nextUrl.searchParams
    const cible = await chargerCible(session.user.id, cibleEnvoiSchema.parse({ type: q.get('type'), id: q.get('id') }))
    const [data, smtp, compte] = await Promise.all([
      prisma.envoiCommercial.findMany({ where: { userId: session.user.id, documentId: cible.documentId, factureId: cible.factureId }, select: projectionEnvoi, orderBy: { createdAt: 'desc' }, take: 10 }),
      smtpConfigure(), prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } }),
    ])
    return NextResponse.json({ data: data.map((e) => ({ ...e, statut: statutEnvoi(e) })), destinataire: cible.email || '', smtp, demo: estEmailDemo(compte?.email) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return erreurCommerciale(error) }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const data = await envoyerCommercial(session.user.id, envoiSchema.parse(await request.json()))
    return NextResponse.json({ data: { id: data.id, statut: data.statut, destinataire: data.destinataire, envoyeAt: data.envoyeAt } })
  } catch (error) { return erreurCommerciale(error) }
}
