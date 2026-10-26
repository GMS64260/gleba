import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { chargerCatalogueStock } from '@/lib/commercial/catalogue-stock'
import { erreurCommerciale } from '@/lib/commercial/http'

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try { return NextResponse.json({ data: await chargerCatalogueStock(session.user.id) }) }
  catch (cause) { return erreurCommerciale(cause) }
}
