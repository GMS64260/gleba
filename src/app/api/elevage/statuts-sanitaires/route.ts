import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { codesEspeceVeterinaire } from "@/lib/elevage/delais-veterinaires"

const statutSchema = z.object({
  animalId: z.coerce.number().int().positive().nullable().optional(),
  lotId: z.coerce.number().int().positive().nullable().optional(),
  maladieId: z.string().min(1),
  statut: z.enum(["indemne", "en_cours", "positif", "inconnu"]),
  dateControle: z.coerce.date().nullable().optional(),
  laboratoire: z.string().trim().max(200).nullable().optional(),
  numeroAnalyse: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine(
  (data) => Number(data.animalId != null) + Number(data.lotId != null) === 1,
  { message: "Renseignez un animal ou un lot, mais pas les deux." },
)

const maladieSchema = z.object({
  nom: z.string().trim().min(2).max(120),
  especesCibles: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  description: z.string().trim().max(500).nullable().optional(),
})

const poidsStatut = { positif: 4, en_cours: 3, inconnu: 2, indemne: 1 } as const

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id
  const params = new URL(request.url).searchParams
  const animalId = params.get("animalId")
  const lotId = params.get("lotId")

  const where: {
    userId: string
    animalId?: number
    lotId?: number
  } = { userId }
  if (animalId) where.animalId = Number(animalId)
  if (lotId) where.lotId = Number(lotId)

  const [data, maladies, toutes, animauxActifs, lotsActifs] = await Promise.all([
    prisma.statutSanitaireElevage.findMany({
      where,
      orderBy: [{ dateControle: "desc" }, { updatedAt: "desc" }],
      include: {
        maladie: { select: { id: true, code: true, nom: true, especesCibles: true } },
        animal: { select: { id: true, nom: true, identifiant: true } },
        lot: { select: { id: true, nom: true } },
      },
    }),
    prisma.maladieElevage.findMany({
      where: {
        active: true,
        OR: [{ userId: null }, { userId }],
      },
      orderBy: [{ userId: "asc" }, { nom: "asc" }],
      select: {
        id: true,
        code: true,
        nom: true,
        especesCibles: true,
        description: true,
        userId: true,
      },
    }),
    prisma.statutSanitaireElevage.findMany({
      where: { userId },
      select: {
        animalId: true,
        lotId: true,
        statut: true,
        maladie: { select: { id: true, nom: true } },
      },
    }),
    prisma.animal.findMany({
      where: { userId, statut: "actif" },
      select: {
        id: true,
        especeAnimale: {
          select: { id: true, nom: true, categorieReglementaire: true },
        },
      },
    }),
    prisma.lotAnimaux.findMany({
      where: { userId, statut: "actif" },
      select: {
        id: true,
        especeAnimale: {
          select: { id: true, nom: true, categorieReglementaire: true },
        },
      },
    }),
  ])

  const groupes = new Map<string, {
    maladieId: string
    maladie: string
    indemne: number
    enCours: number
    positif: number
    inconnu: number
    qualification: keyof typeof poidsStatut
  }>()
  for (const maladie of maladies) {
    const especesCibles = new Set(maladie.especesCibles.map((code) => code.toLowerCase()))
    const applicable = (espece: { id: string; nom: string | null; categorieReglementaire: string | null }) =>
      especesCibles.size === 0 ||
      codesEspeceVeterinaire(espece).some((code) => especesCibles.has(code))
    const animauxEligibles = animauxActifs.filter((animal) => applicable(animal.especeAnimale))
    const lotsEligibles = lotsActifs.filter((lot) => applicable(lot.especeAnimale))
    const idsAnimaux = new Set(animauxEligibles.map((animal) => animal.id))
    const idsLots = new Set(lotsEligibles.map((lot) => lot.id))
    const lignes = toutes.filter((ligne) =>
      ligne.maladie.id === maladie.id &&
      (
        (ligne.animalId != null && idsAnimaux.has(ligne.animalId)) ||
        (ligne.lotId != null && idsLots.has(ligne.lotId))
      ),
    )
    const nombreCibles = animauxEligibles.length + lotsEligibles.length
    if (nombreCibles === 0 && lignes.length === 0) continue
    const current: {
      maladieId: string
      maladie: string
      indemne: number
      enCours: number
      positif: number
      inconnu: number
      qualification: keyof typeof poidsStatut
    } = {
      maladieId: maladie.id,
      maladie: maladie.nom,
      indemne: 0,
      enCours: 0,
      positif: 0,
      inconnu: 0,
      qualification: "indemne",
    }
    for (const ligne of lignes) {
      if (ligne.statut === "indemne") current.indemne += 1
      if (ligne.statut === "en_cours") current.enCours += 1
      if (ligne.statut === "positif") current.positif += 1
      if (ligne.statut === "inconnu") current.inconnu += 1
      if (poidsStatut[ligne.statut as keyof typeof poidsStatut] > poidsStatut[current.qualification]) {
        current.qualification = ligne.statut as keyof typeof poidsStatut
      }
    }
    const nonQualifiees = Math.max(0, nombreCibles - lignes.length)
    if (nonQualifiees > 0) {
      current.inconnu += nonQualifiees
      if (poidsStatut.inconnu > poidsStatut[current.qualification]) {
        current.qualification = "inconnu"
      }
    }
    groupes.set(maladie.id, current)
  }

  return NextResponse.json({
    data,
    maladies,
    syntheseCheptel: [...groupes.values()].sort((a, b) => a.maladie.localeCompare(b.maladie)),
  })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id
  const parsed = statutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    )
  }
  const input = parsed.data

  const [animal, lot, maladie] = await Promise.all([
    input.animalId
      ? prisma.animal.findFirst({ where: { id: input.animalId, userId }, select: { id: true } })
      : null,
    input.lotId
      ? prisma.lotAnimaux.findFirst({ where: { id: input.lotId, userId }, select: { id: true } })
      : null,
    prisma.maladieElevage.findFirst({
      where: {
        id: input.maladieId,
        active: true,
        OR: [{ userId: null }, { userId }],
      },
      select: { id: true },
    }),
  ])
  if (input.animalId && !animal) return NextResponse.json({ error: "Animal introuvable" }, { status: 404 })
  if (input.lotId && !lot) return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  if (!maladie) return NextResponse.json({ error: "Maladie inaccessible" }, { status: 404 })

  const existing = await prisma.statutSanitaireElevage.findFirst({
    where: {
      userId,
      maladieId: input.maladieId,
      animalId: input.animalId ?? null,
      lotId: input.lotId ?? null,
    },
    select: { id: true },
  })
  const values = {
    statut: input.statut,
    dateControle: input.dateControle ?? null,
    laboratoire: input.laboratoire || null,
    numeroAnalyse: input.numeroAnalyse || null,
    notes: input.notes || null,
  }
  const data = existing
    ? await prisma.statutSanitaireElevage.update({
        where: { id: existing.id },
        data: values,
        include: { maladie: true },
      })
    : await prisma.statutSanitaireElevage.create({
        data: {
          userId,
          animalId: input.animalId ?? null,
          lotId: input.lotId ?? null,
          maladieId: input.maladieId,
          ...values,
        },
        include: { maladie: true },
      })
  return NextResponse.json({ data }, { status: existing ? 200 : 201 })
}

export async function PUT(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = maladieSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Données invalides" }, { status: 400 })
  }
  const code = parsed.data.nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60)
  const existing = await prisma.maladieElevage.findFirst({
    where: { userId: session.user.id, code },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: "Cette maladie personnalisée existe déjà." }, { status: 409 })
  }
  const data = await prisma.maladieElevage.create({
    data: {
      userId: session.user.id,
      code,
      nom: parsed.data.nom,
      especesCibles: parsed.data.especesCibles,
      description: parsed.data.description || null,
    },
  })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 })
  const existing = await prisma.statutSanitaireElevage.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: "Statut introuvable" }, { status: 404 })
  await prisma.statutSanitaireElevage.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
