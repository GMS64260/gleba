/**
 * Verger : seize fruitiers plantés entre 2018 et 2022 (verger établi, aucun
 * achat sur l'année), calendrier d'entretien de l'app sur deux saisons,
 * observations sanitaires résolues, récoltes à la vraie saison de chaque
 * variété, ventes directes avec leur règlement, jus de pomme et confiture.
 *
 * Tout passe par les fonctions de l'application : `planCalendrierEntretien`,
 * `creerRecolteFruit` (numéro de lot, parcelle, statut bio), `modifierVenteVerger`
 * (miroir comptable et règlement), `creerLotTransforme` (sortie des fruits).
 */

import { randomUUID } from "node:crypto"
import { findTreeCareProfile } from "../../src/lib/tree-care-calendar"
import { planCalendrierEntretien } from "../../src/lib/verger/creation-arbre"
import { creerRecolteFruit } from "../../src/lib/verger/creation-recolte"
import { prochainNumeroLotVerger } from "../../src/lib/verger/numero-lot"
import { creerLotTransforme } from "../../src/lib/verger/transformation"
import { modifierVenteVerger } from "../../src/lib/verger/vente"
import { alea, anneeDerniere, AUJ, graine, jour, journal, passe, plusJours, prisma, round1, round2, Y, type Contexte } from "./contexte"

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Lundi de la semaine ISO `s` de l'année `a` (00:00 UTC). */
function lundiIso(a: number, s: number): Date {
  const jan4 = new Date(Date.UTC(a, 0, 4))
  const dow = jan4.getUTCDay() || 7
  return new Date(Date.UTC(a, 0, 4 - dow + 1 + (s - 1) * 7))
}

type ArbreSpec = {
  nom: string; espece: string; variete: string; pg: string | null; plante: [number, number, number]
  x: number; y: number; env: number; envA: number; hauteur: number; conduite: string
  /** Semaines ISO des passages de récolte (+ jour dans la semaine). */
  passages: number[]; kg: number; prix: number; couleur: string; groupe?: string; autofertile?: boolean
}

const VERT = { Pommier: "#2f855a", Poirier: "#38a169", Prunier: "#276749", Cerisier: "#48bb78", Figuier: "#68d391", Noyer: "#22543d" }

