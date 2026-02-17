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

  // Créer les utilisateurs
  const bcrypt = await import("bcryptjs")
  const hashedPasswordAdmin = await bcrypt.hash(process.env.ADMIN_PASSWORD || "changeme", 12)
  const hashedPasswordDemo = await bcrypt.hash("demo", 12)

  // Admin
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: process.env.ADMIN_EMAIL || "admin@gleba.local",
      password: hashedPasswordAdmin,
      name: process.env.ADMIN_NAME || "Administrateur",
      role: "ADMIN",
      active: true,
    },
  })
  console.log(`✓ Utilisateur admin créé (email: ${process.env.ADMIN_EMAIL || "admin@gleba.local"}, password: ${process.env.ADMIN_PASSWORD || "changeme"})`)

  // Demo (utilisateur normal pour tests)
  const hashedPasswordDemoReal = await bcrypt.hash("demo2026", 12)
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@gleba.fr" },
    update: {},
    create: {
      email: "demo@gleba.fr",
      password: hashedPasswordDemoReal,
      name: "Compte Démo",
      role: "USER",
      active: true,
    },
  })
  const demoUserId = demoUser.id
  console.log(`✓ Utilisateur demo créé (email: demo@gleba.fr, password: demo2026, id: ${demoUserId})`)

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
    const existing = await prisma.planche.findFirst({ where: { nom: p.id, userId } })
    if (!existing) {
      await prisma.planche.create({
        data: {
          nom: p.id,
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
  console.log(`✓ Planches admin: ${planches.length}`)

  // Planches DEMO (3 planches simples)
  const planchesDemo = [
    {
      nom: "Demo-A",
      largeur: 1.2,
      longueur: 10,
      surface: 12,
      ilot: "Potager",
      type: "Plein champ",
      irrigation: "Goutte-à-goutte",
      typeSol: "Limoneux",
      retentionEau: "Moyenne",
      posX: 0,
      posY: 0
    },
    {
      nom: "Demo-B",
      largeur: 0.8,
      longueur: 8,
      surface: 6.4,
      ilot: "Potager",
      type: "Plein champ",
      irrigation: "Manuel",
      typeSol: "Sableux",
      retentionEau: "Faible",
      posX: 1.5,
      posY: 0
    },
    {
      nom: "Serre-Demo",
      largeur: 1.0,
      longueur: 6,
      surface: 6,
      ilot: "Serre",
      type: "Serre",
      irrigation: "Goutte-à-goutte",
      typeSol: "Mixte",
      retentionEau: "Moyenne",
      posX: 0,
      posY: 10
    },
  ]

  for (const p of planchesDemo) {
    await prisma.planche.create({
      data: { ...p, userId: demoUserId },
    })
  }
  console.log(`✓ Planches demo: ${planchesDemo.length}`)

  // Build planche name → cuid map for culture FK resolution
  const plancheNameToId: Record<string, string> = {}
  const allSeededPlanches = await prisma.planche.findMany({
    where: { userId },
    select: { id: true, nom: true },
  })
  for (const p of allSeededPlanches) {
    plancheNameToId[p.nom] = p.id
  }

  // Cultures ADMIN
  const cultures = generateCultures(userId)
  for (const c of cultures) {
    const resolvedPlancheId = c.plancheId ? plancheNameToId[c.plancheId] || c.plancheId : null
    await prisma.culture.create({ data: { ...c, plancheId: resolvedPlancheId } })
  }
  console.log(`✓ Cultures admin: ${cultures.length}`)

  // Cultures DEMO (simples pour tester)
  const culturesDemo = [
    {
      userId: demoUserId,
      especeId: "Tomate",
      varieteId: null, // Pas de variété pour simplifier
      plancheId: "Serre-Demo",
      annee: 2026,
      dateSemis: new Date("2026-03-15"),
      datePlantation: new Date("2026-05-01"),
      dateRecolte: new Date("2026-07-15"),
      nbRangs: 2,
      longueur: 5,
      aIrriguer: true,
      semisFait: true,
      plantationFaite: true,
    },
    {
      userId: demoUserId,
      especeId: "Laitue",
      varieteId: null, // Pas de variété spécifique
      plancheId: "Demo-A",
      annee: 2026,
      dateSemis: new Date("2026-04-01"),
      datePlantation: new Date("2026-04-20"),
      dateRecolte: new Date("2026-06-01"),
      nbRangs: 3,
      longueur: 8,
      aIrriguer: true,
      semisFait: true,
      plantationFaite: true,
    },
    {
      userId: demoUserId,
      especeId: "Carotte",
      varieteId: null,
      plancheId: "Demo-B",
      annee: 2026,
      dateSemis: new Date("2026-03-20"),
      dateRecolte: new Date("2026-07-01"),
      nbRangs: 4,
      longueur: 6,
      aIrriguer: true,
      semisFait: true,
    },
  ]

  // Build demo planche name → cuid map
  const demoPlanches = await prisma.planche.findMany({
    where: { userId: demoUserId },
    select: { id: true, nom: true },
  })
  const demoPlancheNameToId: Record<string, string> = {}
  for (const p of demoPlanches) {
    demoPlancheNameToId[p.nom] = p.id
  }

  for (const c of culturesDemo) {
    const resolvedPlancheId = c.plancheId ? demoPlancheNameToId[c.plancheId] || c.plancheId : null
    await prisma.culture.create({ data: { ...c, plancheId: resolvedPlancheId } })
  }
  console.log(`✓ Cultures demo: ${culturesDemo.length}`)

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
