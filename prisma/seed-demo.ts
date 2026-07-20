/**
 * Seed du compte démo « Ferme du Bois Joli » — SCÉNARIO v2 (evergreen).
 *
 * Jeu de données COMPLET aidant la projection du prospect : polyculture-élevage
 * bio diversifiée avec caprin laitier pro (P20-P27), plan 2D vivant, et
 * comptabilité régime réel simplifié + TVA + factures + FEC.
 *
 * EVERGREEN : aucune date en dur. Tout est calculé par rapport à la date de
 * reseed (`NOW`). Année courante `Y` = activité YTD (1er janv → aujourd'hui),
 * historique `Y-1` = synthèses mensuelles pour les comparatifs N/N-1.
 * Rejouer le seed « rafraîchit » la démo — réponse durable à l'obsolescence.
 *
 * Modèle monétaire (cf. docs/demo-scenario.md + src/lib/kpi/compta.ts) :
 *   Revenus  = Σ VenteManuelle.montant + Σ Facture.totalTTC
 *   Dépenses = Σ DepenseManuelle.montant
 *   Chaque vente d'un autre module (récolte, vente produit, récolte arbre)
 *   crée une VenteManuelle « auto » miroir (mapping identique à
 *   src/lib/auto-compta.ts) — SAUF si facturée. Idem pour les coûts élevage/
 *   verger → DepenseManuelle « auto ». Ainsi SSOT ↔ ventilation modules restent
 *   cohérents (0 bandeau) et le FEC est équilibré (TTC = HT + TVA au centime).
 *
 * Pré-requis : migrations + seed référentiel appliqués (Espèces/Variétés/ITP).
 * Repartir propre : `npx tsx prisma/reset-demo.ts` AVANT.
 * Usage : `npx tsx prisma/seed-demo.ts`
 */

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"
const DEMO_PASSWORD = process.env.DEMO_PASSWORD_OVERRIDE || "demo2026"
const DEMO_NAME = process.env.DEMO_NAME_OVERRIDE || "Ferme du Bois Joli"
const IS_CLONE = Boolean(process.env.DEMO_EMAIL_OVERRIDE)

// ─── Ancre temporelle evergreen ──────────────────────────────────────────────
const NOW = new Date()
const Y = NOW.getUTCFullYear()
const Y1 = Y - 1

function today0(): Date {
  return new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()))
}
/** Date à J±offset (jours) par rapport à aujourd'hui, 08:00 UTC. */
function dAgo(days: number): Date {
  const d = today0()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(8, 0, 0, 0)
  return d
}
/** Date calendaire fixe (année/mois/jour), 08:00 UTC. */
function dYMD(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 8, 0, 0))
}
const round2 = (n: number) => Math.round(n * 100) / 100
const inRange = (d: Date) => d.getTime() <= NOW.getTime()

function geoSquare(lat: number, lng: number, side: number): string {
  const h = side / 2 / 111_000
  const hl = h / Math.cos((lat * Math.PI) / 180)
  const c = [
    [lng - hl, lat - h], [lng + hl, lat - h], [lng + hl, lat + h],
    [lng - hl, lat + h], [lng - hl, lat - h],
  ]
  return JSON.stringify({ type: "Polygon", coordinates: [c] })
}

// ─── Identité fiscale (fictive mais Luhn-valide pour le FEC) ─────────────────
const SIRET = "40483304800006"
const SIREN = "404833048"
const TVA_INTRA = "FR83404833048"

const LAT = 46.93
const LNG = -1.21

let userId = ""

// ─── Helpers comptabilité (miroir de src/lib/auto-compta.ts) ─────────────────
// calculTVA : le montant source est TTC ; HT = TTC/(1+t), TVA = TTC-HT.
// Garantit montant(TTC) = HT + TVA au centime → FEC équilibré.
function splitTTC(ttc: number, taux: number) {
  const montant = round2(ttc)
  const montantHT = round2(montant / (1 + taux / 100))
  const montantTVA = round2(montant - montantHT) // somme exacte au centime → FEC équilibré
  return { montantHT, montantTVA, montant }
}

/** VenteManuelle « auto » miroir d'une vente source (compte dans la SSOT). */
async function autoVente(
  sourceType: string, sourceId: number,
  o: { date: Date; ttc: number; taux: number; categorie: string; module: string; description: string; quantite?: number; unite?: string; prixUnitaire?: number | null }
) {
  const s = splitTTC(o.ttc, o.taux)
  await prisma.venteManuelle.create({
    data: {
      userId, date: o.date, categorie: o.categorie, description: o.description,
      quantite: o.quantite ?? null, unite: o.unite ?? null, prixUnitaire: o.prixUnitaire ?? null,
      tauxTVA: o.taux, montantHT: s.montantHT, montantTVA: s.montantTVA, montant: s.montant,
      journal: "VE", module: o.module, paye: true, sourceType, sourceId, auto: true,
    },
  })
}
/** DepenseManuelle « auto » miroir d'un coût source (compte dans la SSOT). */
async function autoDepense(
  sourceType: string, sourceId: number,
  o: { date: Date; ttc: number; taux: number; categorie: string; module: string; description: string }
) {
  const s = splitTTC(o.ttc, o.taux)
  await prisma.depenseManuelle.create({
    data: {
      userId, date: o.date, categorie: o.categorie, description: o.description,
      tauxTVA: o.taux, montantHT: s.montantHT, montantTVA: s.montantTVA, montant: s.montant,
      journal: "AC", module: o.module, paye: true, sourceType, sourceId, auto: true,
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
//  UTILISATEUR / EXPLOITATION / RÉFÉRENTIELS
// ═════════════════════════════════════════════════════════════════════════════

async function ensureUser() {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12)
  const u = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: IS_CLONE ? { active: true } : { name: DEMO_NAME, password: hashed, active: true, emailVerified: true },
    create: { email: DEMO_EMAIL, password: hashed, name: DEMO_NAME, role: "USER", active: true, emailVerified: true },
  })
  userId = u.id
  return u
}

async function ensureExploitation() {
  const data = {
    raisonSociale: "EARL Ferme du Bois Joli",
    formeJuridique: "EARL",
    territoire: "METROPOLE",
    siret: SIRET, siren: SIREN, numeroTvaIntracom: TVA_INTRA, devise: "EUR",
    regimeFiscal: "reel-simplifie", regimeTva: "reel-simplifie",
    adresseSiege: "Le Bois Joli", codePostal: "85600", ville: "La Boissière-de-Montaigu", pays: "France",
    emailContact: "contact@ferme-bois-joli.fr", telContact: "02 51 42 00 00",
    banqueNom: "Crédit Agricole Atlantique Vendée", rib: "FR76 1470 6000 3212 3456 7890 143", bic: "AGRIFRPP847",
    certifBioOrganisme: "Ecocert FR-BIO-01",
    tauxPenalitesRetard: "3 × taux légal", tauxEscompte: "néant",
  }
  await prisma.exploitation.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })
}

async function ensurePrefs() {
  const prefs: Array<[string, string]> = [
    ["modulesActifs", JSON.stringify(["maraichage", "verger", "elevage", "comptabilite"])],
    ["onboarding_completed", "true"],
  ]
  for (const [key, value] of prefs) {
    await prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value },
    })
  }
}

async function ensureEspecesAnimales() {
  const data = [
    { id: "poule_marans", nom: "Poule Marans", type: "volaille", production: "oeufs", categorieReglementaire: "Volaille de ponte", productions: ["Œufs"], dureeCouvaison: 21, poidsAdulte: 3.0, ponteAnnuelle: 180, consommationJour: 0.13, prixAchat: 18, couleur: "#3f3a1f", description: "Pondeuse rustique noire cuivrée" },
    { id: "brebis_solognote", nom: "Brebis Solognote", type: "mammifere_grand", production: "viande", categorieReglementaire: "Ovin", productions: ["Viande", "Laine"], dureeGestation: 150, poidsAdulte: 55, rendementCarcasse: 45, prixAchat: 220, couleur: "#8b6f3e", description: "Race rustique solognote" },
    { id: "chevre_alpine", nom: "Chèvre Alpine chamoisée", type: "mammifere_grand", production: "lait", categorieReglementaire: "Caprin", productions: ["Lait", "Saillie"], dureeGestation: 150, poidsAdulte: 65, prixAchat: 350, couleur: "#a07050", description: "Chèvre laitière (~ 700 L/lactation)" },
    { id: "cochon_gascon", nom: "Cochon Gascon", type: "mammifere_grand", production: "viande", categorieReglementaire: "Porcin", productions: ["Viande"], dureeGestation: 114, poidsAdulte: 250, rendementCarcasse: 75, prixAchat: 200, couleur: "#1a1a1a", description: "Race rustique noire" },
    { id: "lapin_geant", nom: "Lapin Géant des Flandres", type: "mammifere_petit", production: "viande", categorieReglementaire: "Cuniculture", productions: ["Viande"], dureeGestation: 31, poidsAdulte: 7, rendementCarcasse: 60, prixAchat: 35, couleur: "#a89070", description: "Grande race, élevage familial" },
  ]
  for (const e of data) {
    // upsert sans écraser une éventuelle version communautaire officielle
    await prisma.especeAnimale.upsert({ where: { id: e.id }, update: e, create: e })
  }
}

