import { NextRequest, NextResponse } from "next/server"
import { dispositionDocument } from "@/lib/http/disposition-fichier"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { genererPdfFacture } from "@/lib/facture-pdf"
import { emetteurDeFacture } from "@/lib/facture-structuree"

/**
 * GET /api/comptabilite/factures/[id]/pdf — PDF d'une facture / avoir / acompte.
 * Le dessin et les mentions légales vivent dans `src/lib/facture-pdf.ts`,
 * partagés avec l'export Factur-X (`…/facturx`).
 */
interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id } = await params
  const factureId = parseInt(id, 10)
  if (isNaN(factureId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  }

  const facture = await prisma.facture.findFirst({
    where: { id: factureId, userId: session!.user.id },
    include: {
      client: true,
      lignes: { orderBy: { ordre: "asc" } },
    },
  })

  if (!facture) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 })
  }

  // Snapshot émetteur figé sur la facture, sinon l'Exploitation courante (compat factures pré-14C).
  const emetteur = await emetteurDeFacture(facture, session!.user.id)
  const buffer = await genererPdfFacture(facture, emetteur)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": dispositionDocument(request, `${facture.numero}.pdf`),
      "Cache-Control": "no-cache",
    },
  })
}