const ARBRES: ArbreSpec[] = [
  { nom: "Reine des Reinettes 1", espece: "Pommier", variete: "Reine des Reinettes", pg: "MM106", plante: [Y - 7, 12, 4], x: 5, y: 5, env: 3.4, envA: 4.5, hauteur: 3.6, conduite: "Gobelet", passages: [35, 37], kg: 38, prix: 3, couleur: VERT.Pommier, groupe: "B" },
  { nom: "Reine des Reinettes 2", espece: "Pommier", variete: "Reine des Reinettes", pg: "MM106", plante: [Y - 7, 12, 4], x: 10.5, y: 5, env: 3.2, envA: 4.5, hauteur: 3.5, conduite: "Gobelet", passages: [35, 37], kg: 34, prix: 3, couleur: VERT.Pommier, groupe: "B" },
  { nom: "Golden 1", espece: "Pommier", variete: "Golden Delicious", pg: "MM106", plante: [Y - 7, 12, 4], x: 16, y: 5, env: 3.1, envA: 4, hauteur: 3.4, conduite: "Axe central", passages: [39, 41], kg: 42, prix: 2.8, couleur: VERT.Pommier, groupe: "C" },
  { nom: "Belle de Boskoop 1", espece: "Pommier", variete: "Belle de Boskoop", pg: "MM106", plante: [Y - 6, 1, 18], x: 21.5, y: 5, env: 3.6, envA: 5, hauteur: 3.8, conduite: "Gobelet", passages: [41, 43], kg: 45, prix: 3, couleur: VERT.Pommier, groupe: "B" },
  { nom: "Belle de Boskoop 2", espece: "Pommier", variete: "Belle de Boskoop", pg: "MM106", plante: [Y - 6, 1, 18], x: 27, y: 5, env: 3.5, envA: 5, hauteur: 3.7, conduite: "Gobelet", passages: [41, 43], kg: 41, prix: 3, couleur: VERT.Pommier, groupe: "B" },
  { nom: "Williams 1", espece: "Poirier", variete: "Williams (Bon Chrétien)", pg: "Cognassier BA29", plante: [Y - 6, 2, 9], x: 5, y: 10.5, env: 2.8, envA: 4, hauteur: 3.9, conduite: "Axe central", passages: [33, 34], kg: 26, prix: 3.5, couleur: VERT.Poirier },
  { nom: "Williams 2", espece: "Poirier", variete: "Williams (Bon Chrétien)", pg: "Cognassier BA29", plante: [Y - 6, 2, 9], x: 10.5, y: 10.5, env: 2.7, envA: 4, hauteur: 3.8, conduite: "Axe central", passages: [33, 34], kg: 24, prix: 3.5, couleur: VERT.Poirier },
  { nom: "Conférence", espece: "Poirier", variete: "Conférence", pg: "Cognassier BA29", plante: [Y - 6, 2, 9], x: 16, y: 10.5, env: 2.6, envA: 4, hauteur: 3.6, conduite: "Axe central", passages: [39, 41], kg: 30, prix: 3.5, couleur: VERT.Poirier },
  { nom: "Mirabelle 1", espece: "Prunier", variete: "Mirabelle de Nancy", pg: "Saint-Julien A", plante: [Y - 6, 2, 10], x: 21.5, y: 10.5, env: 3, envA: 4.5, hauteur: 3.5, conduite: "Gobelet", passages: [33, 34], kg: 22, prix: 5.5, couleur: VERT.Prunier, autofertile: true },
  { nom: "Mirabelle 2", espece: "Prunier", variete: "Mirabelle de Nancy", pg: "Saint-Julien A", plante: [Y - 6, 2, 10], x: 27, y: 10.5, env: 3.1, envA: 4.5, hauteur: 3.6, conduite: "Gobelet", passages: [33, 34], kg: 20, prix: 5.5, couleur: VERT.Prunier, autofertile: true },
  { nom: "Reine-Claude dorée", espece: "Prunier", variete: "Reine Claude Dorée", pg: "Saint-Julien A", plante: [Y - 5, 1, 22], x: 5, y: 16, env: 2.6, envA: 4.5, hauteur: 3.2, conduite: "Gobelet", passages: [31, 32], kg: 18, prix: 5, couleur: VERT.Prunier, autofertile: true },
  { nom: "Burlat", espece: "Cerisier", variete: "Burlat", pg: "Sainte-Lucie 64", plante: [Y - 5, 1, 22], x: 10.5, y: 16, env: 3.4, envA: 6, hauteur: 4.2, conduite: "Gobelet", passages: [22, 23], kg: 16, prix: 8, couleur: VERT.Cerisier },
  { nom: "Napoléon", espece: "Cerisier", variete: "Napoléon (Royal Ann)", pg: "Sainte-Lucie 64", plante: [Y - 5, 1, 22], x: 16, y: 16, env: 3.2, envA: 6, hauteur: 4, conduite: "Gobelet", passages: [25], kg: 17, prix: 8, couleur: VERT.Cerisier },
  { nom: "Figuier", espece: "Figuier", variete: "Brown Turkey", pg: null, plante: [Y - 7, 3, 20], x: 21.5, y: 16, env: 3.5, envA: 5, hauteur: 3, conduite: "Libre", passages: [30, 33, 36], kg: 12, prix: 9, couleur: VERT.Figuier, autofertile: true },
  { nom: "Noyer 1", espece: "Noyer", variete: "Franquette", pg: null, plante: [Y - 8, 12, 2], x: 8, y: 25, env: 6, envA: 12, hauteur: 6.5, conduite: "Libre", passages: [40, 41], kg: 11, prix: 8, couleur: VERT.Noyer },
  { nom: "Noyer 2", espece: "Noyer", variete: "Franquette", pg: null, plante: [Y - 8, 12, 2], x: 21, y: 25, env: 5.6, envA: 12, hauteur: 6.2, conduite: "Libre", passages: [40, 41], kg: 9, prix: 8, couleur: VERT.Noyer },
]

