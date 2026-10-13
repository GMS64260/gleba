import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { buildUblInvoice, UblValidationError } from '@/lib/facture-ubl'
import { preparerExportFacture } from '@/lib/facture-structuree'

/**
 * GET /api/comptabilite/factures/[id]/ubl — la facture en UBL 2.1 (EN 16931,
 * règles françaises XP Z12-012) : `Invoice` pour une facture ou un acompte,
 * `CreditNote` pour un avoir (depuis le 2026-10-13). Brouillon refusé (400),
 * facture incomplète détaillée (422).
 */
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

  const preparation = await preparerExportFacture(facture, session!.user.id, 'UBL')
  if (!preparation.ok) return NextResponse.json({ error: preparation.error }, { status: preparation.status })

  let xml: string
  try {
    xml = buildUblInvoice(preparation.donnees)
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
