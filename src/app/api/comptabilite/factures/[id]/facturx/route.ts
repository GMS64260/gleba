import { NextRequest, NextResponse } from "next/server"
import { dispositionDocument } from "@/lib/http/disposition-fichier"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { UblValidationError } from "@/lib/facture-ubl"
import { genererPdfFacture } from "@/lib/facture-pdf"
import { preparerExportFacture } from "@/lib/facture-structuree"
import { PROFIL_CII, buildCiiInvoice } from "@/lib/facturx/cii"

/**
 * GET /api/comptabilite/factures/[id]/facturx — la facture en Factur-X :
 * le PDF habituel en PDF/A-3b, avec le XML CII (profil EN 16931, règles
 * françaises XP Z12-012) incorporé. Même contrôle de complétude que l'UBL
 * (422 avec le détail). Ce fichier se dépose ensuite sur une plateforme
 * agréée : il ne vaut pas transmission. Chantier facturation électronique.
 */
interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  const { id } = await params
  const factureId = Number(id)
  if (!Number.isInteger(factureId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 })

  const facture = await prisma.facture.findFirst({
    where: { id: factureId, userId },
    include: { client: true, lignes: { orderBy: { ordre: "asc" } } },
  })
  if (!facture) return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 })

  const preparation = await preparerExportFacture(facture, userId, "Factur-X")
  if (!preparation.ok) return NextResponse.json({ error: preparation.error }, { status: preparation.status })

  let xml: string
  try {
    xml = buildCiiInvoice(preparation.donnees)
  } catch (err) {
    if (err instanceof UblValidationError) {
      return NextResponse.json({ error: "Facture incomplète pour l’export Factur-X", details: err.issues }, { status: 422 })
    }
    throw err
  }

  const pdf = await genererPdfFacture(facture, preparation.emetteur, { facturX: { xml, profil: PROFIL_CII } })
  const nom = `${facture.numero.replace(/[^a-zA-Z0-9_-]/g, "_")}-facturx.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": dispositionDocument(request, nom),
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
