/**
 * API Routes pour les Arbres et arbustes
 * GET /api/arbres - Liste des arbres
 * POST /api/arbres - Creer un arbre
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { findTreeCareProfile, generateCareOperations } from "@/lib/tree-care-calendar"
import { zoneEffectiveUser } from "@/lib/terroir"
import { adequationEspece } from "@/lib/adequation-zone"
import { visibiliteReferentiel } from "@/lib/referentiel-communaute"

// Types d'arbres disponibles
export const TYPES_ARBRES = [
  { value: "fruitier", label: "Arbre fruitier", color: "#22c55e" },
  { value: "petit_fruit", label: "Petit fruit", color: "#ef4444" },
  { value: "ornement", label: "Ornement", color: "#a855f7" },
  { value: "haie", label: "Haie", color: "#84cc16" },
]

// GET /api/arbres?parcelle=ID|all|none
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    // Filtre par parcelle (optionnel)
    const parcelle = request.nextUrl.searchParams.get('parcelle')
    const where: Record<string, unknown> = { userId: session!.user.id }
    if (parcelle && parcelle !== 'all') {
      if (parcelle === 'none') {
        where.parcelleGeoId = null
      } else {
        where.parcelleGeoId = parcelle
      }
    }

    // Filtres enrichis
    const type = request.nextUrl.searchParams.get('type')
    const zone = request.nextUrl.searchParams.get('zone')
    const etat = request.nextUrl.searchParams.get('etat')
    const productif = request.nextUrl.searchParams.get('productif')
    if (type && type !== 'all') where.type = type
    if (zone && zone !== 'all') {
      if (zone === 'none') where.zoneId = null
      else {
        const zoneId = parseInt(zone)
        if (isNaN(zoneId)) {
          return NextResponse.json({ error: "Paramètre zone invalide" }, { status: 400 })
        }
        where.zoneId = zoneId
      }
    }
    if (etat && etat !== 'all') where.etat = etat
    if (productif === 'true') where.productif = true
    if (productif === 'false') where.productif = false

    const arbres = await prisma.arbre.findMany({
      where,
      include: {
        zone: { select: { id: true, nom: true } },
        _count: {
          select: {
            recoltesArbres: true,
            operationsArbres: true,
            observationsSante: true,
          },
        },
      },
      orderBy: { nom: "asc" },
    })

    // Étalement adulte de l'espèce (repli du cercle pointillé quand
    // envergureAdulte n'est pas saisie sur l'arbre). Le catalogue officiel a
    // id = nom, donc le champ texte libre `espece` se résout directement.
    const clesEspeces = [
      ...new Set(
        arbres.flatMap((a) => [a.especeId, a.espece].filter((v): v is string => Boolean(v)))
      ),
    ]
    const etalements = clesEspeces.length
      ? await prisma.espece.findMany({
          where: {
            AND: [{ id: { in: clesEspeces } }, visibiliteReferentiel(session!.user.id)],
            etalement: { not: null },
          },
          select: { id: true, etalement: true },
        })
      : []
    const etalementParEspece = new Map(etalements.map((e) => [e.id, e.etalement]))

    return NextResponse.json(
      arbres.map((a) => ({
        ...a,
        especeEtalement:
          (a.especeId ? etalementParEspece.get(a.especeId) : undefined) ??
          (a.espece ? etalementParEspece.get(a.espece) : undefined) ??
          null,
      }))
    )
  } catch (err) {
    console.error("GET /api/arbres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des arbres" },
      { status: 500 }
    )
  }
}

// POST /api/arbres
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation basique
    if (!body.nom?.trim()) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      )
    }

    if (!body.type) {
      return NextResponse.json(
        { error: "Le type est requis" },
        { status: 400 }
      )
    }

    // Bug #2 — Date plantation requise (audit Marc 2026-05-14).
    if (!body.datePlantation) {
      return NextResponse.json(
        { error: "La date de plantation est requise" },
        { status: 400 }
      )
    }

    // Isolation multi-tenant : la zone / parcelle référencée doit appartenir à l'utilisateur
    if (body.zoneId) {
      const zoneId = parseInt(body.zoneId)
      const zone = isNaN(zoneId)
        ? null
        : await prisma.zoneVerger.findFirst({
            where: { id: zoneId, userId: session!.user.id },
          })
      if (!zone) {
        return NextResponse.json({ error: "Zone non trouvée" }, { status: 404 })
      }
    }
    if (body.parcelleGeoId) {
      const parcelle = await prisma.parcelleGeo.findFirst({
        where: { id: body.parcelleGeoId, userId: session!.user.id },
      })
      if (!parcelle) {
        return NextResponse.json({ error: "Parcelle non trouvée" }, { status: 404 })
      }
    }

    const arbre = await prisma.arbre.create({
      data: {
        userId: session!.user.id,
        nom: body.nom.trim(),
        type: body.type,
        espece: body.espece || null,
        variete: body.variete || null,
        portGreffe: body.portGreffe || null,
        fournisseur: body.fournisseur || null,
        dateAchat: body.dateAchat ? new Date(body.dateAchat) : null,
        prixAchat: body.prixAchat ? parseFloat(body.prixAchat) : null,
        datePlantation: body.datePlantation ? new Date(body.datePlantation) : null,
        age: body.age || null,
        posX: body.posX ?? 0,
        posY: body.posY ?? 0,
        envergure: body.envergure ?? 2,
        envergureAdulte:
          body.envergureAdulte != null && body.envergureAdulte !== ""
            ? parseFloat(body.envergureAdulte)
            : null,
        hauteur: body.hauteur || null,
        etat: body.etat || null,
        pollinisateur: body.pollinisateur || null,
        couleur: body.couleur || null,
        notes: body.notes || null,
        productif: body.productif !== undefined ? body.productif : true,
        anneeProduction: body.anneeProduction ? parseInt(body.anneeProduction) : null,
        rendementMoyen: body.rendementMoyen ? parseFloat(body.rendementMoyen) : null,
        // Nouveaux champs verger enrichi
        formeTaille: body.formeTaille || null,
        vigueur: body.vigueur || null,
        distancePlantation: body.distancePlantation ? parseFloat(body.distancePlantation) : null,
        distanceRang: body.distanceRang ? parseFloat(body.distanceRang) : null,
        orientationRang: body.orientationRang || null,
        dateGreffe: body.dateGreffe ? new Date(body.dateGreffe) : null,
        typeGreffe: body.typeGreffe || null,
        heuresFroidRequis: body.heuresFroidRequis ? parseInt(body.heuresFroidRequis) : null,
        floraison: body.floraison || null,
        groupePollinisation: body.groupePollinisation || null,
        autofertile: body.autofertile || false,
        periodeRecolte: body.periodeRecolte || null,
        conservation: body.conservation || null,
        zoneId: body.zoneId ? parseInt(body.zoneId) : null,
        parcelleGeoId: body.parcelleGeoId || null,
        // PROMPT 10 — porte-greffe FK + circonférence + GPS
        porteGreffeId: body.porteGreffeId || null,
        circonferenceCm: body.circonferenceCm != null ? parseFloat(body.circonferenceCm) : null,
        gpsLat: body.gpsLat != null ? parseFloat(body.gpsLat) : null,
        gpsLng: body.gpsLng != null ? parseFloat(body.gpsLng) : null,
      },
      include: {
        zone: { select: { id: true, nom: true } },
        _count: {
          select: {
            recoltesArbres: true,
            operationsArbres: true,
            observationsSante: true,
          },
        },
      },
    })

    // Auto-génération du calendrier d'entretien si espece connue
    let calendrierGenere = false
    if (arbre.espece) {
      const profile = findTreeCareProfile(arbre.espece)
      if (profile) {
        const currentYear = new Date().getFullYear()
        const operations = generateCareOperations(profile, currentYear, arbre.id, session!.user.id)
        await prisma.operationArbre.createMany({ data: operations })
        calendrierGenere = true
      }
    }

    // Avertissement d'adéquation géographique (non bloquant) : ex. planter un
    // fruitier à besoin de froid en zone tropicale. Renvoyé pour affichage
    // (toast) — couvre le plan du jardin, le chat et les imports, qui passent
    // tous par cette route. Le catalogue officiel a id = nom (rattachement direct).
    let avertissementZone: string | null = null
    if (arbre.espece) {
      const espece = await prisma.espece.findFirst({
        where: { AND: [{ id: arbre.espece }, visibiliteReferentiel(session!.user.id)] },
        select: { zonesAdaptees: true, besoinFroid: true },
      })
      if (espece && (espece.zonesAdaptees || espece.besoinFroid)) {
        const userZone = await zoneEffectiveUser(prisma, session!.user.id)
        const { statut, raison } = adequationEspece({
          zonesAdaptees: espece.zonesAdaptees,
          besoinFroid: espece.besoinFroid,
          userZone,
        })
        if (statut === "peu_adaptee") avertissementZone = raison
      }
    }

    return NextResponse.json({ ...arbre, calendrierGenere, avertissementZone }, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la creation de l'arbre" },
      { status: 500 }
    )
  }
}