async function ensureAliments() {
  // Valeurs INRA (par kg brut) — calculateur de ration P25.
  const aliments = [
    { id: "foin_prairie_demo", nom: "Foin de prairie (autoproduit)", type: "foin", especesCibles: "caprin,ovin", proteines: 9, ufl: 0.55, pdin: 50, pdie: 70, uel: 1.05, prix: 0.15 },
    { id: "granules_chevre_demo", nom: "Granulés chèvre laitière bio", type: "granules", especesCibles: "caprin", proteines: 17, ufl: 1.0, pdin: 115, pdie: 108, uel: 0.45, prix: 0.46 },
    { id: "cereales_volaille_demo", nom: "Mélange céréales fermier", type: "cereales", especesCibles: "volaille", proteines: 14, energie: 3100, prix: 0.42 },
  ]
  for (const a of aliments) {
    const { id, ...rest } = a
    await prisma.aliment.upsert({ where: { id }, update: rest, create: a })
  }
}

async function seedStationMeteo() {
  const id = `demo-station-${userId}`
  const data = { nom: "La Roche-sur-Yon · Les Ajoncs", provider: "open-meteo-reference", stationId: "WMO 07306 · MF 85191003", lat: 46.705, lng: -1.3819, active: true }
  await prisma.stationMeteo.upsert({ where: { id }, update: data, create: { id, userId, ...data } })
}

// ═════════════════════════════════════════════════════════════════════════════
//  MARAÎCHAGE : parcelles, planches, cultures, récoltes
// ═════════════════════════════════════════════════════════════════════════════

async function seedParcelles() {
  const P = [
    { nom: "Demo-A · Serre", surface: 0.02, side: 14, dLat: 0.0002, dLng: 0, couches: ["MARAICHAGE" as const], usage: "culture", typeSol: "limono-sableux", couleur: "#10b981" },
    { nom: "Demo-B · Plein champ", surface: 0.08, side: 28, dLat: 0.0005, dLng: 0.0003, couches: ["MARAICHAGE" as const], usage: "culture", typeSol: "limono-argileux", couleur: "#16a34a" },
    { nom: "Demo-C · Tunnel maraîcher", surface: 0.02, side: 14, dLat: -0.0002, dLng: -0.0003, couches: ["MARAICHAGE" as const], usage: "culture", typeSol: "limono-sableux", couleur: "#22c55e" },
    { nom: "Demo-V · Verger", surface: 0.08, side: 28, dLat: 0.0008, dLng: -0.0005, couches: ["VERGER" as const], usage: "verger", typeSol: "limono-argileux", couleur: "#65a30d" },
    { nom: "Demo-P · Pâture", surface: 0.4, side: 63, dLat: -0.0008, dLng: 0.0008, couches: ["PATURAGE" as const, "ELEVAGE" as const], usage: "prairie", typeSol: "limono-argileux", couleur: "#a3a300" },
  ]
  const ids: Record<string, string> = {}
  for (const p of P) {
    const row = await prisma.parcelleGeo.create({
      data: {
        userId, nom: p.nom, surface: p.surface, geometry: geoSquare(LAT + p.dLat, LNG + p.dLng, p.side),
        centroidLat: LAT + p.dLat, centroidLng: LNG + p.dLng, couches: p.couches, usage: p.usage,
        typeSol: p.typeSol, couleur: p.couleur, commune: "La Boissière-de-Montaigu",
        statutBio: "AB", certificateur: "Ecocert FR-BIO-01",
      },
    })
    ids[p.nom] = row.id
  }
  return ids
}

async function seedPlanches(parcelles: Record<string, string>) {
  const P = [
    ["A1", 8, 1.2, "Rotation-4ans-A", "Serre", "Goutte-à-goutte", "Demo-A · Serre"],
    ["A2", 8, 1.2, "Rotation-4ans-A", "Serre", "Goutte-à-goutte", "Demo-A · Serre"],
    ["A3", 8, 1.2, "Rotation-4ans-A", "Serre", "Goutte-à-goutte", "Demo-A · Serre"],
    ["B1", 25, 1.2, "Rotation-4ans-B", "Plein champ", "Aspersion", "Demo-B · Plein champ"],
    ["B2", 25, 1.2, "Rotation-4ans-B", "Plein champ", "Aspersion", "Demo-B · Plein champ"],
    ["B3", 25, 1.2, "Rotation-4ans-B", "Plein champ", "Aspersion", "Demo-B · Plein champ"],
    ["B4", 25, 1.2, "Rotation-4ans-B", "Plein champ", "Aspersion", "Demo-B · Plein champ"],
    ["B5", 25, 1.2, "Rotation-4ans-B", "Plein champ", "Aucun", "Demo-B · Plein champ"],
    ["B6", 25, 1.2, "Rotation-4ans-B", "Plein champ", "Aucun", "Demo-B · Plein champ"],
    ["C1", 10, 1.2, "Rotation-3ans-Courges", "Tunnel", "Goutte-à-goutte", "Demo-C · Tunnel maraîcher"],
    ["C2", 10, 1.2, "Rotation-3ans-Courges", "Tunnel", "Goutte-à-goutte", "Demo-C · Tunnel maraîcher"],
    ["C3", 10, 1.2, "Rotation-3ans-Courges", "Tunnel", "Goutte-à-goutte", "Demo-C · Tunnel maraîcher"],
    ["C4", 10, 1.2, "Rotation-3ans-Courges", "Tunnel", "Manuel", "Demo-C · Tunnel maraîcher"],
  ] as const
  // Ne référence une rotation que si elle existe (rotations globales).
  const rots = new Set((await prisma.rotation.findMany({ select: { id: true } })).map((r) => r.id))
  const ids: Record<string, string> = {}
  let x = 0
  for (const [nom, lon, lar, rot, type, irr, parc] of P) {
    const row = await prisma.planche.create({
      data: {
        userId, nom, longueur: lon, largeur: lar, surface: lon * lar,
        rotationId: rots.has(rot) ? rot : null, ilot: (nom as string).charAt(0),
        type, irrigation: irr, annee: Y, parcelleGeoId: parcelles[parc],
        posX: (x % 4) * 3, posY: Math.floor(x / 4) * 3,
        statutBio: "AB", certificateur: "Ecocert FR-BIO-01",
      },
    })
    ids[nom as string] = row.id
    x++
  }
  return ids
}

const IRRIGUEES = new Set(["Tomate", "Aubergine", "Concombre", "Courgette", "Poivron", "Laitue", "Basilic", "Épinard", "Courge butternut", "Potimarron"])

type CSpec = {
  planche: string; espece: string; variete?: string; itp?: string
  semisAgo?: number; plantAgo?: number; recolteAgo: number // jours (négatif = futur)
  surface: number; nbPlants?: number
}

