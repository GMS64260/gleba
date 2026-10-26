import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { convertirEnLivraison } from '@/lib/commercial/service'
import { erreurCommerciale } from '@/lib/commercial/http'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    return NextResponse.json({ data: await convertirEnLivraison(session.user.id, (await params).id) }, { status: 201 })
  } catch (error) { return erreurCommerciale(error) }
}
