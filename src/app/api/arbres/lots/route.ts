import type { Prisma } from "@prisma/client"
import { verrouillerStockCommercial } from "@/lib/stocks/verrou-commercial"
import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { parcelleCompatibleVerger, validerLotArbres } from "@/lib/verger/lot-arbres"

const include = { parcelleGeo: { select: { id: true, nom: true, usage: true, couches: true } } } as const

async function parcelleVerger(tx: Prisma.TransactionClient, userId: string, id: string) {
  const parcelle = await tx.parcelleGeo.findFirst({
    where: { id, userId },
    select: { id: true, usage: true, couches: true },
  })
  return parcelle && parcelleCompatibleVerger({ ...parcelle, couches: parcelle.couches.map(String) }) ? parcelle : null
}

async function conflitIndividuel(tx: Prisma.TransactionClient, userId: string, parcelleGeoId: string, espece: string) {
  return tx.arbre.findFirst({
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
  return prisma.$transaction(async (tx) => {
    // Même verrou que les créations/déplacements d'arbres individuels :
    // la garde et l'écriture du lot ne doivent pas s'entrelacer avec eux.
    await verrouillerStockCommercial(tx, userId)
    if (!await parcelleVerger(tx, userId, body.parcelleGeoId)) {
      return NextResponse.json({ error: "La parcelle doit vous appartenir et être catégorisée verger" }, { status: 400 })
    }
    if (await conflitIndividuel(tx, userId, body.parcelleGeoId, espece)) {
      return NextResponse.json({ error: "Des arbres individuels de cette espèce existent déjà sur la parcelle ; choisissez un seul mode de suivi" }, { status: 409 })
    }
    const lot = await tx.lotArbres.create({ data: {
      userId, nom, espece, effectif, parcelleGeoId: body.parcelleGeoId,
      variete: body.variete?.trim() || null,
      datePlantation: body.datePlantation ? new Date(body.datePlantation) : null,
      notes: body.notes?.trim() || null,
    }, include })
    return NextResponse.json(lot, { status: 201 })
  })
}

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const body = await request.json()
  const id = Number(body.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 })
  const userId = session!.user.id
  return prisma.$transaction(async (tx) => {
    await verrouillerStockCommercial(tx, userId)
    // Relire également les champs conservés sous verrou pour ne pas écraser
    // la modification concurrente d'un lot avec un instantané antérieur.
    const existing = await tx.lotArbres.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    const merged = { ...existing, ...body }
    const validation = validerLotArbres(merged)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })
    const parcelleGeoId = String(merged.parcelleGeoId)
    const espece = String(merged.espece).trim()
    if (!await parcelleVerger(tx, userId, parcelleGeoId)) return NextResponse.json({ error: "Parcelle verger invalide" }, { status: 400 })
    if (await conflitIndividuel(tx, userId, parcelleGeoId, espece)) return NextResponse.json({ error: "Conflit avec des arbres suivis individuellement" }, { status: 409 })
    return NextResponse.json(await tx.lotArbres.update({ where: { id, userId }, data: {
      nom: String(merged.nom).trim(), espece, effectif: Number(merged.effectif), parcelleGeoId,
      variete: merged.variete?.trim() || null, datePlantation: merged.datePlantation ? new Date(merged.datePlantation) : null,
      notes: merged.notes?.trim() || null,
    }, include }))
  })
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const id = Number(request.nextUrl.searchParams.get("id"))
  const userId = session!.user.id
  return prisma.$transaction(async (tx) => {
    await verrouillerStockCommercial(tx, userId)
    const existing = Number.isInteger(id) && await tx.lotArbres.findFirst({ where: { id, userId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Lot introuvable" }, { status: 404 })
    await tx.lotArbres.delete({ where: { id, userId } })
    return NextResponse.json({ ok: true })
  })
}
