/**
 * POST /api/elevage/declarations-reglementaires/hors-gleba
 *
 * Reprise d'historique (signalement 2026-09-25) : un éleveur qui ressaisit ses
 * années passées voit chaque mouvement « hors délai », alors qu'il l'a déclaré
 * à l'époque sur papier ou sur le portail EDE. Il atteste ici, pour une année,
 * les déclarations déjà faites en dehors de Gleba. Aucune donnée n'est
 * transmise ; chaque déclaration garde son snapshot et son journal.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { acteurReglementaire } from "@/lib/elevage/audit-reglementaire"
import {
  CANAL_HORS_GLEBA,
  REFERENCE_HORS_GLEBA,
  declarationATraiter,
} from "@/lib/elevage/declarations-reglementaires"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"
import { enregistrerSuiviDeclaration } from "@/lib/elevage/suivi-declarations.server"

const corpsSchema = z.object({
  year: z.coerce.number().int().min(1990).max(new Date().getUTCFullYear() + 1),
  keys: z.array(z.string().min(5).max(300)).min(1).max(500),
  notes: z.string().trim().max(2000).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }
  const parsed = corpsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const { year, notes } = parsed.data
  const keys = [...new Set(parsed.data.keys)]
  const resultat = await chargerDeclarationsReglementaires(userId, { year })
  const parCle = new Map(resultat.declarations.map((d) => [d.key, d]))
  const aMarquer = keys
    .map((key) => parCle.get(key))
    .filter((d): d is NonNullable<typeof d> => Boolean(d && declarationATraiter(d.statut)))
  const ignorees = keys.filter((key) => !aMarquer.some((d) => d.key === key))

  if (aMarquer.length === 0) {
    return NextResponse.json(
      { error: "Aucune déclaration à traiter parmi celles indiquées", ignorees },
      { status: 409 },
    )
  }

  const acteur = acteurReglementaire(session.user)
  const maintenant = new Date()
  await prisma.$transaction(async (tx) => {
    for (const declaration of aMarquer) {
      await enregistrerSuiviDeclaration(tx, {
        userId,
        acteur,
        year,
        declaration,
        statut: "TRANSMISE",
        statutAvant: declaration.statut,
        transmisAt: maintenant,
        canalTransmission: CANAL_HORS_GLEBA,
        referenceTransmission: REFERENCE_HORS_GLEBA,
        notes: notes ?? null,
        metadata: { horsGleba: true, groupe: true },
      })
    }
  }, { timeout: 30_000 })

  return NextResponse.json({ data: { marquees: aMarquer.length, ignorees } })
}