async function seedCultures(planches: Record<string, string>) {
  // recolteAgo : nb de jours entre aujourd'hui et la récolte (>0 = passé, <0 = futur).
  const specs: CSpec[] = [
    // ── RÉCOLTÉES (terminées) ──
    { planche: "C1", espece: "Radis", variete: "Radis de 18 jours", itp: "Radis-printemps", semisAgo: 78, recolteAgo: 55, surface: 12 },
    { planche: "C2", espece: "Épinard", variete: "Épinard Géant d'Hiver", itp: "Épinard-printemps", semisAgo: 96, recolteAgo: 60, surface: 12 },
    { planche: "C3", espece: "Laitue", variete: "Laitue Batavia", itp: "Laitue-printemps-serre", semisAgo: 100, plantAgo: 75, recolteAgo: 52, surface: 12 },
    { planche: "B6", espece: "Fève", variete: "Fève Aguadulce", itp: "Fève-printemps", semisAgo: 150, recolteAgo: 40, surface: 30 },
    { planche: "B4", espece: "Petit pois", variete: "Petit pois-Merveille de Kelvedon", itp: "Petit-pois-printemps", semisAgo: 120, recolteAgo: 30, surface: 30 },
    // ── EN COURS DE RÉCOLTE (centrées sur aujourd'hui) ──
    { planche: "A1", espece: "Tomate", variete: "Tomate Coeur de Boeuf", itp: "Tomate-printemps", semisAgo: 130, plantAgo: 85, recolteAgo: 5, surface: 9.6, nbPlants: 16 },
    { planche: "A2", espece: "Tomate", variete: "Tomate Ananas", itp: "Tomate-printemps", semisAgo: 130, plantAgo: 85, recolteAgo: -3, surface: 9.6, nbPlants: 16 },
    { planche: "A3", espece: "Aubergine", variete: "Aubergine Barbentane", itp: "Aubergine-serre", semisAgo: 140, plantAgo: 80, recolteAgo: 2, surface: 9.6, nbPlants: 14 },
    { planche: "A1", espece: "Basilic", variete: "Basilic Grand Vert", itp: "Basilic-serre", semisAgo: 80, plantAgo: 55, recolteAgo: 0, surface: 4.8 },
    { planche: "C4", espece: "Concombre", variete: "Concombre Marketmore", itp: "Concombre-ete-serre", semisAgo: 70, plantAgo: 50, recolteAgo: -2, surface: 12, nbPlants: 10 },
    { planche: "B1", espece: "Carotte", variete: "Carotte Nantaise", itp: "Carotte-printemps-plein-champ", semisAgo: 95, recolteAgo: 3, surface: 30 },
    { planche: "B2", espece: "Oignon", variete: "Oignon Jaune de Stuttgart", itp: "Oignon-printemps", semisAgo: 120, plantAgo: 90, recolteAgo: 8, surface: 30, nbPlants: 300 },
    { planche: "B3", espece: "Pomme de terre", variete: "Pomme de terre Bintje", itp: "Pomme-de-terre-printemps-hative", plantAgo: 95, recolteAgo: 6, surface: 30 },
    { planche: "B4", espece: "Haricot vert", variete: "Haricot Contender", itp: "Haricot-vert-ete", semisAgo: 55, recolteAgo: -4, surface: 30 },
    { planche: "A2", espece: "Poivron", variete: "Poivron California Wonder", itp: "Poivron-printemps-serre", semisAgo: 140, plantAgo: 80, recolteAgo: 4, surface: 4.8, nbPlants: 10 },
    // ── À VENIR (planifiées / en croissance) ──
    { planche: "B5", espece: "Courge butternut", variete: "Courge butternut-Waltham", itp: "Courge-butternut", semisAgo: 45, plantAgo: 20, recolteAgo: -70, surface: 30 },
    { planche: "C1", espece: "Potimarron", variete: "Potimarron-Red Kuri", itp: "Potimarron", semisAgo: 40, plantAgo: 18, recolteAgo: -72, surface: 10 },
    { planche: "B6", espece: "Haricot sec", variete: "Haricot-Coco de Prague", itp: "Haricot-ete-sec", semisAgo: 25, recolteAgo: -55, surface: 30 },
    { planche: "C2", espece: "Poireau", variete: "Poireau Bleu de Solaise", itp: "Poireau-automne", semisAgo: 30, plantAgo: -10, recolteAgo: -110, surface: 12 },
    { planche: "C3", espece: "Chou kale", variete: "Chou kale-Nero di Toscana", itp: "Chou-kale-ete", semisAgo: 20, plantAgo: -5, recolteAgo: -90, surface: 12 },
    { planche: "B1", espece: "Mâche", variete: "Mâche verte", itp: "Mache-automne", semisAgo: -20, recolteAgo: -120, surface: 15 },
  ]

  const especeIds = [...new Set(specs.map((s) => s.espece))]
  const especes = new Set((await prisma.espece.findMany({ where: { id: { in: especeIds } }, select: { id: true } })).map((e) => e.id))

  const created: Array<{ id: number; espece: string; plancheId: string; surface: number; recolteAgo: number }> = []
  for (const s of specs) {
    if (!especes.has(s.espece)) { console.warn(`⚠ Espèce absente du référentiel : ${s.espece}`); continue }
    // variété : ne poser que si elle existe
    let varieteId: string | null = null
    if (s.variete) {
      const v = await prisma.variete.findUnique({ where: { id: s.variete }, select: { id: true } })
      varieteId = v?.id ?? null
    }
    let itpId: string | null = null
    if (s.itp) {
      const it = await prisma.iTP.findUnique({ where: { id: s.itp }, select: { id: true } })
      itpId = it?.id ?? null
    }
    const dSemis = s.semisAgo != null ? dAgo(s.semisAgo) : null
    const dPlant = s.plantAgo != null ? dAgo(s.plantAgo) : null
    const dRec = dAgo(s.recolteAgo)
    const c = await prisma.culture.create({
      data: {
        userId, especeId: s.espece, varieteId, itpId, plancheId: planches[s.planche], annee: Y,
        dateSemis: dSemis, datePlantation: dPlant, dateRecolte: dRec,
        semisFait: dSemis ? inRange(dSemis) : false,
        plantationFaite: dPlant ? inRange(dPlant) : false,
        recolteFaite: inRange(dRec),
        aIrriguer: IRRIGUEES.has(s.espece) ? true : null,
        quantite: s.surface, nbRangs: s.nbPlants ? Math.max(1, Math.round(s.surface / 3)) : null,
      },
    })
    created.push({ id: c.id, espece: s.espece, plancheId: planches[s.planche], surface: s.surface, recolteAgo: s.recolteAgo })
  }
  return created
}

async function seedRecoltes(cultures: Awaited<ReturnType<typeof seedCultures>>) {
  // Prix de vente moyens bio (€/kg TTC) par espèce.
  const PRIX: Record<string, number> = {
    Radis: 2.5, Épinard: 4.5, Laitue: 2.0, Fève: 3.5, "Petit pois": 5.0,
    Tomate: 3.8, Aubergine: 3.5, Poivron: 4.5, Concombre: 2.5, Carotte: 2.2,
    Oignon: 2.5, "Pomme de terre": 1.8, "Haricot vert": 5.5, Basilic: 20,
  }
  // Rendement approximatif kg par récolte (partiel pour cultures en cours).
  for (const c of cultures) {
    const prix = PRIX[c.espece]
    if (!prix) continue
    // Cultures récoltées → 2 passages vendus ; en cours → 1 passage vendu partiel.
    const passages: Array<{ ago: number; kg: number; vendu: boolean }> = []
    if (c.recolteAgo > 20) {
      passages.push({ ago: c.recolteAgo + 6, kg: c.surface * 0.9, vendu: true })
      passages.push({ ago: c.recolteAgo, kg: c.surface * 1.1, vendu: true })
    } else if (c.recolteAgo >= -10) {
      // récolte en cours : quelques passages récents, une partie vendue une partie en stock
      passages.push({ ago: 12, kg: c.surface * 0.6, vendu: true })
      passages.push({ ago: 5, kg: c.surface * 0.7, vendu: true })
      passages.push({ ago: 1, kg: c.surface * 0.5, vendu: false })
    }
    for (const p of passages) {
      if (p.ago < 0) continue
      const date = dAgo(p.ago)
      if (!inRange(date)) continue
      const kg = round2(p.kg)
      const prixTotal = p.vendu ? round2(kg * prix) : null
      const r = await prisma.recolte.create({
        data: {
          userId, especeId: c.espece, cultureId: c.id, date, quantite: kg,
          statut: p.vendu ? "vendu" : "en_stock",
          dateVente: p.vendu ? date : null, prixKg: p.vendu ? prix : null, prixTotal,
          statutBioSnapshot: "AB",
        },
      })
      if (p.vendu && prixTotal) {
        await autoVente("recolte", r.id, { date, ttc: prixTotal, taux: 5.5, categorie: "legumes", module: "potager", description: `Vente ${c.espece} — ${kg} kg`, quantite: kg, unite: "kg", prixUnitaire: prix })
      }
    }
  }
}

