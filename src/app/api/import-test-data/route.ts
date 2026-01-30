/**
 * API pour importer les données de test
 * POST /api/import-test-data
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
  familles,
  fournisseurs,
  destinations,
  fertilisants,
  especes,
  varietes,
  itps,
  rotations,
  rotationsDetails,
  planches,
  generateCultures,
  generateRecoltes,
  arbres,
  objetsJardin,
} from "../../../../prisma/seed-data"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const userId = session.user.id

    // Vérifier si l'utilisateur a déjà des données
    const existingPlanches = await prisma.planche.count({
      where: { userId },
    })

    if (existingPlanches > 0) {
      return NextResponse.json(
        { error: "Vous avez déjà des données. L'import n'est possible que pour un compte vide." },
        { status: 400 }
      )
    }

    // 1. Importer les référentiels (partagés)
    // Familles
    for (const famille of familles) {
      await prisma.famille.upsert({
        where: { id: famille.id },
        update: {},
        create: famille,
      })
    }

    // Fournisseurs
    for (const fournisseur of fournisseurs) {
      await prisma.fournisseur.upsert({
        where: { id: fournisseur.id },
        update: {},
        create: fournisseur,
      })
    }

    // Destinations
    for (const destination of destinations) {
      await prisma.destination.upsert({
        where: { id: destination.id },
        update: {},
        create: destination,
      })
    }

    // Fertilisants
    for (const fertilisant of fertilisants) {
      await prisma.fertilisant.upsert({
        where: { id: fertilisant.id },
        update: {},
        create: fertilisant,
      })
    }

    // Espèces
    for (const espece of especes) {
      await prisma.espece.upsert({
        where: { id: espece.id },
        update: {},
        create: {
          id: espece.id,
          type: espece.type,
          familleId: espece.familleId || null,
          rendement: espece.rendement || null,
          vivace: espece.vivace || false,
          besoinN: espece.besoinN || null,
          besoinEau: espece.besoinEau || null,
          couleur: espece.couleur || null,
        },
      })
    }

    // Variétés
    for (const variete of varietes) {
      await prisma.variete.upsert({
        where: { id: variete.id },
        update: {},
        create: {
          id: variete.id,
          especeId: variete.especeId,
          fournisseurId: variete.fournisseurId || null,
          nbGrainesG: variete.nbGrainesG || null,
          bio: variete.bio || false,
          description: variete.description || null,
        },
      })
    }

    // ITPs
    for (const itp of itps) {
      await prisma.iTP.upsert({
        where: { id: itp.id },
        update: {},
        create: {
          id: itp.id,
          especeId: itp.especeId || null,
          semaineSemis: itp.semaineSemis || null,
          semainePlantation: itp.semainePlantation || null,
          semaineRecolte: itp.semaineRecolte || null,
          dureePepiniere: itp.dureePepiniere || null,
          dureeCulture: itp.dureeCulture || null,
          nbRangs: itp.nbRangs || null,
          espacement: itp.espacement || null,
        },
      })
    }

    // Rotations
    for (const rotation of rotations) {
      await prisma.rotation.upsert({
        where: { id: rotation.id },
        update: {},
        create: rotation,
      })
    }

    // Rotation Details
    for (const detail of rotationsDetails) {
      const existing = await prisma.rotationDetail.findFirst({
        where: {
          rotationId: detail.rotationId,
          annee: detail.annee,
        },
      })
      if (!existing) {
        await prisma.rotationDetail.create({
          data: detail,
        })
      }
    }

    // 2. Importer les données utilisateur
    // Planches
    for (const planche of planches) {
      await prisma.planche.create({
        data: {
          id: planche.id,
          userId,
          rotationId: planche.rotationId || null,
          largeur: planche.largeur || null,
          longueur: planche.longueur || null,
          surface: planche.largeur && planche.longueur ? planche.largeur * planche.longueur : null,
          posX: planche.posX || null,
          posY: planche.posY || null,
          planchesInfluencees: planche.planchesInfluencees || null,
          ilot: planche.ilot || null,
          notes: planche.notes || null,
        },
      })
    }

    // Cultures
    const culturesData = generateCultures(userId)
    const createdCultures: { [key: string]: number } = {}

    for (const culture of culturesData) {
      const created = await prisma.culture.create({
        data: culture,
      })
      // Créer une clé unique pour retrouver la culture
      const key = `${culture.annee}-${culture.especeId}-${culture.varieteId || "novar"}-${culture.plancheId}`
      createdCultures[key] = created.id
    }

    // Récoltes
    const recoltesData = generateRecoltes(culturesData)

    for (const [key, recoltesList] of Object.entries(recoltesData)) {
      // Parser la clé pour trouver la culture correspondante
      const parts = key.split("-")
      const annee = parseInt(parts[0])
      const especeId = parts[1]

      // Trouver la culture correspondante
      const culture = await prisma.culture.findFirst({
        where: {
          userId,
          annee,
          especeId,
        },
        orderBy: { id: "asc" },
      })

      if (culture) {
        for (const recolteGroup of recoltesList) {
          for (let i = 0; i < recolteGroup.dates.length; i++) {
            await prisma.recolte.create({
              data: {
                userId,
                especeId,
                cultureId: culture.id,
                date: new Date(recolteGroup.dates[i]),
                quantite: recolteGroup.quantites[i],
              },
            })
          }
        }
      }
    }

    // Arbres
    for (const arbre of arbres) {
      await prisma.arbre.create({
        data: {
          userId,
          nom: arbre.nom,
          type: arbre.type,
          espece: arbre.espece,
          variete: arbre.variete || null,
          portGreffe: arbre.portGreffe || null,
          datePlantation: arbre.datePlantation || null,
          posX: arbre.posX,
          posY: arbre.posY,
          envergure: arbre.envergure || 2,
          hauteur: arbre.hauteur || null,
          etat: arbre.etat || null,
          pollinisateur: arbre.pollinisateur || null,
          notes: arbre.notes || null,
        },
      })
    }

    // Objets du jardin
    for (const objet of objetsJardin) {
      await prisma.objetJardin.create({
        data: {
          userId,
          nom: objet.nom || null,
          type: objet.type,
          largeur: objet.largeur,
          longueur: objet.longueur,
          posX: objet.posX,
          posY: objet.posY,
          rotation2D: objet.rotation2D || 0,
          couleur: objet.couleur || null,
          notes: objet.notes || null,
        },
      })
    }

    // Marquer l'utilisateur comme ayant importé les données de test
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: session.user.name || "Utilisateur Test",
      },
    })

    // Compter les données importées
    const stats = {
      familles: familles.length,
      fournisseurs: fournisseurs.length,
      especes: especes.length,
      varietes: varietes.length,
      itps: itps.length,
      rotations: rotations.length,
      planches: planches.length,
      cultures: culturesData.length,
      arbres: arbres.length,
      objetsJardin: objetsJardin.length,
    }

    return NextResponse.json({
      success: true,
      message: "Données de test importées avec succès",
      stats,
    })
  } catch (error) {
    console.error("Erreur import données test:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'import des données de test" },
      { status: 500 }
    )
  }
}

// GET pour vérifier si l'utilisateur peut importer
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const userId = session.user.id

    // Vérifier si l'utilisateur a déjà des données
    const [planchesCount, culturesCount, recoltesCount] = await Promise.all([
      prisma.planche.count({ where: { userId } }),
      prisma.culture.count({ where: { userId } }),
      prisma.recolte.count({ where: { userId } }),
    ])

    const canImport = planchesCount === 0 && culturesCount === 0 && recoltesCount === 0

    return NextResponse.json({
      canImport,
      currentData: {
        planches: planchesCount,
        cultures: culturesCount,
        recoltes: recoltesCount,
      },
    })
  } catch (error) {
    console.error("Erreur vérification import:", error)
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    )
  }
}
