/**
 * API Production Bois
 * GET /api/arbres/bois - Liste des productions
 * POST /api/arbres/bois - Créer une production
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { chargerSuiviDesLignes } from "@/lib/comptabilite/suivi-ecriture"
import { requireAuthApi } from "@/lib/auth-utils"
import { m3PleinToStere, stereToM3Plein } from "@/lib/recolte/lot"
// Types de production bois : liste unique partagée avec l'écran (QA cmvnp0dm9).
import { refusTypeProductionBois } from "@/lib/verger/production-bois"
import { prixFruitApi, dateRecolteApi } from '@/lib/verger/creation-recolte'
import { ErreurVerger } from '@/lib/verger/erreur'
import { prochainNumeroLotVerger } from '@/lib/verger/numero-lot'
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'

// DEV3 #4 — Destinations canoniques (audit Marc 2026-05-14)
export const DESTINATIONS_BOIS = [
  { value: "Stock interne", label: "Stock interne" },
  { value: "Vente", label: "Vente" },
  { value: "Auto-consommation", label: "Auto-consommation" },
  { value: "Don", label: "Don" },
]

// DEV3 #4 — Qualités de bois (audit Marc)
export const QUALITES_BOIS = [
  { value: "Bois d'œuvre", label: "Bois d'œuvre" },
  { value: "Bois de chauffage", label: "Bois de chauffage" },
  { value: "BRF", label: "BRF" },
  { value: "Plaquette", label: "Plaquette" },
  { value: "Piquet", label: "Piquet" },
  { value: "Déchet vert", label: "Déchet vert" },
]

// GET /api/arbres/bois
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const year = searchParams.get("year")
    const type = searchParams.get("type")
    const destination = searchParams.get("destination")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1),
      }
    }

    if (type) {
      where.type = type
    }

    if (destination) {
      where.destination = destination
    }

    const productions = await prisma.productionBois.findMany({
      where,
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })

    const suivi = await chargerSuiviDesLignes(userId, productions.filter(p => p.statut === 'vendu').map(p => ({ id: String(p.id), source: 'ProductionBois', sourceId: p.id, factureId: p.factureId })))
    return NextResponse.json(productions.map(p => ({ ...p, ecriture: suivi.get(String(p.id))?.ecriture })))
  } catch (err) {
    console.error("GET /api/arbres/bois error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des productions de bois" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/bois
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json()
    const prixVente = prixFruitApi(body.prixVente, 'prixVente')

    // Validation. Un type hors liste n'aurait aucun libellé à afficher sur la
    // vente ni sur la facture (QA cmvnp0dm9).
    const refusType = refusTypeProductionBois(body.type)
    if (refusType) {
      return NextResponse.json({ error: refusType, champ: "type" }, { status: 400 })
    }

    return await prisma.$transaction(async tx => {
      await verrouillerStockCommercial(tx, userId)
      // Vérifier que l'arbre appartient à l'utilisateur (si spécifié)
      let arbre: { id: number; espece: string | null; parcelleGeoId: string | null } | null = null
      if (body.arbreId) {
        arbre = await tx.arbre.findFirst({
          where: { id: body.arbreId, userId },
          select: { id: true, espece: true, parcelleGeoId: true },
        })

        if (!arbre) {
          return NextResponse.json(
            { error: "Arbre non trouvé" },
            { status: 404 }
          )
        }
      }

      // QA 2026-07-30 — Une production d'élagage ou d'abattage était acceptée sans
      // arbre : la ligne partait orpheline, avec un numéro de lot dégradé et une
      // colonne « Arbre » vide, sans rien signaler à l'opérateur. L'arbre est la
      // clé de traçabilité de ces deux opérations.
      if (!arbre && (body.type === "elagage" || body.type === "abattage")) {
        return NextResponse.json(
          {
            error: "Sélectionnez l'arbre concerné : une production d'élagage ou d'abattage doit rester tracée jusqu'à l'arbre.",
            code: "ARBRE_REQUIS",
          },
          { status: 422 }
        )
      }

      const dateProd = dateRecolteApi(body.date, 'date', new Date())!

      // DEV3 #4 — Conversion automatique stère ↔ m³ plein
      // Si l'utilisateur saisit l'un, on calcule l'autre.
      let volumeM3 = body.volumeM3 != null && body.volumeM3 !== "" ? parseFloat(body.volumeM3) : null
      let volumeStere = body.volumeStere != null && body.volumeStere !== "" ? parseFloat(body.volumeStere) : null
      if (volumeM3 != null && volumeStere == null) volumeStere = m3PleinToStere(volumeM3)
      if (volumeStere != null && volumeM3 == null) volumeM3 = stereToM3Plein(volumeStere)

      // DEV3 #4 — Parcelle d'origine : par défaut celle de l'arbre, surchargeable
      const parcelleId =
        body.parcelleId !== undefined ? body.parcelleId : arbre?.parcelleGeoId ?? null
      if (parcelleId != null && typeof parcelleId !== 'string') throw new ErreurVerger('Parcelle invalide.', 400, 'parcelleId')
      const parcelle = parcelleId ? await tx.parcelleGeo.findFirst({ where: { id: parcelleId, userId }, select: { nom: true } }) : null
      if (parcelleId && !parcelle) throw new ErreurVerger('Parcelle non trouvée.', 400, 'parcelleId')

      const numLot = typeof body.numLot === 'string' && body.numLot.trim()
        ? body.numLot.trim()
        : await prochainNumeroLotVerger(tx, userId, { date: dateProd, parcelleNom: parcelle?.nom, espece: arbre?.espece ?? body.type })

      const production = await tx.productionBois.create({
        data: {
          userId,
          arbreId: body.arbreId || null,
          date: dateProd,
          type: body.type,
          volumeM3,
          volumeStere,
          poidsKg: body.poidsKg ? parseFloat(body.poidsKg) : null,
          statut: "en_stock",
          destination: body.destination || null,
          prixVente: prixVente ?? null,
          notes: body.notes || null,
          // DEV3 #4
          parcelleId,
          numLot,
          qualiteBois: body.qualiteBois || null,
        },
        include: {
          arbre: {
            select: {
              id: true,
              nom: true,
              type: true,
            },
          },
          parcelle: { select: { id: true, nom: true } },
        },
      })

      return NextResponse.json(production, { status: 201 })
    })
  } catch (err) {
    if (err instanceof ErreurVerger) return NextResponse.json({ error: err.message, champ: err.champ }, { status: err.status })
    console.error("POST /api/arbres/bois error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de la production de bois" },
      { status: 500 }
    )
  }
}