async function seedStocks() {
  // inventaire = kg de légumes en stock (uniteStock réservé aux propagules).
  const stocks = [
    { espece: "Ail", inventaire: 12, prixKg: 12 },
    { espece: "Oignon", inventaire: 45, prixKg: 2.5 },
    { espece: "Pomme de terre", inventaire: 80, prixKg: 1.8 },
    { espece: "Courge butternut", inventaire: 0, prixKg: 2.5 },
    { espece: "Carotte", inventaire: 30, prixKg: 2.2 },
  ]
  for (const s of stocks) {
    const e = await prisma.espece.findUnique({ where: { id: s.espece }, select: { id: true } })
    if (!e) continue
    await prisma.userStockEspece.upsert({
      where: { userId_especeId: { userId, especeId: s.espece } },
      update: { inventaire: s.inventaire, dateInventaire: dAgo(3), prixKg: s.prixKg },
      create: { userId, especeId: s.espece, inventaire: s.inventaire, dateInventaire: dAgo(3), prixKg: s.prixKg },
    })
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  VERGER
// ═════════════════════════════════════════════════════════════════════════════

async function seedArbres(parcelles: Record<string, string>) {
  const parcelleId = parcelles["Demo-V · Verger"]
  type A = { nom: string; espece: string; variete: string; pg?: string; anneePlant: number; x: number; y: number; env: number; envA: number; forme?: string }
  const arbres: A[] = [
    { nom: "Pommier Reine 1", espece: "Pommier", variete: "Reine des Reinettes", pg: "MM106", anneePlant: Y - 6, x: 4, y: 4, env: 3.2, envA: 4, forme: "gobelet" },
    { nom: "Pommier Reine 2", espece: "Pommier", variete: "Reine des Reinettes", pg: "MM106", anneePlant: Y - 6, x: 8, y: 4, env: 3.2, envA: 4, forme: "gobelet" },
    { nom: "Pommier Reine 3", espece: "Pommier", variete: "Reine des Reinettes", pg: "MM106", anneePlant: Y - 6, x: 12, y: 4, env: 3.0, envA: 4, forme: "gobelet" },
    { nom: "Pommier Golden 1", espece: "Pommier", variete: "Golden Delicious", pg: "MM106", anneePlant: Y - 6, x: 16, y: 4, env: 3.1, envA: 4, forme: "gobelet" },
    { nom: "Pommier Golden 2", espece: "Pommier", variete: "Golden Delicious", pg: "MM106", anneePlant: Y - 6, x: 20, y: 4, env: 3.0, envA: 4, forme: "gobelet" },
    { nom: "Poirier Williams 1", espece: "Poirier", variete: "Williams", pg: "Cognassier BA29", anneePlant: Y - 5, x: 4, y: 9, env: 2.8, envA: 4.5, forme: "fuseau" },
    { nom: "Poirier Williams 2", espece: "Poirier", variete: "Williams", pg: "Cognassier BA29", anneePlant: Y - 5, x: 8, y: 9, env: 2.7, envA: 4.5, forme: "fuseau" },
    { nom: "Poirier Conférence 1", espece: "Poirier", variete: "Conférence", pg: "Cognassier BA29", anneePlant: Y - 5, x: 12, y: 9, env: 2.6, envA: 4.5, forme: "fuseau" },
    { nom: "Prunier Mirabelle 1", espece: "Prunier", variete: "Mirabelle de Nancy", pg: "Saint-Julien A", anneePlant: Y - 5, x: 16, y: 9, env: 3.0, envA: 4.5, forme: "gobelet" },
    { nom: "Prunier Mirabelle 2", espece: "Prunier", variete: "Mirabelle de Nancy", pg: "Saint-Julien A", anneePlant: Y - 5, x: 20, y: 9, env: 3.1, envA: 4.5, forme: "gobelet" },
    { nom: "Prunier Reine-Claude", espece: "Prunier", variete: "Reine-Claude dorée", pg: "Saint-Julien A", anneePlant: Y - 4, x: 4, y: 14, env: 2.6, envA: 4.5, forme: "gobelet" },
    { nom: "Cerisier Burlat 1", espece: "Cerisier", variete: "Burlat", pg: "Sainte-Lucie", anneePlant: Y - 4, x: 8, y: 14, env: 3.4, envA: 6, forme: "gobelet" },
    { nom: "Cerisier Napoléon", espece: "Cerisier", variete: "Napoléon (Royal Ann)", pg: "Sainte-Lucie", anneePlant: Y - 4, x: 12, y: 14, env: 3.2, envA: 6, forme: "gobelet" },
    { nom: "Figuier Brown Turkey", espece: "Figuier", variete: "Brown Turkey", anneePlant: Y - 6, x: 16, y: 14, env: 3.5, envA: 5, forme: "plein_vent" },
    { nom: "Noyer Franquette 1", espece: "Noyer", variete: "Franquette", anneePlant: Y - 8, x: 20, y: 16, env: 6, envA: 12, forme: "plein_vent" },
    { nom: "Noyer Franquette 2", espece: "Noyer", variete: "Franquette", anneePlant: Y - 8, x: 24, y: 16, env: 5.6, envA: 12, forme: "plein_vent" },
  ]
  const ids: number[] = []
  for (const a of arbres) {
    const esp = await prisma.espece.findUnique({ where: { id: a.espece }, select: { id: true } })
    const row = await prisma.arbre.create({
      data: {
        userId, nom: a.nom, type: "fruitier", especeId: esp?.id ?? null, espece: a.espece, variete: a.variete,
        portGreffe: a.pg ?? null, datePlantation: dYMD(a.anneePlant, 3, 15),
        posX: a.x, posY: a.y, envergure: a.env, envergureAdulte: a.envA, etat: "bon",
        formeTaille: a.forme ?? null, productif: true, parcelleGeoId: parcelleId,
      },
    })
    ids.push(row.id)
  }

  // Observation sanitaire : tavelure Pommier Golden 1 (index 3), saisie canonique.
  await prisma.observationSante.create({
    data: {
      userId, arbreId: ids[3], date: dYMD(Y, 4, 8), type: "maladie", diagnostic: "Tavelure",
      gravite: "moyenne", organe: "feuilles", traitement: "Bouillie bordelaise (préventif)",
      produit: "Bouillie bordelaise RSR", methodeTraitement: "chimique", numAMM: "2000232", dar: 21,
    },
  })

  // Opérations : tailles d'hiver + traitement bio (avec coûts → dépenses auto).
  for (let i = 0; i < 4; i++) {
    const op = await prisma.operationArbre.create({
      data: { userId, arbreId: ids[i], date: dYMD(Y, 2, 5 + i), type: "taille", description: "Taille d'hiver / formation", cout: null, fait: true },
    })
    void op
  }
  const traitement = await prisma.operationArbre.create({
    data: { userId, arbreId: ids[3], date: dYMD(Y, 4, 9), type: "traitement", description: "Bouillie bordelaise préventive (verger)", produit: "Bouillie bordelaise", quantite: 3, unite: "kg", cout: 42, fait: true },
  })
  await autoDepense("operation_arbre", traitement.id, { date: dYMD(Y, 4, 9), ttc: 42, taux: 20, categorie: "intrants", module: "verger", description: "Traitement verger — bouillie bordelaise" })

  // Récoltes fruits (été) : cerises (juin) et prunes (juillet). Certaines vendues.
  const cerisier = ids[11] // Cerisier Burlat 1
  const prunier = ids[8] // Prunier Mirabelle 1
  const fruits: Array<{ arbre: number; espece: string; mois: number; jour: number; kg: number; prixKg: number; facture: boolean }> = [
    { arbre: cerisier, espece: "Cerisier", mois: 6, jour: 12, kg: 18, prixKg: 6.5, facture: false },
    { arbre: cerisier, espece: "Cerisier", mois: 6, jour: 20, kg: 22, prixKg: 6.5, facture: true }, // → facture épicerie
    { arbre: prunier, espece: "Prunier", mois: 7, jour: 15, kg: 25, prixKg: 4.0, facture: false },
  ]
  const factureFruits: Array<{ recolteArbreId: number; ttc: number; date: Date; kg: number; prixKg: number }> = []
  for (const f of fruits) {
    const date = dYMD(Y, f.mois, f.jour)
    if (!inRange(date)) continue
    const prixTotal = round2(f.kg * f.prixKg)
    const ra = await prisma.recolteArbre.create({
      data: {
        userId, arbreId: f.arbre, date, quantite: f.kg, qualite: "bon", prixKg: f.prixKg,
        statut: "vendu", dateVente: date, prixTotal, statutBioSnapshot: "AB",
        destinationCommerce: "Frais marché", conditionnement: "Cagette 5kg",
      },
    })
    if (f.facture) {
      factureFruits.push({ recolteArbreId: ra.id, ttc: prixTotal, date, kg: f.kg, prixKg: f.prixKg })
    } else {
      await autoVente("recolte_arbre", ra.id, { date, ttc: prixTotal, taux: 5.5, categorie: "fruits", module: "verger", description: `Vente ${f.espece} — ${f.kg} kg`, quantite: f.kg, unite: "kg", prixUnitaire: f.prixKg })
    }
  }
  return { factureFruits }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ÉLEVAGE
// ═════════════════════════════════════════════════════════════════════════════

/** Courbe de lactation caprine (L/jour) : montée ~45 j puis déclin. */
function litresJour(dim: number, peak: number): number {
  if (dim <= 3) return round2(peak * 0.5)
  const rise = Math.min(1, 0.5 + (dim / 45) * 0.5)
  const decline = dim <= 45 ? 1 : Math.exp(-(dim - 45) * 0.0045)
  const wobble = 1 + ((dim % 7) - 3) * 0.015
  return Math.max(0.3, round2(peak * rise * decline * wobble))
}

async function seedElevage(parcelles: Record<string, string>) {
  const pature = parcelles["Demo-P · Pâture"]

  // ── Lots ──
  const lotPondeuses = await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "poule_marans", nom: `Pondeuses ${Y}`, dateArrivee: dYMD(Y, 1, 15), quantiteInitiale: 30, quantiteActuelle: 29, provenance: "Couvoir de Cholet", prixAchatTotal: 540, statut: "actif", parcelleGeoId: pature, notes: "30 poulettes Marans 18 sem." },
  })
  // achat pondeuses = seul achat animal de l'année → dépense auto élevage
  await autoDepense("achat_animal", lotPondeuses.id, { date: dYMD(Y, 1, 15), ttc: 540, taux: 5.5, categorie: "achats", module: "elevage", description: `Achat lot Pondeuses ${Y}` })

  const lotSolognote = await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "brebis_solognote", nom: `Solognote ${Y - 2}`, dateArrivee: dYMD(Y - 2, 4, 10), quantiteInitiale: 15, quantiteActuelle: 15, provenance: "Élevage Pluchard (45)", prixAchatTotal: 3300, statut: "actif", parcelleGeoId: pature, notes: "Troupeau de reproduction." },
  })
  await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "brebis_solognote", nom: `Agnelles ${Y}`, dateArrivee: dYMD(Y, 3, 20), quantiteInitiale: 10, quantiteActuelle: 10, provenance: "Naissances internes", statut: "actif", parcelleGeoId: pature, notes: "Renouvellement issu des naissances." },
  })
  const lotLapins = await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "lapin_geant", nom: `Lapins ${Y}`, dateArrivee: dYMD(Y, 3, 1), quantiteInitiale: 7, quantiteActuelle: 19, provenance: "Élevage local", prixAchatTotal: 245, statut: "actif", notes: "6 femelles + 1 mâle." },
  })
  await autoDepense("achat_animal", lotLapins.id, { date: dYMD(Y, 3, 1), ttc: 245, taux: 5.5, categorie: "achats", module: "elevage", description: `Achat lot Lapins ${Y}` })

  const lotChevres = await prisma.lotAnimaux.create({
    data: { userId, especeAnimaleId: "chevre_alpine", nom: `Chèvres laitières ${Y}`, dateArrivee: dYMD(Y - 2, 6, 20), quantiteInitiale: 4, quantiteActuelle: 4, provenance: "GAEC du Bocage (troupeau)", statut: "actif", parcelleGeoId: pature, notes: "Lot de conduite laitière (traite, alimentation)." },
  })

  // ── Chèvres individuelles ──
  // `prior` = nombre de lactations antérieures (mises-bas ~annuelles, sans
  // collectes) → rang de lactation réaliste + âge au 1er part + IVV.
  const profils = [
    { nom: "Bergère", naissance: Y - 4, miseBasAgo: 158, peak: 4.5, cellBase: 480, cellPente: 3, lactationLongue: false, prior: 3 },
    { nom: "Clochette", naissance: Y - 4, miseBasAgo: 150, peak: 3.6, cellBase: 950, cellPente: 22, lactationLongue: false, prior: 3 },
    { nom: "Vanille", naissance: Y - 3, miseBasAgo: 138, peak: 4.1, cellBase: 640, cellPente: 9, lactationLongue: true, prior: 2 },
    { nom: "Praline", naissance: Y - 1, miseBasAgo: 120, peak: 3.3, cellBase: 520, cellPente: 4, lactationLongue: false, prior: 0 },
  ]
  const chevres: Array<{ id: number; nom: string; p: (typeof profils)[number] }> = []
  let ipg = 85001
  for (const p of profils) {
    const a = await prisma.animal.create({
      data: {
        userId, especeAnimaleId: "chevre_alpine", lotId: lotChevres.id, nom: p.nom, race: "Alpine chamoisée",
        identifiant: `FR${ipg++}`, typeIdentifiant: "IPG caprin", sexe: "femelle",
        dateNaissance: dYMD(p.naissance, 3, 10), dateArrivee: dYMD(Y - 2, 6, 20), provenance: "GAEC du Bocage",
        prixAchat: 350, statut: "actif", lactationLongue: p.lactationLongue,
      },
    })
    chevres.push({ id: a.id, nom: p.nom, p })
  }
  // Cochons (arrivés année passée → pas d'achat compté cette année)
  for (const c of [{ nom: "Grognon", sexe: "male" }, { nom: "Rosette", sexe: "femelle" }]) {
    await prisma.animal.create({
      data: { userId, especeAnimaleId: "cochon_gascon", nom: c.nom, race: "Gascon", identifiant: `FR85${c.nom === "Grognon" ? "9001" : "9002"}`, typeIdentifiant: "IPG porcin", sexe: c.sexe, dateNaissance: dYMD(Y - 1, 9, 15), dateArrivee: dYMD(Y - 1, 11, 5), provenance: "Ferme du Coteau (32)", prixAchat: 200, statut: "actif" },
    })
  }

  // ── Œufs : production hebdo sur ~18 mois + ventes mensuelles ──
  for (let wAgo = 78; wAgo >= 0; wAgo--) {
    const date = dAgo(wAgo * 7)
    if (!inRange(date)) continue
    // taux de ponte saisonnier (plus haut au printemps/été)
    const mois = date.getUTCMonth()
    const saison = mois >= 3 && mois <= 8 ? 1 : 0.65
    const q = Math.round(29 * 7 * 0.62 * saison)
    await prisma.productionOeuf.create({ data: { userId, lotId: lotPondeuses.id, date, quantite: q, casses: Math.round(q * 0.02) } })
  }
  // Ventes œufs mensuelles de l'année (VenteProduit type oeufs) + miroir auto
  for (let m = 1; m <= 12; m++) {
    const date = dYMD(Y, m, 20)
    if (!inRange(date)) continue
    const nbBoites = 60 // ~60 boîtes de 6 / mois
    const prixBoite = 3.2
    const ttc = round2(nbBoites * prixBoite)
    const vp = await prisma.venteProduit.create({
      data: { userId, date, type: "oeufs", description: "Œufs frais (boîtes de 6)", quantite: nbBoites, unite: "boîte", prixUnitaire: prixBoite, prixTotal: ttc, client: "AMAP & marché", paye: true, tauxTVA: 5.5 },
    })
    await autoVente("vente_produit", vp.id, { date, ttc, taux: 5.5, categorie: "oeufs", module: "elevage", description: "Vente œufs" })
  }

  // ── Soins (avec coûts → dépenses auto) ──
  const soins: Array<{ mois: number; jour: number; lotId?: number; type: string; produit: string; cout: number }> = [
    { mois: 3, jour: 20, lotId: lotSolognote.id, type: "Vermifuge", produit: "Doramectine", cout: 48 },
    { mois: 4, jour: 15, lotId: lotChevres.id, type: "Parage", produit: "Parage onglons", cout: 35 },
    { mois: 5, jour: 10, lotId: lotChevres.id, type: "Prophylaxie", produit: "Vaccin entérotoxémie", cout: 62 },
    { mois: 6, jour: 5, lotId: lotSolognote.id, type: "Coproscopie", produit: "Analyse parasitaire", cout: 40 },
  ]
  for (const s of soins) {
    const date = dYMD(Y, s.mois, s.jour)
    if (!inRange(date)) continue
    const so = await prisma.soinAnimal.create({ data: { userId, lotId: s.lotId ?? null, date, type: s.type, produit: s.produit, cout: s.cout, fait: true } })
    await autoDepense("soin_animal", so.id, { date, ttc: s.cout, taux: 20, categorie: "veterinaire", module: "elevage", description: `${s.type} — ${s.produit}` })
  }

  // ── Consommation aliments mensuelle sur le lot caprin → dépenses auto ──
  for (let m = 1; m <= 12; m++) {
    const date = dYMD(Y, m, 5)
    if (!inRange(date)) continue
    const foin = 2.5 * 30 * 4 // kg
    const gran = 1.0 * 30 * 4
    const cFoin = await prisma.consommationAliment.create({ data: { userId, alimentId: "foin_prairie_demo", lotId: lotChevres.id, date, quantite: foin } })
    await autoDepense("consommation_aliment", cFoin.id, { date, ttc: round2(foin * 0.15), taux: 10, categorie: "alimentation", module: "elevage", description: "Foin de prairie — lot caprin" })
    const cGran = await prisma.consommationAliment.create({ data: { userId, alimentId: "granules_chevre_demo", lotId: lotChevres.id, date, quantite: gran } })
    await autoDepense("consommation_aliment", cGran.id, { date, ttc: round2(gran * 0.46), taux: 10, categorie: "alimentation", module: "elevage", description: "Granulés chèvre — lot caprin" })
  }

  // ── Lapins : naissances ──
  const lapNaiss = [
    { moisAgo: 120, nes: 8, m: 4, f: 4 }, { moisAgo: 95, nes: 7, m: 3, f: 4 },
    { moisAgo: 60, nes: 9, m: 5, f: 4 }, { moisAgo: 30, nes: 8, m: 4, f: 4 },
  ]
  for (const n of lapNaiss) {
    const date = dAgo(n.moisAgo)
    if (!inRange(date)) continue
    await prisma.naissanceAnimale.create({ data: { userId, lotId: lotLapins.id, pereIdentifiant: "M1 (mâle reproducteur)", date, nombreNes: n.nes, nombreVivants: n.nes, nombreMales: n.m, nombreFemelles: n.f, notes: "Portée lapereaux" } })
  }

  // ── CAPRIN : campagne repro + saillies + mises-bas + lactation + qualité ──
  const campagne = await prisma.campagneReproduction.create({
    data: { userId, nom: `Lutte automne ${Y1} — désaisonnement`, typeConduite: "Effet bouc", especeAnimaleId: "chevre_alpine", dateDebut: dYMD(Y1, 9, 1), dateFin: dYMD(Y1, 10, 15), objectifMiseBas: dYMD(Y, 2, 15), notes: "Mise en lutte des 4 chèvres avec bouc Câlin (GAEC du Bocage)." },
  })

  for (const c of chevres) {
    const miseBas = dAgo(c.p.miseBasAgo)
    const dateSaillie = new Date(miseBas); dateSaillie.setUTCDate(dateSaillie.getUTCDate() - 150)
    const tarissement = new Date(miseBas); tarissement.setUTCFullYear(tarissement.getUTCFullYear() + 1); tarissement.setUTCDate(tarissement.getUTCDate() - 60)
    const confirmation = new Date(dateSaillie); confirmation.setUTCDate(confirmation.getUTCDate() + 45)
    const saillie = await prisma.saillie.create({
      data: { userId, date: dateSaillie, femelleId: c.id, type: "Monte naturelle", pereExterneRef: "Bouc Câlin (GAEC du Bocage)", campagneId: campagne.id, dateMiseBasAttendue: miseBas, dateTarissementPrevue: c.p.lactationLongue ? null : tarissement, confirmationGestation: confirmation, statut: "Mise-bas réalisée", notes: `Campagne ${campagne.nom}` },
    })
    const nb = c.nom === "Praline" ? 1 : 2
    await prisma.naissanceAnimale.create({
      data: { userId, mereId: c.id, pereIdentifiant: "Bouc Câlin", date: miseBas, nombreNes: nb, nombreVivants: nb, nombreMales: nb === 2 ? 1 : 0, nombreFemelles: nb === 2 ? 1 : 1, notes: `Mise-bas — lactation ${Y} (rang ${c.p.prior + 1})`, saillieId: saillie.id },
    })
    // Lactations antérieures : mises-bas ~annuelles (sans collectes détaillées)
    // pour un rang de lactation, un âge au 1er part et un IVV réalistes.
    for (let k = 1; k <= c.p.prior; k++) {
      const mbPrior = new Date(miseBas); mbPrior.setUTCDate(mbPrior.getUTCDate() - k * 365)
      const saPrior = new Date(mbPrior); saPrior.setUTCDate(saPrior.getUTCDate() - 150)
      const s = await prisma.saillie.create({
        data: { userId, date: saPrior, femelleId: c.id, type: "Monte naturelle", pereExterneRef: "Bouc (campagne antérieure)", dateMiseBasAttendue: mbPrior, statut: "Mise-bas réalisée", notes: `Lactation antérieure (rang ${c.p.prior + 1 - k})` },
      })
      const nbP = k === c.p.prior ? 1 : 2 // 1re mise-bas (primipare) = 1 chevreau
      await prisma.naissanceAnimale.create({
        data: { userId, mereId: c.id, pereIdentifiant: "Bouc", date: mbPrior, nombreNes: nbP, nombreVivants: nbP, nombreMales: nbP === 2 ? 1 : 0, nombreFemelles: nbP === 2 ? 1 : 1, notes: `Mise-bas antérieure`, saillieId: s.id },
      })
    }

    // Collectes matin/soir de la mise-bas à aujourd'hui
    const dimMax = Math.floor((today0().getTime() - miseBas.getTime()) / 86_400_000)
    for (let dim = 0; dim <= dimMax; dim++) {
      const jour = new Date(miseBas); jour.setUTCDate(jour.getUTCDate() + dim); jour.setUTCHours(0, 0, 0, 0)
      const total = litresJour(dim, c.p.peak)
      const matin = round2(total * 0.54)
      const soir = round2(total - matin)
      const controle = dim % 30 <= 1
      const cellules = controle ? Math.round(c.p.cellBase + c.p.cellPente * dim) : null
      const mg = controle ? round2(36 + (dim % 5)) : null
      const mp = controle ? round2(30.5 + (dim % 4) * 0.4) : null
      await prisma.collecteLait.create({ data: { userId, date: jour, traite: "Matin", animalId: c.id, quantiteLitres: matin, mgGpl: mg, mpGpl: mp, cellulesParMl: cellules } })
      await prisma.collecteLait.create({ data: { userId, date: jour, traite: "Soir", animalId: c.id, quantiteLitres: soir } })
    }
  }

  // ── Fromagerie : 3 lots à partir des collectes non affectées ──
  const libres = await prisma.collecteLait.findMany({ where: { userId, lotFromageId: null, ecarteAttente: false }, orderBy: { date: "asc" }, select: { id: true, date: true, quantiteLitres: true } })
  const fabs = [
    { type: "Tomme de chèvre", sem: 14, rendement: 0.13, prixKg: 26, dluoJ: 90, agrement: "FR 85.028.001 CE" },
    { type: "Crottin", sem: 20, rendement: 0.16, prixKg: 32, dluoJ: 21, agrement: "FR 85.028.001 CE" },
    { type: "Bûche cendrée", sem: 24, rendement: 0.15, prixKg: 28, dluoJ: 28, agrement: "FR 85.028.001 CE" },
  ]
  const part = Math.floor(libres.length / 4)
  let cur = 0
  const lotsFromage: Array<{ id: string; type: string; kg: number; prixKg: number }> = []
  for (const spec of fabs) {
    const slice = libres.slice(cur, cur + part); cur += part
    if (!slice.length) continue
    const volume = round2(slice.reduce((s, x) => s + Number(x.quantiteLitres), 0))
    const kg = round2(volume * spec.rendement)
    const nbPieces = Math.max(1, Math.round(kg / (spec.type === "Crottin" ? 0.09 : 0.25)))
    const dateFab = slice[slice.length - 1].date
    const dluo = new Date(dateFab); dluo.setUTCDate(dluo.getUTCDate() + spec.dluoJ)
    const dlc = new Date(dateFab); dlc.setUTCDate(dlc.getUTCDate() + Math.round(spec.dluoJ * 0.8))
    const lf = await prisma.lotFromage.create({
      data: { userId, numeroLot: `L-${Y}-W${String(spec.sem).padStart(2, "0")}-01`, dateFabrication: dateFab, typeFromage: spec.type, volumeLaitUtiliseL: volume, nbPieces, poidsTotalKg: kg, dluo, dlc, traitementThermique: "cru", numeroAgrement: spec.agrement, statutBioSnapshot: "AB", etat: "vendu", allergenes: "Lait" },
    })
    await prisma.collecteLait.updateMany({ where: { id: { in: slice.map((x) => x.id) } }, data: { lotFromageId: lf.id } })
    lotsFromage.push({ id: lf.id, type: spec.type, kg, prixKg: spec.prixKg })
  }

  // ── Ventes fromage (80 % écoulé) + lait cru ; 1 lot part sur facture restaurant ──
  const factureFromage: Array<{ venteProduitId: number; ttc: number; date: Date; kg: number; prixKg: number; type: string }> = []
  for (let i = 0; i < lotsFromage.length; i++) {
    const f = lotsFromage[i]
    const kgVendus = round2(f.kg * 0.8)
    if (kgVendus <= 0) continue
    const date = dAgo(10 + i * 5)
    const ttc = round2(kgVendus * f.prixKg)
    const surFacture = i === 0 // la Tomme part sur une facture restaurant
    const vp = await prisma.venteProduit.create({
      data: { userId, date, type: "autre", description: f.type, quantite: kgVendus, unite: "kg", prixUnitaire: f.prixKg, prixTotal: ttc, client: surFacture ? "Restaurant La Table du Bocage" : "Marché de La Roche-sur-Yon", paye: true, tauxTVA: 5.5, lotFromageId: f.id },
    })
    if (surFacture) factureFromage.push({ venteProduitId: vp.id, ttc, date, kg: kgVendus, prixKg: f.prixKg, type: f.type })
    else await autoVente("vente_produit", vp.id, { date, ttc, taux: 5.5, categorie: "autre", module: "elevage", description: `Vente ${f.type}` })
  }
  // Lait cru
  {
    const date = dAgo(25)
    const ttc = 132
    const vp = await prisma.venteProduit.create({ data: { userId, date, type: "lait", description: "Lait cru de chèvre", quantite: 120, unite: "L", prixUnitaire: 1.1, prixTotal: ttc, client: "Fromagerie voisine", paye: true, tauxTVA: 5.5 } })
    await autoVente("vente_produit", vp.id, { date, ttc, taux: 5.5, categorie: "lait", module: "elevage", description: "Vente lait cru" })
  }

  return { factureFromage }
}

