import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { normaliserDateApi } from '@/lib/validations/date-api'
import prisma from '@/lib/prisma'
import { erreurCommerciale } from '@/lib/commercial/http'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const date = normaliserDateApi(request.nextUrl.searchParams.get('date'))
  if (!date.ok) return NextResponse.json({ error: 'Date de livraison invalide' }, { status: 400 })
  try { return NextResponse.json({ data: await chargerCatalogueStock(session.user.id, prisma, date.value ?? new Date()) }) }
  catch (cause) { return erreurCommerciale(cause) }
}
