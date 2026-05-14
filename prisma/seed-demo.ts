/**
 * Seed du compte démo « Ferme du Bois Joli ».
 *
 * Voir `docs/demo-scenario.md` pour le scénario complet (identité, surfaces,
 * cheptel, comptabilité, invariants). Ce script implémente le scénario.
 *
 * Pré-requis :
 *   - La base de données doit avoir été initialisée (`npx prisma migrate deploy`).
 *   - Le seed référentiel doit avoir été exécuté (`npx tsx prisma/seed.ts`)
 *     pour disposer des Espèces, Variétés et Familles botaniques.
 *   - Pour repartir d'un état propre : `npx tsx prisma/reset-demo.ts` AVANT.
 *
 * Usage :
 *   npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// DEMO_EMAIL_OVERRIDE permet de pointer le seed sur un autre compte (ex
// admin@gleba.fr) via le script clone-demo-to-admin.ts. Sans override,
// pointage par défaut sur demo@gleba.fr.
const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"
const DEMO_PASSWORD = process.env.DEMO_PASSWORD_OVERRIDE || "demo2026"
const DEMO_NAME = process.env.DEMO_NAME_OVERRIDE || "Ferme du Bois Joli"

const ANNEE = 2026

// ─────────────────────────────────────────────────────────────────────────────
//                              UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

function d(iso: string): Date {
  return new Date(`${iso}T08:00:00Z`)
}

function geoSquare(centerLat: number, centerLng: number, sideMetres: number): string {
  const halfDeg = sideMetres / 2 / 111_000
  const cosLat = Math.cos((centerLat * Math.PI) / 180)
  const halfDegLng = halfDeg / cosLat
  const coords = [
    [centerLng - halfDegLng, centerLat - halfDeg],
    [centerLng + halfDegLng, centerLat - halfDeg],
    [centerLng + halfDegLng, centerLat + halfDeg],
    [centerLng - halfDegLng, centerLat + halfDeg],
    [centerLng - halfDegLng, centerLat - halfDeg],
  ]
  return JSON.stringify({ type: "Polygon", coordinates: [coords] })
}

// ─────────────────────────────────────────────────────────────────────────────
//                              SEED
// ─────────────────────────────────────────────────────────────────────────────

async function ensureUser() {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12)
  // Quand on clone le seed sur un compte existant (DEMO_EMAIL_OVERRIDE),
  // on ne touche PAS au mot de passe, nom et role du compte cible — sinon
  // on écrase silencieusement les credentials de l'admin.
  // Pour le seed démo normal (demo@gleba.fr), on garde le comportement
  // d'origine qui réinitialise le mdp à "demo2026".
  const isClone = Boolean(process.env.DEMO_EMAIL_OVERRIDE)
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: isClone
      ? { active: true } // ne modifie que le flag actif
      : { name: DEMO_NAME, password: hashed, active: true },
    create: {
      email: DEMO_EMAIL,
      password: hashed,
      name: DEMO_NAME,
      role: "USER",
      active: true,
      emailVerified: true,
    },
  })
}

async function ensureUserPreferences(userId: string) {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: "modulesActifs" } },
    update: { value: JSON.stringify(["maraichage", "verger", "elevage", "comptabilite"]) },
    create: {
      userId,
      key: "modulesActifs",
      value: JSON.stringify(["maraichage", "verger", "elevage", "comptabilite"]),
    },
  })
}

async function ensureEspeceAnimale() {
  const data = [
    { id: "poule_marans", nom: "Poule Marans", type: "volaille", production: "oeufs", dureeCouvaison: 21, poidsAdulte: 3.0, ponteAnnuelle: 180, consommationJour: 0.13, prixAchat: 18, couleur: "#3f3a1f", description: "Pondeuse noire cuivrée" },
    { id: "brebis_solognote", nom: "Brebis Solognote", type: "mammifere_grand", production: "viande", dureeGestation: 150, poidsAdulte: 55, rendementCarcasse: 45, prixAchat: 220, couleur: "#8b6f3e", description: "Race rustique solognote" },
    { id: "chevre_alpine", nom: "Chèvre Alpine chamoisée", type: "mammifere_grand", production: "lait", dureeGestation: 150, poidsAdulte: 65, prixAchat: 350, couleur: "#a07050", description: "Chèvre laitière (~ 700 L/lactation)" },
    { id: "cochon_gascon", nom: "Cochon Gascon", type: "mammifere_grand", production: "viande", dureeGestation: 114, poidsAdulte: 250, rendementCarcasse: 75, prixAchat: 200, couleur: "#1a1a1a", description: "Race rustique noire" },
    { id: "lapin_geant", nom: "Lapin Géant des Flandres", type: "mammifere_petit", production: "viande", dureeGestation: 31, poidsAdulte: 7, rendementCarcasse: 60, prixAchat: 35, couleur: "#a89070", description: "Grande race, élevage familial" },
  ]
  for (const e of data) {
    await prisma.especeAnimale.upsert({ where: { id: e.id }, update: e, create: e })
  }
}

async function seedParcellesGeo(userId: string) {
  const lat = 46.93
  const lng = -1.21
  const parcelles = [
    { nom: "Demo-A · Serre", surface: 0.02, geometry: geoSquare(lat + 0.0002, lng, 14), centroidLat: lat + 0.0002, centroidLng: lng, couches: ["MARAICHAGE" as const], typeSol: "limono-sableux", usage: "culture", commune: "La Boissière-de-Montaigu", couleur: "#10b981" },
    { nom: "Demo-B · Plein champ", surface: 0.08, geometry: geoSquare(lat + 0.0005, lng + 0.0003, 28), centroidLat: lat + 0.0005, centroidLng: lng + 0.0003, couches: ["MARAICHAGE" as const], typeSol: "limono-argileux", usage: "culture", commune: "La Boissière-de-Montaigu", couleur: "#16a34a" },
    { nom: "Demo-C · Tunnel", surface: 0.02, geometry: geoSquare(lat - 0.0002, lng - 0.0003, 14), centroidLat: lat - 0.0002, centroidLng: lng - 0.0003, couches: ["MARAICHAGE" as const], typeSol: "limono-sableux", usage: "culture", commune: "La Boissière-de-Montaigu", couleur: "#22c55e" },
    { nom: "Demo-V · Verger", surface: 0.08, geometry: geoSquare(lat + 0.0008, lng - 0.0005, 28), centroidLat: lat + 0.0008, centroidLng: lng - 0.0005, couches: ["VERGER" as const], typeSol: "limono-argileux", usage: "verger", commune: "La Boissière-de-Montaigu", couleur: "#65a30d" },
    { nom: "Demo-P · Pâture", surface: 0.4, geometry: geoSquare(lat - 0.0008, lng + 0.0008, 63), centroidLat: lat - 0.0008, centroidLng: lng + 0.0008, couches: ["PATURAGE" as const, "ELEVAGE" as const], typeSol: "limono-argileux", usage: "prairie", commune: "La Boissière-de-Montaigu", couleur: "#a3a300" },
  ]
  const created: Record<string, string> = {}
  for (const p of parcelles) {
    const row = await prisma.parcelleGeo.create({ data: { userId, ...p } })
    created[p.nom] = row.id
  }
  return created
}

async function seedPlanches(userId: string) {
  const planches = [
    { nom: "A1", longueur: 8, largeur: 1.2 }, { nom: "A2", longueur: 8, largeur: 1.2 }, { nom: "A3", longueur: 8, largeur: 1.2 },
    { nom: "B1", longueur: 25, largeur: 1.2 }, { nom: "B2", longueur: 25, largeur: 1.2 }, { nom: "B3", longueur: 25, largeur: 1.2 },
    { nom: "B4", longueur: 25, largeur: 1.2 }, { nom: "B5", longueur: 25, largeur: 1.2 }, { nom: "B6", longueur: 25, largeur: 1.2 },
    { nom: "C1", longueur: 10, largeur: 1.2 }, { nom: "C2", longueur: 10, largeur: 1.2 }, { nom: "C3", longueur: 10, largeur: 1.2 },
  ]
  const created: Record<string, string> = {}
  for (const p of planches) {
    const row = await prisma.planche.create({ data: { userId, nom: p.nom, longueur: p.longueur, largeur: p.largeur } })
    created[p.nom] = row.id
  }
  return created
}

async function seedCultures(userId: string, planches: Record<string, string>) {
  type CSpec = { planche: string; espece: string; variete?: string; dateSemis?: string; datePlantation?: string; dateRecolte?: string; surface: number; semisFait?: boolean; plantationFaite?: boolean; nbPlants?: number }
  const specs: CSpec[] = [
    { planche: "A1", espece: "Tomate", variete: "Tomate-Marmande", dateSemis: "2026-03-01", datePlantation: "2026-04-15", dateRecolte: "2026-07-10", surface: 9.6, semisFait: true, plantationFaite: true, nbPlants: 18 },
    { planche: "A2", espece: "Tomate", variete: "Tomate-Coeur de Boeuf", dateSemis: "2026-03-01", datePlantation: "2026-04-15", dateRecolte: "2026-07-15", surface: 9.6, semisFait: true, plantationFaite: true, nbPlants: 16 },
    { planche: "A3", espece: "Aubergine", variete: "Aubergine-Violette longue", dateSemis: "2026-02-15", datePlantation: "2026-04-20", dateRecolte: "2026-07-20", surface: 9.6, semisFait: true, plantationFaite: true, nbPlants: 14 },
    { planche: "B1", espece: "Carotte", variete: "Carotte-Nantaise", dateSemis: "2026-03-15", dateRecolte: "2026-07-01", surface: 30, semisFait: true },
    { planche: "B2", espece: "Oignon", dateSemis: "2026-02-20", datePlantation: "2026-04-01", dateRecolte: "2026-08-15", surface: 30, semisFait: true, plantationFaite: true, nbPlants: 300 },
    { planche: "B3", espece: "Pomme de terre", datePlantation: "2026-04-10", dateRecolte: "2026-07-25", surface: 30, plantationFaite: true },
    { planche: "B4", espece: "Haricot vert", variete: "Haricot-Contender", dateSemis: "2026-05-15", dateRecolte: "2026-07-25", surface: 30 },
    { planche: "B5", espece: "Courge butternut", variete: "Courge butternut-Waltham", dateSemis: "2026-04-15", datePlantation: "2026-05-25", dateRecolte: "2026-10-01", surface: 30, semisFait: true },
    { planche: "B6", espece: "Fève", dateSemis: "2026-02-01", dateRecolte: "2026-05-18", surface: 30, semisFait: true },
    { planche: "C1", espece: "Radis", dateSemis: "2026-04-20", dateRecolte: "2026-05-15", surface: 12, semisFait: true },
    { planche: "C2", espece: "Laitue", variete: "Laitue-Batavia", dateSemis: "2026-03-20", datePlantation: "2026-04-25", dateRecolte: "2026-05-20", surface: 12, semisFait: true, plantationFaite: true },
    { planche: "C2", espece: "Laitue", variete: "Laitue-Feuille de chêne", dateSemis: "2026-04-15", datePlantation: "2026-05-15", dateRecolte: "2026-06-15", surface: 12, semisFait: true },
    { planche: "C3", espece: "Épinard", dateSemis: "2026-03-25", dateRecolte: "2026-05-12", surface: 12, semisFait: true },
    { planche: "C3", espece: "Basilic", dateSemis: "2026-04-20", datePlantation: "2026-05-25", dateRecolte: "2026-07-01", surface: 12, semisFait: true },
    { planche: "A1", espece: "Concombre", dateSemis: "2026-05-25", datePlantation: "2026-06-15", dateRecolte: "2026-07-25", surface: 9.6 },
    { planche: "B4", espece: "Petit pois", dateSemis: "2026-06-01", dateRecolte: "2026-08-15", surface: 30 },
    { planche: "C1", espece: "Radis", dateSemis: "2026-05-10", dateRecolte: "2026-06-05", surface: 12, semisFait: true },
    { planche: "B6", espece: "Haricot sec", variete: "Haricot-Coco de Prague", dateSemis: "2026-05-30", dateRecolte: "2026-09-15", surface: 30 },
  ]
  const especeIds = [...new Set(specs.map((s) => s.espece))]
  const existing = await prisma.espece.findMany({ where: { id: { in: especeIds } }, select: { id: true } })
  const existingSet = new Set(existing.map((e) => e.id))
  const missing = especeIds.filter((id) => !existingSet.has(id))
  if (missing.length) {
    console.warn(`⚠ Espèces référentielles absentes : ${missing.join(", ")}`)
  }
  for (const s of specs) {
    if (!existingSet.has(s.espece)) continue
    let varieteId: string | null = null
    if (s.variete) {
      const v = await prisma.variete.findUnique({ where: { id: s.variete } })
      if (v) varieteId = s.variete
    }
    await prisma.culture.create({
      data: {
        userId,
        especeId: s.espece,
        varieteId,
        plancheId: planches[s.planche],
        annee: ANNEE,
        dateSemis: s.dateSemis ? d(s.dateSemis) : null,
        datePlantation: s.datePlantation ? d(s.datePlantation) : null,
        dateRecolte: s.dateRecolte ? d(s.dateRecolte) : null,
        semisFait: s.semisFait ?? false,
        plantationFaite: s.plantationFaite ?? false,
        // `quantite` représente la surface m² (ou le nb de plants si applicable)
        quantite: s.surface,
      },
    })
  }
}

async function seedRecoltes(userId: string, planches: Record<string, string>) {
  const data = [
    { espece: "Radis", planche: "C1", date: "2026-05-08", quantite: 6 },
    { espece: "Radis", planche: "C1", date: "2026-05-12", quantite: 5 },
    { espece: "Laitue", planche: "C2", date: "2026-05-10", quantite: 12 },
    { espece: "Laitue", planche: "C2", date: "2026-05-13", quantite: 14 },
    { espece: "Épinard", planche: "C3", date: "2026-05-05", quantite: 10 },
    { espece: "Épinard", planche: "C3", date: "2026-05-11", quantite: 14 },
    { espece: "Fève", planche: "B6", date: "2026-05-12", quantite: 12 },
    { espece: "Fève", planche: "B6", date: "2026-05-14", quantite: 12 },
  ]
  for (const r of data) {
    const espece = await prisma.espece.findUnique({ where: { id: r.espece } })
    if (!espece) continue
    const culture = await prisma.culture.findFirst({
      where: { userId, especeId: r.espece, plancheId: planches[r.planche] },
      orderBy: { id: "asc" },
    })
    if (!culture) continue
    await prisma.recolte.create({
      data: {
        userId,
        especeId: r.espece,
        cultureId: culture.id,
        date: d(r.date),
        quantite: r.quantite,
        statut: "vendu",
      },
    })
  }
}

async function seedArbres(userId: string, parcelles: Record<string, string>) {
  const parcelleId = parcelles["Demo-V · Verger"]
  type ASpec = { nom: string; espece: string; variete: string; portGreffe?: string; plantation: string; posX: number; posY: number }
  const arbres: ASpec[] = [
    { nom: "Pommier Reine 1", espece: "Pommier", variete: "Reine des Reinettes", portGreffe: "M106", plantation: "2022-03-15", posX: 5, posY: 5 },
    { nom: "Pommier Reine 2", espece: "Pommier", variete: "Reine des Reinettes", portGreffe: "M106", plantation: "2022-03-15", posX: 9, posY: 5 },
    { nom: "Pommier Reine 3", espece: "Pommier", variete: "Reine des Reinettes", portGreffe: "M106", plantation: "2022-03-15", posX: 13, posY: 5 },
    { nom: "Pommier Reine 4", espece: "Pommier", variete: "Reine des Reinettes", portGreffe: "M106", plantation: "2022-03-15", posX: 17, posY: 5 },
    { nom: "Pommier Reine 5", espece: "Pommier", variete: "Reine des Reinettes", portGreffe: "M106", plantation: "2022-03-15", posX: 21, posY: 5 },
    { nom: "Pommier Golden 1", espece: "Pommier", variete: "Golden", portGreffe: "MM106", plantation: "2022-03-15", posX: 5, posY: 10 },
    { nom: "Pommier Golden 2", espece: "Pommier", variete: "Golden", portGreffe: "MM106", plantation: "2022-03-15", posX: 9, posY: 10 },
    { nom: "Pommier Golden 3", espece: "Pommier", variete: "Golden", portGreffe: "MM106", plantation: "2022-03-15", posX: 13, posY: 10 },
    { nom: "Pommier Golden 4", espece: "Pommier", variete: "Golden", portGreffe: "MM106", plantation: "2022-03-15", posX: 17, posY: 10 },
    { nom: "Poirier Williams 1", espece: "Poirier", variete: "Williams", portGreffe: "Cognassier BA29", plantation: "2023-03-10", posX: 5, posY: 15 },
    { nom: "Poirier Williams 2", espece: "Poirier", variete: "Williams", portGreffe: "Cognassier BA29", plantation: "2023-03-10", posX: 9, posY: 15 },
    { nom: "Poirier Williams 3", espece: "Poirier", variete: "Williams", portGreffe: "Cognassier BA29", plantation: "2023-03-10", posX: 13, posY: 15 },
    { nom: "Prunier Mirabelle 1", espece: "Prunier", variete: "Mirabelle de Nancy", portGreffe: "Saint-Julien A", plantation: "2023-03-10", posX: 5, posY: 20 },
    { nom: "Prunier Mirabelle 2", espece: "Prunier", variete: "Mirabelle de Nancy", portGreffe: "Saint-Julien A", plantation: "2023-03-10", posX: 9, posY: 20 },
    { nom: "Prunier Mirabelle 3", espece: "Prunier", variete: "Mirabelle de Nancy", portGreffe: "Saint-Julien A", plantation: "2023-03-10", posX: 13, posY: 20 },
    { nom: "Cerisier Burlat 1", espece: "Prunier", variete: "Burlat", portGreffe: "Sainte-Lucie", plantation: "2024-03-05", posX: 17, posY: 15 },
    { nom: "Cerisier Burlat 2", espece: "Prunier", variete: "Burlat", portGreffe: "Sainte-Lucie", plantation: "2024-03-05", posX: 17, posY: 20 },
    // Bug #2 audit 2026-05-14 — Espèces incorrectes "Pommier" pour Figuier/Noyer.
    { nom: "Figuier Brown Turkey", espece: "Figuier", variete: "Brown Turkey", plantation: "2022-04-01", posX: 21, posY: 10 },
    { nom: "Noyer Franquette 1", espece: "Noyer", variete: "Franquette", plantation: "2020-11-15", posX: 21, posY: 15 },
    { nom: "Noyer Franquette 2", espece: "Noyer", variete: "Franquette", plantation: "2020-11-15", posX: 21, posY: 20 },
  ]
  const created: number[] = []
  for (const a of arbres) {
    const espExists = await prisma.espece.findUnique({ where: { id: a.espece } })
    const row = await prisma.arbre.create({
      data: {
        userId, nom: a.nom, type: "fruitier",
        especeId: espExists ? a.espece : null,
        espece: a.espece, variete: a.variete,
        portGreffe: a.portGreffe ?? null,
        datePlantation: d(a.plantation),
        posX: a.posX, posY: a.posY, envergure: 3, etat: "bon",
        parcelleGeoId: parcelleId,
      },
    })
    created.push(row.id)
  }
  // Observation santé : tavelure Pommier Golden 1
  if (created[5]) {
    await prisma.observationSante.create({
      data: { userId, arbreId: created[5], date: d("2026-04-08"), type: "maladie", diagnostic: "Tavelure", gravite: "moyenne", traitement: "Bouillie bordelaise à venir" },
    })
  }
  // Opérations de taille
  for (const i of [0, 1, 5, 9]) {
    if (created[i]) {
      await prisma.operationArbre.create({
        data: { userId, arbreId: created[i], date: d(i === 9 ? "2026-02-12" : "2026-02-05"), type: "taille", notes: i === 9 ? "Taille de formation poirier" : "Taille hiver" },
      })
    }
  }
}

async function seedElevage(userId: string, parcelles: Record<string, string>) {
  const enclosId = parcelles["Demo-P · Pâture"]
  const lotPondeuses = await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "poule_marans", nom: "Pondeuses 2026", dateArrivee: d("2026-01-15"), quantiteInitiale: 30, quantiteActuelle: 29, provenance: "Couvoir de Cholet", prixAchatTotal: 540, statut: "actif", notes: "30 poulettes Marans 18 sem — 1 perte coccidiose en S6" },
  })
  const lotSolognote = await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "brebis_solognote", nom: "Solognote 2025", dateArrivee: d("2025-04-10"), quantiteInitiale: 15, quantiteActuelle: 15, provenance: "Élevage Pluchard (45)", prixAchatTotal: 3300, statut: "actif", notes: "15 agnelles. Première mise-bas printemps 2026.", parcelleGeoId: enclosId },
  })
  await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "lapin_geant", nom: "Lapins 2026", dateArrivee: d("2026-03-01"), quantiteInitiale: 7, quantiteActuelle: 19, provenance: "Élevage local", prixAchatTotal: 245, statut: "actif", notes: "6 femelles + 1 mâle, 4 mises-bas (12 lapereaux)" },
  })

  const alpines = [
    { nom: "Bergère", naissance: "2022-03-15" }, { nom: "Clochette", naissance: "2022-04-02" },
    { nom: "Vanille", naissance: "2023-03-20" }, { nom: "Praline", naissance: "2024-03-05" },
  ]
  for (const a of alpines) {
    await prisma.animal.create({
      data: { userId, especeAnimaleId: "chevre_alpine", nom: a.nom, race: "Alpine chamoisée", sexe: "femelle", dateNaissance: d(a.naissance), dateArrivee: d("2024-06-20"), provenance: "GAEC du Bocage", prixAchat: 350, statut: "actif" },
    })
  }
  const cochons = [{ nom: "Grognon", sexe: "male" }, { nom: "Rosette", sexe: "femelle" }]
  for (const c of cochons) {
    await prisma.animal.create({
      data: { userId, especeAnimaleId: "cochon_gascon", nom: c.nom, race: "Gascon", sexe: c.sexe, dateNaissance: d("2025-09-15"), dateArrivee: d("2026-02-05"), provenance: "Ferme du Coteau (32)", prixAchat: 200, statut: "actif" },
    })
  }

  // 18 semaines de production œufs (S2 à S19), ~70/sem → ~1260 œufs YTD
  for (let semaine = 2; semaine <= 19; semaine++) {
    const date = new Date(2026, 0, 1)
    date.setDate(date.getDate() + (semaine - 1) * 7)
    await prisma.productionOeuf.create({
      data: { userId, lotId: lotPondeuses.id, date, quantite: 65 + ((semaine * 7) % 12) },
    })
  }
  await prisma.soinAnimal.create({
    data: { userId, lotId: lotSolognote.id, date: d("2026-03-20"), type: "vermifuge", produit: "Doramectine", cout: 45 },
  })
}

async function seedBoutique(userId: string) {
  // Le slug est unique global → on suffixe avec un fragment du userId
  // pour permettre plusieurs clones du démo sur des comptes distincts.
  const slugBase = "ferme-du-bois-joli"
  const slug = slugBase + (process.env.DEMO_EMAIL_OVERRIDE ? `-${userId.slice(-6)}` : "")
  const boutique = await prisma.boutique.create({
    data: { userId, slug, nom: "Ferme du Bois Joli", description: "Légumes bio, œufs frais, miel & confitures — La Boissière-de-Montaigu (85).", descCourte: "AMAP, marché et boutique en ligne", couleurPrimaire: "#16a34a", couleurSecondaire: "#f59e0b", email: "contact@ferme-bois-joli.fr", telephone: "02 51 00 00 00", ville: "La Boissière-de-Montaigu", codePostal: "85600", modesPaiement: "Espèces, chèque, virement", modesLivraison: "Retrait à la ferme (mercredi 17h-19h), marché du samedi (Montaigu)", active: true },
  })

  const produits = [
    { nom: "Panier AMAP hebdo", prix: 18, unite: "panier", categorie: "legumes", ordre: 1 },
    { nom: "Panier découverte", prix: 25, unite: "panier", categorie: "legumes", ordre: 2 },
    { nom: "Boîte de 6 œufs", prix: 3, unite: "boîte", categorie: "oeufs", ordre: 3 },
    { nom: "Pot de miel 250 g", prix: 6, unite: "pot", categorie: "miel", ordre: 4, stockDispo: 24 },
    { nom: "Confiture mirabelle 250 g", prix: 5, unite: "pot", categorie: "transformations", ordre: 5, stockDispo: 18 },
    { nom: "Salade beurre", prix: 1.5, unite: "pièce", categorie: "legumes", ordre: 6 },
    { nom: "Botte radis", prix: 1.5, unite: "botte", categorie: "legumes", ordre: 7 },
    { nom: "Botte épinard", prix: 3, unite: "botte", categorie: "legumes", ordre: 8 },
  ]
  const produitIds: Record<string, number> = {}
  for (const p of produits) {
    const row = await prisma.produitBoutique.create({ data: { userId, boutiqueId: boutique.id, ...p } })
    produitIds[p.nom] = row.id
  }

  type Cmd = { num: string; date: string; client: string; statut: string; lignes: Array<[string, number]> }
  const commandes: Cmd[] = [
    { num: "CMD-2026-0001", date: "2026-02-08", client: "Marie Dubois", statut: "livree", lignes: [["Panier AMAP hebdo", 1], ["Boîte de 6 œufs", 2]] },
    { num: "CMD-2026-0002", date: "2026-02-22", client: "Jean Bertin", statut: "livree", lignes: [["Panier découverte", 1], ["Pot de miel 250 g", 2]] },
    { num: "CMD-2026-0003", date: "2026-03-05", client: "Sophie Renard", statut: "livree", lignes: [["Panier AMAP hebdo", 2]] },
    { num: "CMD-2026-0004", date: "2026-03-15", client: "Paul Moreau", statut: "livree", lignes: [["Panier découverte", 1], ["Confiture mirabelle 250 g", 3]] },
    { num: "CMD-2026-0005", date: "2026-03-22", client: "Anne Leroux", statut: "livree", lignes: [["Panier AMAP hebdo", 1], ["Boîte de 6 œufs", 1], ["Pot de miel 250 g", 1]] },
    { num: "CMD-2026-0006", date: "2026-04-02", client: "Marc Pichon", statut: "livree", lignes: [["Panier découverte", 2]] },
    { num: "CMD-2026-0007", date: "2026-04-10", client: "Lucie Martin", statut: "livree", lignes: [["Panier AMAP hebdo", 2], ["Boîte de 6 œufs", 3]] },
    { num: "CMD-2026-0008", date: "2026-04-18", client: "François Royer", statut: "livree", lignes: [["Panier découverte", 1], ["Pot de miel 250 g", 1], ["Confiture mirabelle 250 g", 1]] },
    { num: "CMD-2026-0009", date: "2026-04-26", client: "Élise Bonnet", statut: "livree", lignes: [["Panier AMAP hebdo", 1]] },
    { num: "CMD-2026-0010", date: "2026-05-02", client: "Thomas Carre", statut: "livree", lignes: [["Panier découverte", 1], ["Salade beurre", 6]] },
    { num: "CMD-2026-0011", date: "2026-05-08", client: "Aurélie Petit", statut: "livree", lignes: [["Panier AMAP hebdo", 2], ["Botte radis", 4]] },
    { num: "CMD-2026-0012", date: "2026-05-11", client: "Bernard Sallenave", statut: "prete", lignes: [["Panier découverte", 1], ["Boîte de 6 œufs", 2]] },
    { num: "CMD-2026-0013", date: "2026-05-12", client: "Hélène Janvier", statut: "confirmee", lignes: [["Panier AMAP hebdo", 1], ["Botte épinard", 3]] },
    { num: "CMD-2026-0014", date: "2026-05-13", client: "Pierre Vincent", statut: "nouveau", lignes: [["Panier découverte", 1], ["Pot de miel 250 g", 1]] },
  ]

  for (const c of commandes) {
    let total = 0
    const lignesData = c.lignes.map(([nom, qte]) => {
      const produit = produits.find((p) => p.nom === nom)!
      const total = produit.prix * qte
      return {
        produitId: produitIds[nom],
        nom,
        unite: produit.unite,
        quantite: qte,
        prixUnitaire: produit.prix,
        total,
      }
    })
    total = lignesData.reduce((sum, l) => sum + l.total, 0)
    // Numéro de commande unique global → suffixe si clone sur un autre compte
    const numero = process.env.DEMO_EMAIL_OVERRIDE ? `${c.num}-${userId.slice(-4)}` : c.num
    const cmd = await prisma.commandeBoutique.create({
      data: { userId, boutiqueId: boutique.id, numero, clientNom: c.client, clientEmail: `${c.client.toLowerCase().replace(/\s+/g, ".")}@example.fr`, total, statut: c.statut, createdAt: d(c.date), updatedAt: d(c.date), lignes: { create: lignesData } },
    })
    if (c.statut === "livree") {
      await prisma.venteManuelle.create({
        data: { userId, date: d(c.date), categorie: "legumes", description: `Commande boutique ${c.num} — ${c.client}`, montant: total, montantHT: total, montantTVA: 0, tauxTVA: 0, module: "general", paye: true, sourceType: "commande_boutique", sourceId: cmd.id },
      })
    }
  }
}

async function seedComptaAMAP(userId: string) {
  for (let semaine = 2; semaine <= 19; semaine++) {
    const date = new Date(2026, 0, 1)
    date.setDate(date.getDate() + (semaine - 1) * 7 + 3)
    await prisma.venteManuelle.create({
      data: { userId, date, categorie: "legumes", description: `AMAP semaine ${semaine} — 12 paniers`, quantite: 12, unite: "panier", prixUnitaire: 18, montant: 216, montantHT: 216, montantTVA: 0, tauxTVA: 0, module: "potager", paye: true },
    })
    const samedi = new Date(2026, 0, 1)
    samedi.setDate(samedi.getDate() + (semaine - 1) * 7 + 5)
    const marche = 110 + ((semaine * 13) % 50)
    await prisma.venteManuelle.create({
      data: { userId, date: samedi, categorie: "legumes", description: `Marché de Montaigu — samedi S${semaine}`, montant: marche, montantHT: marche, montantTVA: 0, tauxTVA: 0, module: "potager", paye: true },
    })
  }
}

async function seedDepenses(userId: string) {
  const depenses = [
    { date: "2026-01-15", categorie: "materiel", description: "Semences printemps", montant: 450, module: "potager" },
    { date: "2026-01-20", categorie: "abonnement", description: "MSA cotisations T1", montant: 320, module: "general" },
    { date: "2026-02-10", categorie: "materiel", description: "Achat poulettes Marans (30 × 18 €)", montant: 540, module: "elevage" },
    { date: "2026-02-15", categorie: "materiel", description: "Aliment poules — 200 kg", montant: 95, module: "elevage" },
    { date: "2026-03-05", categorie: "carburant", description: "Gasoil non routier", montant: 140, module: "general" },
    { date: "2026-03-25", categorie: "materiel", description: "Engrais et terreau", montant: 180, module: "potager" },
    { date: "2026-04-10", categorie: "abonnement", description: "MSA cotisations T2", montant: 320, module: "general" },
    { date: "2026-04-15", categorie: "carburant", description: "Gasoil tracteur", montant: 140, module: "general" },
    { date: "2026-04-20", categorie: "materiel", description: "Aliment poules — 200 kg", montant: 95, module: "elevage" },
    { date: "2026-05-02", categorie: "autre", description: "Assurance MAAF", montant: 290, module: "general" },
    { date: "2026-05-10", categorie: "materiel", description: "Bouillie bordelaise (verger)", montant: 65, module: "verger" },
    { date: "2026-05-12", categorie: "materiel", description: "Plants tomate/aubergine bio", montant: 120, module: "potager" },
  ]
  for (const dep of depenses) {
    await prisma.depenseManuelle.create({
      data: { userId, date: d(dep.date), categorie: dep.categorie, description: dep.description, montant: dep.montant, montantHT: dep.montant, montantTVA: 0, tauxTVA: 0, module: dep.module, paye: true },
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("▶ Seed du compte démo « Ferme du Bois Joli »")
  const user = await ensureUser()
  console.log(`  ✓ User: ${user.email} (id=${user.id})`)

  await ensureUserPreferences(user.id)
  await ensureEspeceAnimale()

  const hasData = await prisma.planche.count({ where: { userId: user.id } })
  if (hasData > 0) {
    console.log(`⚠ Le compte ${DEMO_EMAIL} a déjà ${hasData} planche(s). Lancez 'npx tsx prisma/reset-demo.ts' d'abord.`)
    return
  }

  const parcelles = await seedParcellesGeo(user.id)
  console.log(`  ✓ Parcelles: ${Object.keys(parcelles).length}`)
  const planches = await seedPlanches(user.id)
  console.log(`  ✓ Planches: ${Object.keys(planches).length}`)
  await seedCultures(user.id, planches)
  console.log("  ✓ Cultures (18)")
  await seedRecoltes(user.id, planches)
  console.log("  ✓ Récoltes")
  await seedArbres(user.id, parcelles)
  console.log("  ✓ Arbres (20) + observations + opérations")
  await seedElevage(user.id, parcelles)
  console.log("  ✓ Élevage")
  await seedBoutique(user.id)
  console.log("  ✓ Boutique : 8 produits + 14 commandes")
  await seedComptaAMAP(user.id)
  console.log("  ✓ AMAP & marché × 18 sem.")
  await seedDepenses(user.id)
  console.log("  ✓ Dépenses (12 lignes)")
  console.log("✅ Seed démo terminé. Vérifier sur l'UI (voir docs/demo-scenario.md).")
}

main()
  .catch((err) => { console.error("Erreur seed :", err); process.exit(1) })
  .finally(() => prisma.$disconnect())