export async function seedVerger(ctx: Contexte) {
  const { userId } = ctx
  const parcelleId = ctx.parcelles.V
  const ids = new Map<string, number>()

  for (const a of ARBRES) {
    const esp = await prisma.espece.findUnique({ where: { id: a.espece }, select: { id: true } })
    const datePlantation = jour(a.plante[0], a.plante[1], a.plante[2])
    const row = await prisma.arbre.create({
      data: {
        userId, nom: a.nom, type: "fruitier", especeId: esp?.id ?? null, espece: a.espece, variete: a.variete,
        portGreffe: a.pg, datePlantation, dateAchat: plusJours(datePlantation, -20), fournisseur: "Pépinières de la Sèvre (Clisson)",
        posX: a.x, posY: a.y, envergure: a.env, envergureAdulte: a.envA, hauteur: a.hauteur, etat: "bon",
        formeTaille: a.conduite, productif: true, anneeProduction: a.plante[0] + 3, rendementMoyen: a.kg,
        couleur: a.couleur, parcelleGeoId: parcelleId, groupePollinisation: a.groupe ?? null, autofertile: a.autofertile ?? false,
        vigueur: a.espece === "Noyer" ? "forte" : "moyenne", distancePlantation: 5.5,
      },
    })
    ids.set(a.nom, row.id)
  }

  // Pollinisation croisée (pommiers diploïdes pour les Boskoop triploïdes).
  const pollinise: Array<[string, string, string]> = [
    ["Reine des Reinettes 1", "Golden 1", "excellente"], ["Reine des Reinettes 2", "Golden 1", "excellente"],
    ["Golden 1", "Reine des Reinettes 1", "bonne"], ["Belle de Boskoop 1", "Golden 1", "bonne"], ["Belle de Boskoop 2", "Reine des Reinettes 2", "bonne"],
    ["Williams 1", "Conférence", "excellente"], ["Williams 2", "Conférence", "excellente"], ["Conférence", "Williams 1", "bonne"],
    ["Burlat", "Napoléon", "bonne"], ["Napoléon", "Burlat", "bonne"],
  ]
  for (const [cible, source, compatibilite] of pollinise) {
    await prisma.pollinisationArbre.create({ data: { arbrePolliniseId: ids.get(cible)!, arbrePollinisateurId: ids.get(source)!, compatibilite } })
  }

  const nbOperations = await seedCalendrier(ctx, ids)
  await seedObservations(ctx, ids)
  const { lotsPourCommerce, nbLots } = await seedRecoltes(ctx, ids)
  const transformes = await seedTransformations(ctx)
  await seedBois(ctx, ids)

  ctx.partage.verger = { lotsFruitsPourCommerce: lotsPourCommerce, lotsTransformesPourCommerce: transformes }
  journal(`Verger : ${ARBRES.length} arbres, ${nbOperations} opérations d'entretien, ${nbLots} lots de fruits, ${transformes.length} produits transformés`)
}

/** Calendrier d'entretien de l'app sur Y-1 et Y : le passé est fait, le reste planifié. */
async function seedCalendrier(ctx: Contexte, ids: Map<string, number>) {
  let total = 0
  for (const a of ARBRES) {
    const profil = findTreeCareProfile(a.espece, "fruitier")
    if (!profil) continue
    for (const annee of [Y - 1, Y]) {
      const { operations } = planCalendrierEntretien(profil, { id: ids.get(a.nom)!, variete: a.variete, datePlantation: jour(a.plante[0], a.plante[1], a.plante[2]), productif: true }, ctx.userId, { annee, maintenant: new Date(Date.UTC(annee, 0, 1)) })
      if (!operations.length) continue
      await prisma.operationArbre.createMany({ data: operations })
      total += operations.length
    }
  }
  // Ce qui est passé a été fait, à sa date conseillée (hier au plus tard).
  // Pas de coût par arbre : le produit (bouillie bordelaise, compost) est une
  // facture fournisseur du module commerce, pas seize petites dépenses.
  await prisma.operationArbre.updateMany({ where: { userId: ctx.userId, date: { lt: AUJ } }, data: { fait: true } })
  return total
}