// ═════════════════════════════════════════════════════════════════════════════
//  BOUTIQUE EN LIGNE
// ═════════════════════════════════════════════════════════════════════════════

async function seedBoutique() {
  const slug = "ferme-du-bois-joli" + (IS_CLONE ? `-${userId.slice(-6)}` : "")
  const boutique = await prisma.boutique.create({
    data: { userId, slug, nom: "Ferme du Bois Joli", description: "Légumes bio, œufs frais, fromages de chèvre & confitures — La Boissière-de-Montaigu (85).", descCourte: "AMAP, marché & boutique en ligne", couleurPrimaire: "#16a34a", couleurSecondaire: "#f59e0b", email: "contact@ferme-bois-joli.fr", telephone: "02 51 42 00 00", ville: "La Boissière-de-Montaigu", codePostal: "85600", modesPaiement: "Espèces, chèque, virement, CB", modesLivraison: "Retrait à la ferme (mercredi 17h-19h), marché du samedi (Montaigu)", active: true },
  })
  const produits = [
    { nom: "Panier AMAP hebdo", prix: 20, unite: "panier", categorie: "legumes", ordre: 1 },
    { nom: "Panier découverte", prix: 27, unite: "panier", categorie: "legumes", ordre: 2 },
    { nom: "Boîte de 6 œufs", prix: 3.2, unite: "boîte", categorie: "oeufs", ordre: 3, stockDispo: 40 },
    { nom: "Tomme de chèvre (250 g)", prix: 7, unite: "pièce", categorie: "cremerie", ordre: 4, stockDispo: 15 },
    { nom: "Crottin de chèvre", prix: 3, unite: "pièce", categorie: "cremerie", ordre: 5, stockDispo: 30 },
    { nom: "Confiture mirabelle 250 g", prix: 5, unite: "pot", categorie: "epicerie", ordre: 6, stockDispo: 24 },
    { nom: "Botte de radis", prix: 1.8, unite: "botte", categorie: "legumes", ordre: 7 },
    { nom: "Salade", prix: 1.5, unite: "pièce", categorie: "legumes", ordre: 8 },
  ]
  const pid: Record<string, number> = {}
  for (const p of produits) {
    const row = await prisma.produitBoutique.create({ data: { userId, boutiqueId: boutique.id, ...p } })
    pid[p.nom] = row.id
  }

  type Cmd = { client: string; joursAgo: number; statut: string; lignes: Array<[string, number]> }
  const cmds: Cmd[] = [
    { client: "Marie Dubois", joursAgo: 150, statut: "livree", lignes: [["Panier AMAP hebdo", 1], ["Boîte de 6 œufs", 2]] },
    { client: "Jean Bertin", joursAgo: 135, statut: "livree", lignes: [["Panier découverte", 1], ["Tomme de chèvre (250 g)", 2]] },
    { client: "Sophie Renard", joursAgo: 120, statut: "livree", lignes: [["Panier AMAP hebdo", 2]] },
    { client: "Paul Moreau", joursAgo: 100, statut: "livree", lignes: [["Panier découverte", 1], ["Confiture mirabelle 250 g", 3]] },
    { client: "Anne Leroux", joursAgo: 85, statut: "livree", lignes: [["Panier AMAP hebdo", 1], ["Boîte de 6 œufs", 1], ["Crottin de chèvre", 2]] },
    { client: "Marc Pichon", joursAgo: 70, statut: "livree", lignes: [["Panier découverte", 2]] },
    { client: "Lucie Martin", joursAgo: 55, statut: "livree", lignes: [["Panier AMAP hebdo", 2], ["Boîte de 6 œufs", 3]] },
    { client: "François Royer", joursAgo: 40, statut: "livree", lignes: [["Panier découverte", 1], ["Tomme de chèvre (250 g)", 1], ["Confiture mirabelle 250 g", 1]] },
    { client: "Élise Bonnet", joursAgo: 28, statut: "livree", lignes: [["Panier AMAP hebdo", 1]] },
    { client: "Thomas Carré", joursAgo: 18, statut: "livree", lignes: [["Panier découverte", 1], ["Salade", 6]] },
    { client: "Aurélie Petit", joursAgo: 10, statut: "livree", lignes: [["Panier AMAP hebdo", 2], ["Botte de radis", 4]] },
    { client: "Bernard Sallenave", joursAgo: 4, statut: "prete", lignes: [["Panier découverte", 1], ["Boîte de 6 œufs", 2]] },
    { client: "Hélène Janvier", joursAgo: 2, statut: "confirmee", lignes: [["Panier AMAP hebdo", 1], ["Crottin de chèvre", 3]] },
    { client: "Pierre Vincent", joursAgo: 1, statut: "nouveau", lignes: [["Panier découverte", 1], ["Tomme de chèvre (250 g)", 1]] },
  ]
  let n = 1
  for (const c of cmds) {
    const date = dAgo(c.joursAgo)
    const lignes = c.lignes.map(([nom, q]) => {
      const p = produits.find((x) => x.nom === nom)!
      return { produitId: pid[nom], nom, unite: p.unite, quantite: q, prixUnitaire: p.prix, total: round2(p.prix * q) }
    })
    const total = round2(lignes.reduce((s, l) => s + l.total, 0))
    const numero = (IS_CLONE ? `ADM-${userId.slice(-4)}-` : "") + `CMD-${Y}-${String(n).padStart(4, "0")}`
    const cmd = await prisma.commandeBoutique.create({
      data: { userId, boutiqueId: boutique.id, numero, clientNom: c.client, clientEmail: `${c.client.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".")}@example.fr`, total, statut: c.statut, createdAt: date, updatedAt: date, lignes: { create: lignes } },
    })
    // Commande livrée → VenteManuelle (module boutique). Non « auto » (saisie
    // matérialisée), catégorie legumes → ventilée en potager.
    if (c.statut === "livree") {
      const s = splitTTC(total, 5.5)
      await prisma.venteManuelle.create({
        data: { userId, date, categorie: "legumes", description: `Commande boutique ${numero} — ${c.client}`, montant: s.montant, montantHT: s.montantHT, montantTVA: s.montantTVA, tauxTVA: 5.5, journal: "VE", module: "boutique", paye: true, sourceType: "commande_boutique", sourceId: cmd.id, auto: false },
      })
    }
    n++
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  COMPTABILITÉ : clients, ventes AMAP/marché, dépenses, factures B2B, N-1
// ═════════════════════════════════════════════════════════════════════════════

async function seedVentesMarche() {
  // AMAP hebdo (15 paniers × 20 €) + marché du samedi, du 1er janvier à aujourd'hui.
  const jan1 = dYMD(Y, 1, 1)
  let d = new Date(jan1)
  let sem = 1
  while (d.getTime() <= NOW.getTime()) {
    // AMAP (mercredi)
    const amap = new Date(d); amap.setUTCDate(amap.getUTCDate() + 2)
    if (amap.getTime() <= NOW.getTime()) {
      const nb = 15
      const s = splitTTC(round2(nb * 20), 5.5)
      await prisma.venteManuelle.create({ data: { userId, date: amap, categorie: "legumes", description: `AMAP semaine ${sem} — ${nb} paniers`, quantite: nb, unite: "panier", prixUnitaire: 20, montant: s.montant, montantHT: s.montantHT, montantTVA: s.montantTVA, tauxTVA: 5.5, journal: "VE", module: "potager", paye: true } })
    }
    // Marché (samedi) — montant variable
    const sam = new Date(d); sam.setUTCDate(sam.getUTCDate() + 5)
    if (sam.getTime() <= NOW.getTime()) {
      const mois = sam.getUTCMonth()
      const base = mois >= 4 && mois <= 8 ? 190 : 120 // saison haute
      const montant = base + ((sem * 13) % 60)
      const s = splitTTC(montant, 5.5)
      await prisma.venteManuelle.create({ data: { userId, date: sam, categorie: "legumes", description: `Marché de Montaigu — samedi S${sem}`, montant: s.montant, montantHT: s.montantHT, montantTVA: s.montantTVA, tauxTVA: 5.5, journal: "VE", module: "potager", paye: true } })
    }
    d.setUTCDate(d.getUTCDate() + 7); sem++
  }
}

async function seedDepenses() {
  // Dépenses manuelles (non auto) de l'année courante — charges de structure & intrants.
  const dep: Array<{ mois: number; jour: number; cat: string; desc: string; ttc: number; taux: number; module: string; fournisseur?: string }> = [
    { mois: 1, jour: 12, cat: "materiel", desc: "Semences & plants bio (printemps)", ttc: 620, taux: 20, module: "potager", fournisseur: "Semences du Terroir" },
    { mois: 1, jour: 20, cat: "abonnement", desc: "MSA — cotisations T1", ttc: 980, taux: 0, module: "general", fournisseur: "MSA" },
    { mois: 2, jour: 8, cat: "materiel", desc: "Terreau, compost & paillage", ttc: 340, taux: 20, module: "potager" },
    { mois: 2, jour: 18, cat: "materiel", desc: "Cotisation contrôle bio (Ecocert)", ttc: 480, taux: 20, module: "general", fournisseur: "Ecocert" },
    { mois: 3, jour: 6, cat: "carburant", desc: "Gasoil non routier (GNR)", ttc: 210, taux: 20, module: "general" },
    { mois: 3, jour: 22, cat: "materiel", desc: "Filet anti-insectes & voile P17", ttc: 155, taux: 20, module: "potager" },
    { mois: 4, jour: 20, cat: "abonnement", desc: "MSA — cotisations T2", ttc: 980, taux: 0, module: "general", fournisseur: "MSA" },
    { mois: 4, jour: 15, cat: "autre", desc: "Assurance exploitation (Groupama)", ttc: 420, taux: 0, module: "general", fournisseur: "Groupama" },
    { mois: 5, jour: 5, cat: "materiel", desc: "Aliment poules — 200 kg", ttc: 190, taux: 10, module: "elevage" },
    { mois: 5, jour: 14, cat: "carburant", desc: "Gasoil tracteur + motoculteur", ttc: 175, taux: 20, module: "general" },
    { mois: 6, jour: 3, cat: "autre", desc: "Électricité serre & chambre froide", ttc: 240, taux: 20, module: "general", fournisseur: "EDF" },
    { mois: 6, jour: 24, cat: "materiel", desc: "Emballages fromagerie & étiquettes", ttc: 130, taux: 20, module: "elevage" },
    { mois: 7, jour: 10, cat: "carburant", desc: "Gasoil non routier (GNR)", ttc: 205, taux: 20, module: "general" },
  ]
  for (const x of dep) {
    const date = dYMD(Y, x.mois, x.jour)
    if (!inRange(date)) continue
    const s = splitTTC(x.ttc, x.taux)
    await prisma.depenseManuelle.create({
      data: { userId, date, categorie: x.cat, description: x.desc, tauxTVA: x.taux, montantHT: x.taux ? s.montantHT : x.ttc, montantTVA: x.taux ? s.montantTVA : 0, montant: x.ttc, journal: "AC", module: x.module, fournisseurNom: x.fournisseur ?? null, paye: true },
    })
  }
}

/** Clients + factures B2B adossées 1:1 à des ventes sources (pas d'écriture auto). */
async function seedClientsEtFactures(sources: {
  factureFruits: Array<{ recolteArbreId: number; ttc: number; date: Date; kg: number; prixKg: number }>
  factureFromage: Array<{ venteProduitId: number; ttc: number; date: Date; kg: number; prixKg: number; type: string }>
}) {
  // Clients professionnels
  const restaurant = await prisma.client.create({
    data: { userId, nom: "Restaurant La Table du Bocage", type: "professionnel", email: "resa@tabledubocage.fr", telephone: "02 51 46 10 20", adresse: "12 place du Marché", ville: "Montaigu-Vendée", codePostal: "85600", siret: "51820390200019", conditionsPaiement: 30, exonererTVA: false, actif: true },
  })
  const epicerie = await prisma.client.create({
    data: { userId, nom: "Épicerie Bio du Bocage", type: "professionnel", email: "contact@biodubocage.fr", telephone: "02 51 09 88 77", adresse: "3 rue des Halles", ville: "La Roche-sur-Yon", codePostal: "85000", siret: "79028461500023", conditionsPaiement: 30, exonererTVA: false, actif: true },
  })
  // Quelques clients particuliers connus (issus AMAP)
  for (const nom of ["Marie Dubois", "Jean Bertin", "Famille Renard (AMAP)"]) {
    await prisma.client.create({ data: { userId, nom, type: "particulier", exonererTVA: false, actif: true } })
  }

  let numero = 1
  const nextNum = () => `F-${Y}-${String(numero++).padStart(4, "0")}`

  // Montants alignés au centime pour un FEC équilibré PAR écriture :
  // ttcR = round2(htR + tvaR). La source est réalignée sur ce ttcR pour que la
  // ventilation modules (lit la source) == SSOT (lit la facture).
  function totalsTTC(ttc: number, taux: number) {
    const htR = round2(ttc / (1 + taux / 100))
    const tvaR = round2(ttc - ttc / (1 + taux / 100))
    const ttcR = round2(htR + tvaR)
    return { htR, tvaR, ttcR }
  }

  // Facture 1 — Restaurant : Tomme de chèvre (adossée à un VenteProduit)
  for (const ff of sources.factureFromage) {
    const { htR, tvaR, ttcR } = totalsTTC(ff.ttc, 5.5)
    const echeance = new Date(ff.date); echeance.setUTCDate(echeance.getUTCDate() + 30)
    const fac = await prisma.facture.create({
      data: {
        userId, numero: nextNum(), type: "facture", clientId: restaurant.id, clientNom: restaurant.nom,
        clientAdresse: "12 place du Marché, 85600 Montaigu-Vendée", date: ff.date, dateEcheance: echeance,
        objet: `Livraison fromages ${Y}`, totalHT: htR, totalTVA: tvaR, totalTTC: ttcR,
        totauxParTauxTva: { "5.5": { ht: htR, tva: tvaR } },
        statut: inRange(echeance) ? "payee" : "emise", datePaiement: inRange(echeance) ? echeance : null, modePaiement: "virement",
        conditionsPaiement: "Paiement à 30 jours",
        lignes: { create: [{ ordre: 1, description: `${ff.type} — fromage fermier au lait cru de chèvre`, quantite: ff.kg, unite: "kg", prixUnitaire: ff.prixKg, tauxTVA: 5.5, montantHT: htR, montantTVA: tvaR, montantTTC: ttcR, statutBio: "AB" }] },
      },
    })
    await prisma.venteProduit.update({ where: { id: ff.venteProduitId }, data: { factureId: fac.id, prixTotal: ttcR } })
  }

  // Facture 2 — Épicerie bio : cerises (adossée à un RecolteArbre)
  for (const ff of sources.factureFruits) {
    const { htR, tvaR, ttcR } = totalsTTC(ff.ttc, 5.5)
    const echeance = new Date(ff.date); echeance.setUTCDate(echeance.getUTCDate() + 30)
    const fac = await prisma.facture.create({
      data: {
        userId, numero: nextNum(), type: "facture", clientId: epicerie.id, clientNom: epicerie.nom,
        clientAdresse: "3 rue des Halles, 85000 La Roche-sur-Yon", date: ff.date, dateEcheance: echeance,
        objet: `Livraison fruits ${Y}`, totalHT: htR, totalTVA: tvaR, totalTTC: ttcR,
        totauxParTauxTva: { "5.5": { ht: htR, tva: tvaR } },
        statut: "emise", modePaiement: null, conditionsPaiement: "Paiement à 30 jours",
        lignes: { create: [{ ordre: 1, description: "Cerises Burlat — cat. I, AB", quantite: ff.kg, unite: "kg", prixUnitaire: ff.prixKg, tauxTVA: 5.5, montantHT: htR, montantTVA: tvaR, montantTTC: ttcR, statutBio: "AB" }] },
      },
    })
    await prisma.recolteArbre.update({ where: { id: ff.recolteArbreId }, data: { factureId: fac.id, prixTotal: ttcR } })
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  HISTORIQUE N-1 (synthèses mensuelles → comparatifs)
// ═════════════════════════════════════════════════════════════════════════════

async function seedHistoriqueN1() {
  // Revenus mensuels (VenteManuelle non auto) + dépenses mensuelles. Année Y-1
  // complète, légèrement inférieure à Y (croissance de la ferme).
  const revMois = [900, 1100, 1600, 2100, 2600, 2900, 3100, 3000, 2700, 2200, 1500, 1300] // ~ 25k
  const depMois = [1300, 900, 1100, 1400, 1200, 1000, 950, 900, 1100, 1000, 850, 1200] // ~ 12,9k
  for (let m = 0; m < 12; m++) {
    const dv = dYMD(Y1, m + 1, 15)
    const sv = splitTTC(revMois[m], 5.5)
    await prisma.venteManuelle.create({ data: { userId, date: dv, categorie: "legumes", description: `Ventes ${Y1} — ${["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"][m]}. (AMAP, marché, boutique)`, montant: sv.montant, montantHT: sv.montantHT, montantTVA: sv.montantTVA, tauxTVA: 5.5, journal: "VE", module: "potager", paye: true } })
    const dd = dYMD(Y1, m + 1, 20)
    const sd = splitTTC(depMois[m], 20)
    await prisma.depenseManuelle.create({ data: { userId, date: dd, categorie: "materiel", description: `Charges ${Y1} — ${["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"][m]}.`, montant: sd.montant, montantHT: sd.montantHT, montantTVA: sd.montantTVA, tauxTVA: 20, journal: "AC", module: "general", paye: true } })
  }
}

// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`▶ Seed démo v2 « ${DEMO_NAME} » — année ${Y} (evergreen, ancre = ${today0().toISOString().slice(0, 10)})`)
  const user = await ensureUser()
  console.log(`  ✓ User ${user.email} (id=${userId})`)

  const hasData = await prisma.planche.count({ where: { userId } })
  if (hasData > 0) {
    console.log(`⚠ ${DEMO_EMAIL} possède déjà ${hasData} planche(s). Lancez d'abord : npx tsx prisma/reset-demo.ts`)
    return
  }

  await ensureExploitation(); console.log("  ✓ Exploitation (EARL, réel simplifié + TVA)")
  await ensurePrefs(); await ensureEspecesAnimales(); await ensureAliments(); await seedStationMeteo()

  const parcelles = await seedParcelles(); console.log(`  ✓ Parcelles: ${Object.keys(parcelles).length}`)
  const planches = await seedPlanches(parcelles); console.log(`  ✓ Planches: ${Object.keys(planches).length}`)
  const cultures = await seedCultures(planches); console.log(`  ✓ Cultures: ${cultures.length}`)
  await seedRecoltes(cultures); console.log("  ✓ Récoltes maraîchage (+ ventes auto)")
  await seedStocks(); console.log("  ✓ Stocks espèces")
  const verger = await seedArbres(parcelles); console.log("  ✓ Verger (arbres, opérations, récoltes fruits)")
  const elevage = await seedElevage(parcelles); console.log("  ✓ Élevage complet (poules, brebis, cochons, lapins, caprin laitier pro)")
  await seedBoutique(); console.log("  ✓ Boutique (produits + commandes)")
  await seedVentesMarche(); console.log("  ✓ AMAP & marché (YTD)")
  await seedDepenses(); console.log("  ✓ Dépenses de structure (YTD)")
  await seedClientsEtFactures({ factureFruits: verger.factureFruits, factureFromage: elevage.factureFromage })
  console.log("  ✓ Clients + factures B2B (adossées aux ventes, FEC-ready)")
  await seedHistoriqueN1(); console.log(`  ✓ Historique ${Y1} (comparatif N-1)`)

  console.log("✅ Seed démo v2 terminé. Vérifier : npx tsx prisma/verify-demo.ts")
}

main()
  .catch((err) => { console.error("❌ Erreur seed :", err); process.exit(1) })
  .finally(() => prisma.$disconnect())
