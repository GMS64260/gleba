/**
 * API Routes pour la Pollinisation des arbres
 * GET /api/arbres/pollinisation - Matrice de compatibilité
 * POST /api/arbres/pollinisation - Créer une association
 * DELETE /api/arbres/pollinisation?id=X - Supprimer une association
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id

    // Récupérer tous les arbres fruitiers avec infos pollinisation
    const arbres = await prisma.arbre.findMany({
      where: {
        userId,
        type: { in: ["fruitier", "petit_fruit"] },
      },
      select: {
        id: true,
        nom: true,
        espece: true,
        variete: true,
        floraison: true,
        groupePollinisation: true,
        autofertile: true,
        pollinisateursCompat: {
          include: {
            arbrePollinisateur: {
              select: { id: true, nom: true, espece: true, variete: true, floraison: true, groupePollinisation: true },
            },
          },
        },
        pollinisateurDe: {
          include: {
            arbrePollinise: {
              select: { id: true, nom: true, espece: true, variete: true },
            },
          },
        },
      },
      orderBy: { nom: "asc" },
    })

    // Alertes: arbres non autofertiles sans pollinisateur compatible
    const alertes = arbres.filter(
      (a) => !a.autofertile && a.pollinisateursCompat.length === 0
    ).map((a) => ({
      id: a.id,
      nom: a.nom,
      espece: a.espece,
      variete: a.variete,
      floraison: a.floraison,
      groupePollinisation: a.groupePollinisation,
    }))

    // Toutes les associations
    const associations = await prisma.pollinisationArbre.findMany({
      where: {
        arbrePollinise: { userId },
      },
      include: {
        arbrePollinise: {
          select: { id: true, nom: true, espece: true, variete: true },
        },
        arbrePollinisateur: {
          select: { id: true, nom: true, espece: true, variete: true },
        },
      },
    })

    return NextResponse.json({
      arbres,
      associations,
      alertes,
      stats: {
        totalArbres: arbres.length,
        autofertiles: arbres.filter((a) => a.autofertile).length,
        sansPollinisateur: alertes.length,
      },
    })
  } catch (err) {
    console.error("GET /api/arbres/pollinisation error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des données de pollinisation" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    if (!body.arbrePolliniseId || !body.arbrePollinisateurId) {
      return NextResponse.json({ error: "Les deux arbres sont requis" }, { status: 400 })
    }

    const polliniseId = parseInt(body.arbrePolliniseId)
    const pollinisateurId = parseInt(body.arbrePollinisateurId)

    if (polliniseId === pollinisateurId) {
      return NextResponse.json({ error: "Un arbre ne peut pas se polliniser lui-même" }, { status: 400 })
    }

    // Vérifier que les deux arbres appartiennent à l'utilisateur
    const arbres = await prisma.arbre.findMany({
      where: { id: { in: [polliniseId, pollinisateurId] }, userId: session!.user.id },
    })
    if (arbres.length !== 2) {
      return NextResponse.json({ error: "Arbres non trouvés" }, { status: 404 })
    }

    const association = await prisma.pollinisationArbre.create({
      data: {
        arbrePolliniseId: polliniseId,
        arbrePollinisateurId: pollinisateurId,
        compatibilite: body.compatibilite || "bonne",
        notes: body.notes || null,
      },
      include: {
        arbrePollinise: { select: { id: true, nom: true } },
        arbrePollinisateur: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(association, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === "P2002") {
      return NextResponse.json({ error: "Cette association existe déjà" }, { status: 409 })
    }
    console.error("POST /api/arbres/pollinisation error:", err)
    return NextResponse.json({ error: "Erreur lors de la création de l'association" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const existing = await prisma.pollinisationArbre.findFirst({
      where: {
        id: parseInt(id),
        arbrePollinise: { userId: session!.user.id },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "Association non trouvée" }, { status: 404 })
    }

    await prisma.pollinisationArbre.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/pollinisation error:", err)
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 })
  }
}
