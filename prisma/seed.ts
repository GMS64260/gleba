/**
 * Script de seed pour la base de données Gleba
 * Exécuter avec: npx ts-node prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client"
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
} from "./seed-data"

const prisma = new PrismaClient()

async function main() {
  const userId = "admin"

  console.log("Début du seed...")

  // Familles
  for (const f of familles) {
    await prisma.famille.upsert({ where: { id: f.id }, update: {}, create: f })
  }
  console.log(`✓ Familles: ${familles.length}`)

  // Fournisseurs
  for (const f of fournisseurs) {
    await prisma.fournisseur.upsert({ where: { id: f.id }, update: {}, create: f })
  }
  console.log(`✓ Fournisseurs: ${fournisseurs.length}`)

  // Destinations
  for (const d of destinations) {
    await prisma.destination.upsert({ where: { id: d.id }, update: {}, create: d })
  }
  console.log(`✓ Destinations: ${destinations.length}`)

  // Fertilisants
  for (const f of fertilisants) {
    await prisma.fertilisant.upsert({ where: { id: f.id }, update: {}, create: f })
  }
  console.log(`✓ Fertilisants: ${fertilisants.length}`)

  // Espèces
  for (const e of especes) {
    await prisma.espece.upsert({
      where: { id: e.id },
      update: {},
      create: {
        id: e.id,
        type: e.type,
        familleId: e.familleId || null,
        rendement: e.rendement || null,
        vivace: e.vivace || false,
        besoinN: e.besoinN || null,
        besoinEau: e.besoinEau || null,
        couleur: e.couleur || null,
      },
    })
  }
  console.log(`✓ Espèces: ${especes.length}`)

  // Variétés
  for (const v of varietes) {
    await prisma.variete.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        especeId: v.especeId,
        fournisseurId: v.fournisseurId || null,
        nbGrainesG: v.nbGrainesG || null,
        bio: v.bio || false,
        description: v.description || null,
      },
    })
  }
  console.log(`✓ Variétés: ${varietes.length}`)

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
  console.log(`✓ ITPs: ${itps.length}`)

  // Rotations
  for (const r of rotations) {
    await prisma.rotation.upsert({ where: { id: r.id }, update: {}, create: r })
  }
  console.log(`✓ Rotations: ${rotations.length}`)

  // Rotation Details
  for (const rd of rotationsDetails) {
    const existing = await prisma.rotationDetail.findFirst({
      where: { rotationId: rd.rotationId, annee: rd.annee },
    })
    if (!existing) {
      await prisma.rotationDetail.create({ data: rd })
    }
  }
  console.log(`✓ Rotation Details: ${rotationsDetails.length}`)

  // Planches
  for (const p of planches) {
    const existing = await prisma.planche.findUnique({ where: { id: p.id } })
    if (!existing) {
      await prisma.planche.create({
        data: {
          id: p.id,
          userId,
          rotationId: p.rotationId || null,
          largeur: p.largeur || null,
          longueur: p.longueur || null,
          surface: p.largeur && p.longueur ? p.largeur * p.longueur : null,
          posX: p.posX || null,
          posY: p.posY || null,
          planchesInfluencees: p.planchesInfluencees || null,
          ilot: p.ilot || null,
          notes: p.notes || null,
        },
      })
    }
  }
  console.log(`✓ Planches: ${planches.length}`)

  // Cultures
  const cultures = generateCultures(userId)
  for (const c of cultures) {
    await prisma.culture.create({ data: c })
  }
  console.log(`✓ Cultures: ${cultures.length}`)

  // Récoltes
  const recoltesData = generateRecoltes(cultures)
  let recoltesCount = 0

  for (const [key, recoltesList] of Object.entries(recoltesData)) {
    const parts = key.split("-")
    const annee = parseInt(parts[0])
    const especeId = parts[1]

    const culture = await prisma.culture.findFirst({
      where: { userId, annee, especeId },
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
          recoltesCount++
        }
      }
    }
  }
  console.log(`✓ Récoltes: ${recoltesCount}`)

  // Arbres
  for (const a of arbres) {
    await prisma.arbre.create({
      data: {
        userId,
        nom: a.nom,
        type: a.type,
        espece: a.espece,
        variete: a.variete || null,
        portGreffe: a.portGreffe || null,
        datePlantation: a.datePlantation || null,
        posX: a.posX,
        posY: a.posY,
        envergure: a.envergure || 2,
        hauteur: a.hauteur || null,
        etat: a.etat || null,
        pollinisateur: a.pollinisateur || null,
      },
    })
  }
  console.log(`✓ Arbres: ${arbres.length}`)

  // Objets jardin
  for (const o of objetsJardin) {
    await prisma.objetJardin.create({
      data: {
        userId,
        nom: o.nom || null,
        type: o.type,
        largeur: o.largeur,
        longueur: o.longueur,
        posX: o.posX,
        posY: o.posY,
        rotation2D: o.rotation2D || 0,
        couleur: o.couleur || null,
        notes: o.notes || null,
      },
    })
  }
  console.log(`✓ Objets jardin: ${objetsJardin.length}`)

  console.log("\n✅ Seed terminé avec succès!")
}

main()
  .catch((e) => {
    console.error("Erreur:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
