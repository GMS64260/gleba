import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { genererPdfCommercial } from '@/lib/commercial/pdf'
import { relationsDocument } from '@/lib/commercial/service'
import { dispositionDocument } from '@/lib/http/disposition-fichier'
import { erreurCommerciale } from '@/lib/commercial/http'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const d = await prisma.documentCommercial.findFirst({ where: { id: (await params).id, userId: session.user.id }, include: relationsDocument })
    if (!d) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    return new NextResponse(new Uint8Array(await genererPdfCommercial(d)), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': dispositionDocument(request, `${d.numero}.pdf`), 'Cache-Control': 'private, no-store',
    } })
  } catch (error) { return erreurCommerciale(error) }
}
