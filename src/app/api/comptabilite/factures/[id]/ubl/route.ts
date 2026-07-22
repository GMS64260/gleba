import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { buildUblInvoice } from '@/lib/facture-ubl'
import type { EmetteurSnapshot } from '@/lib/facture-utils'

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

  const fallback = !facture.emetteurSnapshot
    ? await prisma.exploitation.findUnique({ where: { userId: session!.user.id } })
    : null
  const emetteur = (facture.emetteurSnapshot as EmetteurSnapshot | null) || fallback
  if (!emetteur) return NextResponse.json({ error: "Configurez l'identité de l'exploitation avant l'export UBL" }, { status: 422 })

  const xml = buildUblInvoice({
    number: facture.numero,
    issueDate: facture.date,
    dueDate: facture.dateEcheance,
    currency: emetteur.devise || 'EUR',
    supplier: {
      name: emetteur.raisonSociale,
      siret: emetteur.siret,
      vatId: emetteur.numeroTvaIntracom,
      email: emetteur.emailContact,
      address: { street: emetteur.adresseSiege, city: emetteur.ville, postalCode: emetteur.codePostal, country: emetteur.pays },
    },
    customer: {
      name: facture.clientNom,
      siret: facture.client?.siret,
      vatId: facture.client?.tvaIntra,
      email: facture.client?.email,
      address: {
        street: facture.clientAdresse || facture.client?.adresse,
        city: facture.client?.ville,
        postalCode: facture.client?.codePostal,
        country: facture.client?.pays,
      },
    },
    lines: facture.lignes.map((line) => ({
      id: line.ordre + 1,
      description: line.description,
      quantity: line.quantite,
      unit: line.unite,
      unitPrice: line.prixUnitaire,
      netAmount: line.montantHT,
      vatRate: line.tauxTVA,
    })),
    totalNet: facture.totalHT,
    totalVat: facture.totalTVA,
    totalGross: facture.totalTTC,
    paymentReference: facture.numero,
    paymentIban: emetteur.rib,
    notes: facture.objet,
  })

  const filename = `${facture.numero.replace(/[^a-zA-Z0-9_-]/g, '_')}.ubl.xml`
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
