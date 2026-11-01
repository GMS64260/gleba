/**
 * API Admin — fichier d'origine d'une tentative d'import de relevé, octet pour
 * octet (encodage compris), pour reproduire un échec hors production.
 * GET /api/admin/imports-releve/[id]/fichier
 */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth-utils'
import { limiteConservation } from '@/lib/comptabilite/banque/tentatives'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminApi()
  if (error) return error
  const { id } = await params
  const t = await prisma.tentativeImportReleve.findFirst({
    where: { id, createdAt: { gte: limiteConservation() } },
    select: { contenu: true, nomFichier: true, createdAt: true },
  })
  if (!t?.contenu) return NextResponse.json({ error: 'Fichier non conservé.' }, { status: 404 })
  const nom =
    'releve-' +
    t.createdAt.toISOString().slice(0, 10) +
    '-' +
    id.slice(-6) +
    '-' +
    (t.nomFichier || 'import.csv').replace(/[^A-Za-z0-9._-]/g, '_').slice(-80)
  return new NextResponse(new Uint8Array(t.contenu), {
    headers: {
      // Octets bruts : le navigateur ne doit ni décoder ni afficher le relevé.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="' + nom + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