async function seedObservations(ctx: Contexte, ids: Map<string, number>) {
  const aTavelure = anneeDerniere(4, 8)
  await prisma.observationSante.create({
    data: {
      userId: ctx.userId, arbreId: ids.get("Golden 1")!, parcelleId: ctx.parcelles.V, date: jour(aTavelure, 4, 8), type: "maladie",
      symptome: "Taches brun olive sur les jeunes feuilles", diagnostic: "Tavelure du pommier", gravite: "moyenne", organe: "feuilles",
      stadeBBCH: "57", pctOrganesTouches: 15, traitement: "Bouillie bordelaise préventive après pluie contaminatrice",
      methodeTraitement: "chimique", produit: "Bouillie bordelaise RSR Disperss", numAMM: "2000232", doseAppliquee: 7.5, uniteDose: "kg/ha", dar: 21,
      temperatureC: 14, ventKmh: 6, hygrometriePct: 78, pluie24h: false, zntRespectee: true, zntDistanceM: 5,
      resolu: true, dateResolution: jour(aTavelure, 6, 10), notes: "Variété sensible ; ramasser les feuilles à l'automne.",
    },
  })
  const aPuceron = anneeDerniere(5, 12)
  await prisma.observationSante.create({
    data: {
      userId: ctx.userId, arbreId: ids.get("Reine des Reinettes 1")!, parcelleId: ctx.parcelles.V, date: jour(aPuceron, 5, 12), type: "ravageur",
      symptome: "Feuilles enroulées en bout de pousses", diagnostic: "Puceron cendré", gravite: "faible", organe: "pousses",
      pctOrganesTouches: 5, traitement: "Savon noir à 2 %, lâcher de chrysopes", methodeTraitement: "biologique",
      resolu: true, dateResolution: jour(aPuceron, 6, 2), notes: "Coccinelles bien présentes dès fin mai.",
    },
  })
}

/** Récoltes de chaque variété à sa semaine, ventes directes et lots de garde. */
async function seedRecoltes(ctx: Contexte, ids: Map<string, number>) {
  const { userId } = ctx
  const amap = ctx.clients.amap
  const r = alea(graine("verger"))
  const lotsPourCommerce: number[] = []
  // Les pommes Reine des Reinettes de la dernière saison de jus partent au pressoir.
  const anneeJus = anneeDerniere(10, 20)
  const anneeConfiture = anneeDerniere(8, 28)
  let nbLots = 0
  const enAttente: Array<{ id: number; arbre: string; date: Date; annee: number }> = []

  for (const annee of [Y - 1, Y]) {
    for (const a of ARBRES) {
      for (const [k, semaine] of a.passages.entries()) {
        const date = plusJours(lundiIso(annee, semaine), 1 + (k % 3))
        if (date.getTime() >= AUJ.getTime()) continue
        const kg = round1((a.kg / a.passages.length) * (0.85 + r() * 0.3))
        const garde = ["Pommier", "Poirier", "Noyer"].includes(a.espece) && !a.variete.startsWith("Williams")
        const auPressoir = a.variete === "Reine des Reinettes" && annee === anneeJus
        const aLaConfiture = a.nom === "Mirabelle 2" && annee === anneeConfiture && k === 1
        // Valeurs des listes fermées de la base (recoltes_arbres_*_check).
        const lot = await creerRecolteFruit(userId, {
          arbreId: ids.get(a.nom)!, quantite: kg, date: iso(date), qualite: k === a.passages.length - 1 && r() < 0.3 ? "moyen" : "bon",
          categorieCommerciale: auPressoir ? "Cat II" : "Cat I",
          conditionnement: a.espece === "Noyer" ? "Vrac" : a.espece === "Cerisier" || a.espece === "Figuier" ? "Cagette 5kg" : "Cagette 10kg",
          destinationCommerce: auPressoir ? "Jus/Cidre" : aLaConfiture ? "Transformation interne" : (k + semaine) % 2 === 1 ? "Frais marché" : "Frais AMAP",
          ...(garde ? { datePeremption: iso(plusJours(date, a.espece === "Noyer" ? 300 : 150)) } : { datePeremption: iso(plusJours(date, 10)) }),
        })
        nbLots++
        if (auPressoir || aLaConfiture) { enAttente.push({ id: lot.id, arbre: a.nom, date, annee }); continue }
        // Garde : vendue au fil de l'automne et de l'hiver ; récente, elle reste en stock.
        const dateVente = garde ? plusJours(date, 20 + Math.floor(r() * 60)) : date
        if (dateVente.getTime() >= AUJ.getTime()) {
          if (annee === Y || garde) lotsPourCommerce.push(lot.id)
          continue
        }
        const marche = (k + semaine) % 2 === 1
        const prixKg = round2(a.prix * (0.95 + r() * 0.1))
        await modifierVenteVerger("fruit", userId, userId, lot.id, {
          statut: "vendu", prixKg, dateVente: iso(dateVente), paye: true, modeReglement: marche ? "Espèces" : "Chèque",
          ...(marche ? { clientNom: "Marché de Montaigu" } : { clientId: amap.id, clientNom: amap.nom }),
        })
      }
    }
  }
  ctx.partage.vergerEnAttente = enAttente
  return { lotsPourCommerce, nbLots }
}

