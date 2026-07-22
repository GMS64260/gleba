import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { parcelleCompatibleVerger, validerLotArbres } from "@/lib/verger/lot-arbres"

const include = { parcelleGeo: { select: { id: true, nom: true, usage: true, couches: true } } } as const

async function parcelleVerger(userId: string, id: string) {
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: { id, userId },
    select: { id: true, usage: true, couches: true },
  })
  return parcelle && parcelleCompatibleVerger({ ...parcelle, couches: parcelle.couches.map(String) }) ? parcelle : null
}

async function conflitIndividuel(userId: string, parcelleGeoId: string, espece: string) {
  return prisma.arbre.findFirst({
    where: { userId, parcelleGeoId, espece: { equals: espece, mode: "insensitive" }, dateSuppression: null },
    select: { id: true },
  })
}

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  return NextResponse.json(await prisma.lotArbres.findMany({
    where: { userId: session!.user.id }, include, orderBy: { nom: "asc" },
  }))
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const body = await request.json()
  const validation = validerLotArbres(body)
  if (validation) return NextResponse.json({ error: validation }, { status: 400 })
  const userId = session!.user.id
  const nom = body.nom.trim()
  const espece = body.espece.trim()
  const effectif = Number(body.effectif)
  if (!await parcelleVerger(userId, body.parcelleGeoId)) {
    return NextResponse.json({ error: "La parcelle doit vous appartenir et être catégorisée verger" }, { status: 400 })
  }
  if (await conflitIndividuel(userId, body.parcelleGeoId, espece)) {
    return NextResponse.json({ error: "Des arbres individuels de cette espèce existent déjà sur la parcelle ; choisissez un seul mode de suivi" }, { status: 409 })
  }
  const lot = await prisma.lotArbres.create({ data: {
    userId, nom, espece, effectif, parcelleGeoId: body.parcelleGeoId,
    variete: body.variete?.trim() || null,
    datePlantation: body.datePlantation ? new Date(body.datePlantation) : null,
    notes: body.notes?.trim() || null,
  }, include })
  return NextResponse.json(lot, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const body = await request.json()
  const id = Number(body.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  const existing = await prisma.lotArbres.findFirst({ where: { id, userId: session!.user.id } })
  if (!existing) return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  const merged = { ...existing, ...body }
  const validation = validerLotArbres(merged)
  if (validation) return NextResponse.json({ error: validation }, { status: 400 })
  const parcelleGeoId = String(merged.parcelleGeoId)
  const espece = String(merged.espece).trim()
  if (!await parcelleVerger(session!.user.id, parcelleGeoId)) return NextResponse.json({ error: "Parcelle verger invalide" }, { status: 400 })
  if (await conflitIndividuel(session!.user.id, parcelleGeoId, espece)) return NextResponse.json({ error: "Conflit avec des arbres suivis individuellement" }, { status: 409 })
  return NextResponse.json(await prisma.lotArbres.update({ where: { id }, data: {
    nom: String(merged.nom).trim(), espece, effectif: Number(merged.effectif), parcelleGeoId,
    variete: merged.variete?.trim() || null, datePlantation: merged.datePlantation ? new Date(merged.datePlantation) : null,
    notes: merged.notes?.trim() || null,
  }, include }))
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const id = Number(request.nextUrl.searchParams.get("id"))
  const existing = Number.isInteger(id) && await prisma.lotArbres.findFirst({ where: { id, userId: session!.user.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
  await prisma.lotArbres.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
