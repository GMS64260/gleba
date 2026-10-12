import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { buildUblInvoice, UblValidationError } from '@/lib/facture-ubl'
import { donneesFactureStructuree, emetteurDeFacture } from '@/lib/facture-structuree'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const factureId = Number(id)
  if (!Number.isInteger(factureId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  const facture = await prisma.facture.findFirst({
    where: { id: factureId, userId: session!.user.id },
    include: { client: true, lignes: { orderBy: { ordre: 'asc' } } },
  })
  if (!facture) return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
  if (facture.type === 'avoir') return NextResponse.json({ error: "L'export UBL des avoirs sera disponible prochainement" }, { status: 400 })

  const emetteur = await emetteurDeFacture(facture, session!.user.id)
  if (!emetteur) return NextResponse.json({ error: "Configurez l'identité de l'exploitation avant l'export UBL" }, { status: 422 })

  let xml: string
  try {
    xml = buildUblInvoice(donneesFactureStructuree(facture, emetteur))
  } catch (err) {
    if (err instanceof UblValidationError) {
      return NextResponse.json({ error: "Facture incomplète pour l’export UBL", details: err.issues }, { status: 422 })
    }
    throw err
  }

  const filename = `${facture.numero.replace(/[^a-zA-Z0-9_-]/g, '_')}.ubl.xml`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
