/**
 * Script d'import des données depuis Potaleger (SQLite)
 * Exécuter avec: npx tsx prisma/import-potaleger.ts [chemin_sqlite]
 * Par défaut: /home/guillaume/potamarc/Potaleger.sqlite3
 */

import { PrismaClient } from "@prisma/client"
import Database from "better-sqlite3"

const prisma = new PrismaClient()

// Chemin par défaut vers la base Potaleger
const DEFAULT_SQLITE_PATH = "/home/guillaume/potamarc/Potaleger.sqlite3"

async function importPotaleger(sqlitePath: string) {
  console.log(`\n📂 Import depuis: ${sqlitePath}\n`)

  // Ouvrir la base SQLite
  const sqlite = new Database(sqlitePath, { readonly: true })

  try {
    // ================================================================
    // 1. FAMILLES
    // ================================================================
    console.log("📦 Import des familles...")
    const familles = sqlite.prepare("SELECT * FROM Familles").all() as any[]

    for (const f of familles) {
      await prisma.famille.upsert({
        where: { id: f.Famille },
        update: {
          intervalle: f.Intervalle || 4,
          couleur: f.Couleur || null,
          description: f.Notes || null,
        },
        create: {
          id: f.Famille,
          intervalle: f.Intervalle || 4,
          couleur: f.Couleur || null,
          description: f.Notes || null,
        },
      })
    }
    console.log(`   ✓ ${familles.length} familles importées`)

    // ================================================================
    // 2. FOURNISSEURS
    // ================================================================
    console.log("📦 Import des fournisseurs...")
    const fournisseurs = sqlite.prepare("SELECT * FROM Fournisseurs").all() as any[]

    for (const f of fournisseurs) {
      await prisma.fournisseur.upsert({
        where: { id: f.Fournisseur },
        update: {
          contact: f.Contact || null,
          adresse: f.Adresse || null,
          email: f.Email || null,
          telephone: f.Téléphone || null,
          siteWeb: f.Site_web || null,
          notes: f.Notes || null,
        },
        create: {
          id: f.Fournisseur,
          contact: f.Contact || null,
          adresse: f.Adresse || null,
          email: f.Email || null,
          telephone: f.Téléphone || null,
          siteWeb: f.Site_web || null,
          notes: f.Notes || null,
        },
      })
    }
    console.log(`   ✓ ${fournisseurs.length} fournisseurs importés`)

    // ================================================================
    // 3. DESTINATIONS
    // ================================================================
    console.log("📦 Import des destinations...")
    const destinations = sqlite.prepare("SELECT * FROM Destinations").all() as any[]

    for (const d of destinations) {
      await prisma.destination.upsert({
        where: { id: d.Destination },
        update: { description: d.Notes || null },
        create: { id: d.Destination, description: d.Notes || null },
      })
    }
    console.log(`   ✓ ${destinations.length} destinations importées`)

    // ================================================================
    // 4. FERTILISANTS
    // ================================================================
    console.log("📦 Import des fertilisants...")
    const fertilisants = sqlite.prepare("SELECT * FROM Fertilisants").all() as any[]

    for (const f of fertilisants) {
      await prisma.fertilisant.upsert({
        where: { id: f.Fertilisant },
        update: {
          type: f.Type || null,
          n: f.N || null,
          p: f.P || null,
          k: f.K || null,
          ca: f.Ca || null,
          mg: f.Mg || null,
          densite: f.Densité || null,
          prix: f.Prix || null,
          description: f.Notes || null,
        },
        create: {
          id: f.Fertilisant,
          type: f.Type || null,
          n: f.N || null,
          p: f.P || null,
          k: f.K || null,
          ca: f.Ca || null,
          mg: f.Mg || null,
          densite: f.Densité || null,
          prix: f.Prix || null,
          description: f.Notes || null,
        },
      })
    }
    console.log(`   ✓ ${fertilisants.length} fertilisants importés`)

    // ================================================================
    // 5. ESPÈCES
    // ================================================================
    console.log("📦 Import des espèces...")
    const especes = sqlite.prepare("SELECT * FROM Espèces").all() as any[]

    for (const e of especes) {
      // Vérifier que la famille existe
      const familleId = e.Famille
      if (familleId) {
        const familleExists = await prisma.famille.findUnique({ where: { id: familleId } })
        if (!familleExists) {
          console.log(`   ⚠ Famille "${familleId}" non trouvée pour espèce "${e.Espèce}", ignorée`)
        }
      }

      // Déterminer le type basé sur les catégories
      let type = "legume"
      if (e.Catégories) {
        if (e.Catégories.includes("🌳") || e.Catégories.includes("ar")) type = "arbre_fruitier"
        else if (e.Catégories.includes("🍓") || e.Catégories.includes("pf")) type = "petit_fruit"
        else if (e.Catégories.includes("🟩") || e.Catégories.includes("ev")) type = "engrais_vert"
        else if (e.Catégories.includes("🌺") || e.Catégories.includes("am")) type = "aromatique"
      }

      await prisma.espece.upsert({
        where: { id: e.Espèce },
        update: {
          type,
          familleId: familleId || null,
          rendement: e.Rendement || null,
          vivace: e.Vivace === "x" || e.Vivace === 1,
          besoinN: e.N || null,
          besoinP: e.P || null,
          besoinK: e.K || null,
          aPlanifier: e.A_planifier === "x" || e.A_planifier === 1,
          description: e.Notes || null,
          // Nouveaux champs
          categorie: e.Catégories || null,
          niveau: e.Niveau || null,
          densite: e.Densité || null,
          // BUG-feedback Marc 2026-05-16 : Potaleger.Dose_semis est exprimé
          // en « g pour 100 m² » mais lu tel quel en g/m² (×100 trop). On
          // n'écrase plus la valeur agronomique posée par les migrations.
          // doseSemis: e.Dose_semis || null,
          tauxGermination: e.FG || null,
          temperatureGerm: e.T_germ || null,
          joursLevee: e.Levée ? Math.round(e.Levée) : null,
          irrigation: e.Irrig || null,
          conservation: e.Conservation === "x" || e.Conservation === 1,
          objectifAnnuel: e.Obj_annuel || null,
          prixKg: e.Prix_kg || null,
          semaineTaille: e.S_taille || null,
        },
        create: {
          id: e.Espèce,
          type,
          familleId: familleId || null,
          rendement: e.Rendement || null,
          vivace: e.Vivace === "x" || e.Vivace === 1,
          besoinN: e.N || null,
          besoinP: e.P || null,
          besoinK: e.K || null,
          aPlanifier: e.A_planifier === "x" || e.A_planifier === 1,
          description: e.Notes || null,
          categorie: e.Catégories || null,
          niveau: e.Niveau || null,
          densite: e.Densité || null,
          // BUG-feedback Marc 2026-05-16 : voir note ci-dessus, on ne pose
          // pas la valeur Potaleger ; les migrations agronomiques
          // initialiseront `dose_semis` à la valeur correcte.
          // doseSemis: e.Dose_semis || null,
          tauxGermination: e.FG || null,
          temperatureGerm: e.T_germ || null,
          joursLevee: e.Levée ? Math.round(e.Levée) : null,
          irrigation: e.Irrig || null,
          conservation: e.Conservation === "x" || e.Conservation === 1,
          objectifAnnuel: e.Obj_annuel || null,
          prixKg: e.Prix_kg || null,
          semaineTaille: e.S_taille || null,
        },
      })
    }
    console.log(`   ✓ ${especes.length} espèces importées`)

    // ================================================================
    // 6. VARIÉTÉS
    // ================================================================
    console.log("📦 Import des variétés...")
    const varietes = sqlite.prepare("SELECT * FROM Variétés").all() as any[]

    for (const v of varietes) {
      // Vérifier que l'espèce existe
      const especeExists = await prisma.espece.findUnique({ where: { id: v.Espèce } })
      if (!especeExists) {
        console.log(`   ⚠ Espèce "${v.Espèce}" non trouvée pour variété "${v.Variété}", ignorée`)
        continue
      }

      await prisma.variete.upsert({
        where: { id: v.Variété },
        update: {
          especeId: v.Espèce,
          fournisseurId: v.Fournisseur || null,
          semaineRecolte: v.S_récolte || null,
          dureeRecolte: v.D_récolte || null,
          nbGrainesG: v.Nb_graines_g || null,
          prixGraine: v.Prix_graine || null,
          stockGraines: v.Stock_graines || null,
          bio: v.Bio === "x" || v.Bio === 1,
          description: v.Notes || null,
        },
        create: {
          id: v.Variété,
          especeId: v.Espèce,
          fournisseurId: v.Fournisseur || null,
          semaineRecolte: v.S_récolte || null,
          dureeRecolte: v.D_récolte || null,
          nbGrainesG: v.Nb_graines_g || null,
          prixGraine: v.Prix_graine || null,
          stockGraines: v.Stock_graines || null,
          bio: v.Bio === "x" || v.Bio === 1,
          description: v.Notes || null,
        },
      })
    }
    console.log(`   ✓ ${varietes.length} variétés importées`)

    // ================================================================
    // 7. ITPs
    // ================================================================
    console.log("📦 Import des ITPs...")
    const itps = sqlite.prepare("SELECT * FROM ITP").all() as any[]

    for (const itp of itps) {
      // Vérifier que l'espèce existe si spécifiée
      if (itp.Espèce) {
        const especeExists = await prisma.espece.findUnique({ where: { id: itp.Espèce } })
        if (!especeExists) {
          console.log(`   ⚠ Espèce "${itp.Espèce}" non trouvée pour ITP "${itp.IT_plante}", espèce ignorée`)
          itp.Espèce = null
        }
      }

      await prisma.iTP.upsert({
        where: { id: itp.IT_plante },
        update: {
          especeId: itp.Espèce || null,
          semaineSemis: itp.S_semis || null,
          semainePlantation: itp.S_plantation || null,
          semaineRecolte: itp.S_récolte || null,
          dureeRecolte: itp.D_récolte || null,
          dureeCulture: itp.D_culture || null,
          nbRangs: itp.Nb_rangs || null,
          espacement: itp.Espacement || null,
          notes: itp.Notes || null,
          // Nouveaux champs
          typePlanche: itp.Type_planche || null,
          decalageMax: itp.Décal_max || null,
          espacementRangs: itp.Esp_rangs || null,
          nbGrainesPlant: itp.Nb_graines_plant || null,
          doseSemis: itp.Dose_semis || null,
        },
        create: {
          id: itp.IT_plante,
          especeId: itp.Espèce || null,
          semaineSemis: itp.S_semis || null,
          semainePlantation: itp.S_plantation || null,
          semaineRecolte: itp.S_récolte || null,
          dureeRecolte: itp.D_récolte || null,
          dureeCulture: itp.D_culture || null,
          nbRangs: itp.Nb_rangs || null,
          espacement: itp.Espacement || null,
          notes: itp.Notes || null,
          typePlanche: itp.Type_planche || null,
          decalageMax: itp.Décal_max || null,
          espacementRangs: itp.Esp_rangs || null,
          nbGrainesPlant: itp.Nb_graines_plant || null,
          doseSemis: itp.Dose_semis || null,
        },
      })
    }
    console.log(`   ✓ ${itps.length} ITPs importés`)

    // ================================================================
    // 8. ROTATIONS
    // ================================================================
    console.log("📦 Import des rotations...")
    const rotations = sqlite.prepare("SELECT * FROM Rotations").all() as any[]

    for (const r of rotations) {
      await prisma.rotation.upsert({
        where: { id: r.Rotation },
        update: {
          active: r.Active === "x" || r.Active === 1,
          nbAnnees: r.Nb_années || null,
          notes: r.Notes || null,
        },
        create: {
          id: r.Rotation,
          active: r.Active === "x" || r.Active === 1,
          nbAnnees: r.Nb_années || null,
          notes: r.Notes || null,
        },
      })
    }
    console.log(`   ✓ ${rotations.length} rotations importées`)

    // ================================================================
    // 9. ROTATIONS DÉTAILS
    // ================================================================
    console.log("📦 Import des détails de rotations...")
    const rotationsDetails = sqlite.prepare("SELECT * FROM Rotations_détails").all() as any[]

    for (const rd of rotationsDetails) {
      // Vérifier que la rotation et l'ITP existent
      const rotationExists = await prisma.rotation.findUnique({ where: { id: rd.Rotation } })
      if (!rotationExists) continue

      if (rd.IT_plante) {
        const itpExists = await prisma.iTP.findUnique({ where: { id: rd.IT_plante } })
        if (!itpExists) {
          console.log(`   ⚠ ITP "${rd.IT_plante}" non trouvé, ignoré`)
          continue
        }
      }

      // Vérifier si le détail existe déjà
      const existing = await prisma.rotationDetail.findFirst({
        where: { rotationId: rd.Rotation, annee: rd.Année },
      })

      if (!existing) {
        await prisma.rotationDetail.create({
          data: {
            rotationId: rd.Rotation,
            itpId: rd.IT_plante || null,
            annee: rd.Année,
          },
        })
      }
    }
    console.log(`   ✓ ${rotationsDetails.length} détails de rotations importés`)

    // ================================================================
    // 10. ASSOCIATIONS
    // ================================================================
    console.log("📦 Import des associations...")
    const associations = sqlite.prepare("SELECT * FROM Associations_détails").all() as any[]

    // Grouper par nom d'association
    const associationsMap = new Map<string, any[]>()
    for (const a of associations) {
      const assocName = a.Association
      if (!associationsMap.has(assocName)) {
        associationsMap.set(assocName, [])
      }
      associationsMap.get(assocName)!.push(a)
    }

    let assocCount = 0
    for (const [nom, details] of associationsMap) {
      // Bug #cmp8do6vd (2026-05-16) : déduire le type depuis le nom (convention
      // Potaleger : `Truc !` = incompatibilité, `Truc +` ou nom simple = favorable).
      // Sans ça, toutes les associations étaient `favorable` par défaut, et
      // les listes d'incompatibilités étaient affichées comme conseillées.
      const lower = nom.toLowerCase()
      const type =
        nom.includes("!") ||
        lower.includes("incompat") ||
        lower.includes("défavorable") ||
        lower.includes("defavorable")
          ? "incompatible"
          : "favorable"
      // Créer ou mettre à jour l'association
      const association = await prisma.association.upsert({
        where: { nom },
        update: { type },
        create: { nom, type },
      })

      // Supprimer les anciens détails
      await prisma.associationDetail.deleteMany({
        where: { associationId: association.id },
      })

      // Créer les nouveaux détails
      for (const d of details) {
        // Vérifier les références
        let especeId = d.Espèce || null
        let familleId = d.Famille || null

        if (especeId) {
          const exists = await prisma.espece.findUnique({ where: { id: especeId } })
          if (!exists) especeId = null
        }

        if (familleId) {
          const exists = await prisma.famille.findUnique({ where: { id: familleId } })
          if (!exists) familleId = null
        }

        await prisma.associationDetail.create({
          data: {
            associationId: association.id,
            especeId,
            familleId,
            groupe: d.Groupe || null,
            requise: d.Requise === "x" || d.Requise === 1 || d.Requise === true,
            notes: d.Notes || null,
          },
        })
      }
      assocCount++
    }
    console.log(`   ✓ ${assocCount} associations (${associations.length} détails) importées`)

    // ================================================================
    // RÉSUMÉ
    // ================================================================
    console.log("\n" + "=".repeat(50))
    console.log("✅ IMPORT TERMINÉ AVEC SUCCÈS")
    console.log("=".repeat(50))
    console.log(`
📊 Résumé:
   - ${familles.length} familles
   - ${fournisseurs.length} fournisseurs
   - ${destinations.length} destinations
   - ${fertilisants.length} fertilisants
   - ${especes.length} espèces
   - ${varietes.length} variétés
   - ${itps.length} ITPs
   - ${rotations.length} rotations
   - ${assocCount} associations (${associations.length} détails)
`)
  } finally {
    sqlite.close()
  }
}

// Exécution
const sqlitePath = process.argv[2] || DEFAULT_SQLITE_PATH

importPotaleger(sqlitePath)
  .catch((e) => {
    console.error("\n❌ Erreur:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
