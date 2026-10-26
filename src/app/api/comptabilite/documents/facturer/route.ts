import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { facturationDocumentsSchema } from '@/lib/commercial/regles'
import { facturerDocuments } from '@/lib/commercial/service'
import { erreurCommerciale } from '@/lib/commercial/http'
import { invalidateKpi } from '@/lib/kpi'

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const d = facturationDocumentsSchema.parse(await request.json())
    const data = await facturerDocuments(session.user.id, d.ids, d.dateEcheance)
    invalidateKpi(session.user.id)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) { return erreurCommerciale(error) }
}
