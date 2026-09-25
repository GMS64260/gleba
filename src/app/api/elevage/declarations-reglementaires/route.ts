import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { acteurReglementaire } from "@/lib/elevage/audit-reglementaire"
import {
  CANAL_HORS_GLEBA,
  REFERENCE_HORS_GLEBA,
} from "@/lib/elevage/declarations-reglementaires"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"
import { enregistrerSuiviDeclaration } from "@/lib/elevage/suivi-declarations.server"

const currentYear = () => new Date().getUTCFullYear()

const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)

const suiviSchema = z.object({
  key: z.string().min(5).max(300),
  year: yearSchema,
  statut: z.enum(["A_DECLARER", "TRANSMISE", "ACCEPTEE", "REJETEE", "ANNULEE"]),
  transmisAt: z.coerce.date().optional(),
  canalTransmission: z.string().trim().min(2).max(100).optional(),
  referenceTransmission: z.string().trim().min(2).max(300).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  // Reprise d'historique : mouvement déjà déclaré en dehors de Gleba.
  horsGleba: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const rawYear = new URL(request.url).searchParams.get("year") ?? String(currentYear())
  const parsedYear = yearSchema.safeParse(rawYear)
  if (!parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }

  const resultat = await chargerDeclarationsReglementaires(session.user.id, {
    year: parsedYear.data,
  })
  return NextResponse.json(resultat)
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }
  const parsed = suiviSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const data = parsed.data
  const resultat = await chargerDeclarationsReglementaires(userId, { year: data.year })
  const declaration = resultat.declarations.find((item) => item.key === data.key)
  if (!declaration) {
    return NextResponse.json({ error: "Déclaration introuvable pour cet exercice" }, { status: 404 })
  }

  const horsGleba = data.statut === "TRANSMISE" && data.horsGleba === true
  const canalTransmission = horsGleba ? CANAL_HORS_GLEBA : data.canalTransmission
  const referenceTransmission = horsGleba
    ? data.referenceTransmission ?? REFERENCE_HORS_GLEBA
    : data.referenceTransmission
  if (data.statut === "TRANSMISE" && !horsGleba) {
    if (!canalTransmission || !referenceTransmission) {
      return NextResponse.json(
        { error: "Le canal et la référence ou preuve de transmission sont requis" },
        { status: 400 },
      )
    }
    if (declaration.anomalies.length > 0) {
      return NextResponse.json(
        { error: "Corrigez les informations obligatoires avant de marquer la déclaration transmise" },
        { status: 409 },
      )
    }
  }

  const suiviAvant = await prisma.declarationReglementaireSuivi.findUnique({
    where: { userId_declarationKey: { userId, declarationKey: data.key } },
    select: { statut: true, transmisAt: true },
  })
  if (["ACCEPTEE", "REJETEE"].includes(data.statut) && !suiviAvant?.transmisAt) {
    return NextResponse.json(
      { error: "Une déclaration doit être transmise avant d’être acceptée ou rejetée" },
      { status: 409 },
    )
  }

  const reset = data.statut === "A_DECLARER"
  // « Sans objet » (ANNULEE) n'invente pas de date d'envoi : l'écran aurait
  // affiché « Transmise le … » pour un mouvement jamais déclaré.
  const transmisAt = reset
    ? null
    : data.statut === "ANNULEE"
      ? suiviAvant?.transmisAt ?? null
      : data.transmisAt ?? suiviAvant?.transmisAt ?? new Date()
  const suivi = await prisma.$transaction((tx) => enregistrerSuiviDeclaration(tx, {
    userId,
    acteur: acteurReglementaire(session.user),
    year: data.year,
    declaration,
    statut: data.statut,
    statutAvant: suiviAvant?.statut ?? declaration.statut,
    transmisAt,
    canalTransmission,
    referenceTransmission,
    notes: data.notes,
    metadata: horsGleba ? { horsGleba: true } : undefined,
  }))

  return NextResponse.json({ data: suivi })
}