/** Jus de pomme (pressoir d'octobre) et confiture de mirabelle (fin août). */
async function seedTransformations(ctx: Contexte) {
  const enAttente = (ctx.partage.vergerEnAttente ?? []) as Array<{ id: number; arbre: string; date: Date; annee: number }>
  const lots = await prisma.recolteArbre.findMany({ where: { id: { in: enAttente.map((e) => e.id) } }, select: { id: true, quantite: true, date: true } })
  const parId = new Map(lots.map((l) => [l.id, l]))
  const crees: number[] = []

  const pommes = enAttente.filter((e) => e.arbre.startsWith("Reine des Reinettes")).map((e) => parId.get(e.id)!).filter(Boolean)
  if (pommes.length) {
    const kg = pommes.reduce((s, l) => s + l.quantite, 0)
    const date = jour(anneeDerniere(10, 20), 10, 20)
    const bouteilles = Math.floor(kg * 0.62)
    const lot = await creerLotTransforme(ctx.userId, {
      produit: "Jus de pomme bio, bouteille 1 L", quantite: bouteilles, unite: "pièce", date: iso(date), datePeremption: iso(plusJours(date, 540)),
      prixUnitaire: 4.2, tauxTVA: 5.5, cleIdempotence: `seed-jus-${randomUUID()}`, notes: "Pressage au pressoir mobile de l'Association des croqueurs de pommes, pasteurisé à 75 °C.",
      sources: pommes.map((l) => ({ fruitId: l.id, quantite: l.quantite })),
    })
    crees.push(lot.id)
  }
  const mirabelles = enAttente.filter((e) => e.arbre === "Mirabelle 2").map((e) => parId.get(e.id)!).filter(Boolean)
  if (mirabelles.length) {
    const kg = mirabelles.reduce((s, l) => s + l.quantite, 0)
    const date = jour(anneeDerniere(8, 28), 8, 28)
    const lot = await creerLotTransforme(ctx.userId, {
      produit: "Confiture de mirabelle, pot 250 g", quantite: Math.floor(kg * 2.6), unite: "pot", date: iso(date), datePeremption: iso(plusJours(date, 730)),
      prixUnitaire: 5.5, tauxTVA: 5.5, cleIdempotence: `seed-confiture-${randomUUID()}`, notes: "60 % de fruits, sucre de canne bio.",
      sources: mirabelles.map((l) => ({ fruitId: l.id, quantite: l.quantite })),
    })
    crees.push(lot.id)
  }
  delete ctx.partage.vergerEnAttente
  return crees
}

/** Bois d'élagage des noyers (taille de formation de l'hiver), en stock. */
async function seedBois(ctx: Contexte, ids: Map<string, number>) {
  const annee = anneeDerniere(2, 15)
  const date = jour(annee, 2, 15)
  if (!passe(date)) return
  await prisma.$transaction(async (tx) => {
    const numLot = await prochainNumeroLotVerger(tx, ctx.userId, { date, parcelleNom: "Verger", espece: "Noyer" })
    await tx.productionBois.create({
      data: {
        userId: ctx.userId, arbreId: ids.get("Noyer 1")!, parcelleId: ctx.parcelles.V, date, type: "elagage", volumeStere: 1.5, volumeM3: 1.05, poidsKg: 650,
        statut: "en_stock", destination: "chauffage", qualiteBois: "Bois de chauffage", numLot,
        notes: "Élagage de formation des deux noyers, fendu et rangé sous le hangar (sec en deux ans).",
      },
    })
  })
}
