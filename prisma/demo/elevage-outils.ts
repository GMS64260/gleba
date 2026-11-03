/**
 * Écritures d'élevage du jeu démo : chaque fonction reproduit, avec les
 * fonctions de l'application, ce qu'écrit la route d'API correspondante
 * (mêmes tables, mêmes miroirs comptables, mêmes contrôles de stock), mais
 * avec une date historique explicite.
 */

import { randomUUID } from "node:crypto"
import {
  createDepenseFromAchatAnimal,
  createDepenseFromLotAnimaux,
  createDepenseFromSoinAnimal,
  createVenteFromAbattage,
  createVenteFromVenteProduit,
} from "../../src/lib/auto-compta"
import { verrouillerReglements } from "../../src/lib/comptabilite/verrou-reglements"
import { enregistrerChangementLot } from "../../src/lib/elevage/animal-lot"
import { ciblesAffectees, resyncEcartementLait } from "../../src/lib/elevage/attente-lait"
import { verifierAttenteViande } from "../../src/lib/elevage/attente-viande"
import { sortieCaveDepuisVente } from "../../src/lib/elevage/cave-fromage"
import { estEspeceSansDelaiLait } from "../../src/lib/elevage/cibles-collecte-lait"
import { resoudreDelaisVeterinaires } from "../../src/lib/elevage/delais-veterinaires"
import { calendrierInjections } from "../../src/lib/elevage/injections"
import { estVenteProduitRuche, tauxTvaVenteProduitParDefaut } from "../../src/lib/elevage/produits-ruche"
import { recalerEtatLotFromage, verrouillerEtVerifierStockFromage } from "../../src/lib/elevage/stock-fromage"
import { synchroniserStockOeufsVente } from "../../src/lib/elevage/stock-oeufs-vente"
import { synchroniserStockRucheVente } from "../../src/lib/elevage/stock-ruche"
import { MOTIF_AFFECTATION_INITIALE } from "../../src/lib/elevage/traces-animal"
import { MOTIF_MISE_EN_PLACE_LOT } from "../../src/lib/elevage/traces-lot"
import { prisma, type Contexte } from "./contexte"

const JOUR = 86_400_000
export const aHeure = (d: Date, h: number, m = 0) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m))
export const jourIso = (d: Date) => d.toISOString().slice(0, 10)
/** Jour ISO 1 (lundi) … 7 (dimanche). */
export const isoDow = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1
export const ajouterJours = (d: Date, n: number) => new Date(d.getTime() + n * JOUR)

// ─── Lots et fiches ──────────────────────────────────────────────────────────

export async function creerLot(ctx: Contexte, d: {
  especeAnimaleId: string; nom: string; dateArrivee: Date; quantiteInitiale: number
  provenance: string | null; prixAchatTotal?: number | null; notes?: string | null; parcelleGeoId?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, ctx.userId)
    const created = await tx.lotAnimaux.create({
      data: {
        userId: ctx.userId, especeAnimaleId: d.especeAnimaleId, nom: d.nom, dateArrivee: d.dateArrivee,
        quantiteInitiale: d.quantiteInitiale, quantiteActuelle: d.quantiteInitiale, provenance: d.provenance,
        prixAchatTotal: d.prixAchatTotal ?? null, statut: "actif", notes: d.notes ?? null, parcelleGeoId: d.parcelleGeoId ?? null,
      },
    })
    if (created.parcelleGeoId) {
      await tx.mouvementCheptel.create({
        data: { userId: ctx.userId, lotId: created.id, parcelleAvantId: null, parcelleApresId: created.parcelleGeoId, date: created.dateArrivee!, motif: MOTIF_MISE_EN_PLACE_LOT },
      })
    }
    await createDepenseFromLotAnimaux(ctx.userId, created, tx)
    return created
  })
}

export type DonneesAnimal = {
  especeAnimaleId: string; nom: string; identifiant: string | null; typeIdentifiant: string | null
  race?: string | null; raceAnimaleId?: string | null; orientationProduction?: string | null
  sexe: "male" | "femelle"; dateNaissance: Date; dateArrivee: Date; provenance: string | null
  nExploitationOrigine?: string | null; prixAchat?: number | null; lotId?: number | null
  parcelleGeoId?: string | null; mereId?: number | null; pereId?: number | null
  pereIdentifiant?: string | null; mereIdentifiant?: string | null; lactationLongue?: boolean
  couleur?: string | null; notes?: string | null
}

/** POST /api/elevage/animaux : fiche, historique de lot, mouvement initial, miroir d'achat. */
export async function creerAnimal(ctx: Contexte, d: DonneesAnimal) {
  return prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, ctx.userId)
    const created = await tx.animal.create({
      data: {
        userId: ctx.userId, especeAnimaleId: d.especeAnimaleId, lotId: d.lotId ?? null, identifiant: d.identifiant,
        typeIdentifiant: d.typeIdentifiant, nom: d.nom, race: d.race ?? null, raceAnimaleId: d.raceAnimaleId ?? null,
        orientationProduction: d.orientationProduction ?? null, sexe: d.sexe, dateNaissance: d.dateNaissance,
        dateArrivee: d.dateArrivee, provenance: d.provenance, nExploitationOrigine: d.nExploitationOrigine ?? null,
        prixAchat: d.prixAchat ?? null, prixAchatInclusDansLot: false, statut: "actif",
        mereId: d.mereId ?? null, pereId: d.pereId ?? null, pereIdentifiant: d.pereIdentifiant ?? null,
        mereIdentifiant: d.mereIdentifiant ?? null, lactationLongue: d.lactationLongue ?? false,
        couleur: d.couleur ?? null, notes: d.notes ?? null, parcelleGeoId: d.parcelleGeoId ?? null,
      },
    })
    await enregistrerChangementLot(tx, ctx.userId, created.id, null, created.lotId, created.dateArrivee!, "Affectation à la création de l’animal")
    if (created.parcelleGeoId) {
      await tx.mouvementCheptel.create({
        data: { userId: ctx.userId, animalId: created.id, parcelleAvantId: null, parcelleApresId: created.parcelleGeoId, date: created.dateArrivee!, motif: MOTIF_AFFECTATION_INITIALE },
      })
    }
    await createDepenseFromAchatAnimal(ctx.userId, {
      id: created.id, nom: created.nom, identifiant: created.identifiant, prixAchat: created.prixAchat,
      dateArrivee: created.dateArrivee, prixAchatInclusDansLot: created.prixAchatInclusDansLot,
    }, tx)
    return created
  })
}

/** Composition de lot à une date historique (même écriture que `composerLot`). */
export async function rattacherAuLot(ctx: Contexte, animalId: number, ancienLotId: number | null, lotId: number, date: Date) {
  await prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, ctx.userId)
    await tx.animal.update({ where: { id: animalId }, data: { lotId } })
    await enregistrerChangementLot(tx, ctx.userId, animalId, ancienLotId, lotId, date, "Composition du lot")
  })
}

/** POST /api/elevage/mouvements-cheptel. */
export async function deplacer(ctx: Contexte, d: { lotId?: number; animalId?: number; avant: string | null; apres: string | null; date: Date; motif: string; notes?: string }) {
  await prisma.$transaction(async (tx) => {
    await tx.mouvementCheptel.create({
      data: { userId: ctx.userId, lotId: d.lotId ?? null, animalId: d.animalId ?? null, parcelleAvantId: d.avant, parcelleApresId: d.apres, date: d.date, motif: d.motif, notes: d.notes ?? null },
    })
    if (d.lotId) await tx.lotAnimaux.updateMany({ where: { id: d.lotId, userId: ctx.userId }, data: { parcelleGeoId: d.apres } })
    if (d.animalId) await tx.animal.updateMany({ where: { id: d.animalId, userId: ctx.userId }, data: { parcelleGeoId: d.apres } })
  })
}

// ─── Ventes (POST /api/elevage/ventes) ───────────────────────────────────────

export type Vente = {
  date: Date; type: string; description: string; quantite: number; unite: string; prixUnitaire: number
  client?: string | null; modeReglement?: "Espèces" | "Chèque" | "Virement" | "CB" | null
  lotFromageId?: string | null; animalId?: number | null; notes?: string | null
}

export async function enregistrerVente(ctx: Contexte, v: Vente) {
  const userId = ctx.userId
  const prixTotal = v.quantite * v.prixUnitaire
  const tauxTVA = tauxTvaVenteProduitParDefaut(v.type)
  let fromageSortie: { lotFromageId: string; nbPieces: number; poidsKg: number } | null = null
  if (v.type === "fromage") {
    const sortie = sortieCaveDepuisVente(v.quantite, v.unite)
    if (!sortie.ok || !v.lotFromageId) throw new Error(`Vente de fromage invalide : ${!sortie.ok ? sortie.message : "lot manquant"}`)
    fromageSortie = { lotFromageId: v.lotFromageId, nbPieces: sortie.nbPieces, poidsKg: sortie.poidsKg }
  }
  return prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, userId)
    if (fromageSortie) await verrouillerEtVerifierStockFromage(tx, userId, fromageSortie.lotFromageId, fromageSortie.nbPieces, fromageSortie.poidsKg)
    if (v.type === "animal_vivant") {
      const a = await tx.animal.findFirst({ where: { id: v.animalId!, userId } })
      if (!a || a.statut !== "actif") throw new Error(`Animal ${v.animalId} indisponible à la vente`)
    }
    const vente = await tx.venteProduit.create({
      data: {
        userId, date: v.date, type: v.type, description: v.description, quantite: v.quantite, unite: v.unite,
        prixUnitaire: v.prixUnitaire, prixTotal, client: v.client ?? null, paye: true, tauxTVA, notes: v.notes ?? null,
        animalId: v.type === "animal_vivant" ? v.animalId ?? null : null,
        lotFromageId: fromageSortie ? fromageSortie.lotFromageId : null,
      },
    })
    if (v.type === "oeufs") {
      await synchroniserStockOeufsVente(tx, { userId, venteId: vente.id, date: vente.date, quantite: vente.quantite, unite: vente.unite })
    }
    if (estVenteProduitRuche(v.type)) {
      await synchroniserStockRucheVente(tx, { userId, venteId: vente.id, type: vente.type, date: vente.date, quantite: vente.quantite, unite: vente.unite })
    }
    if (v.type === "animal_vivant" && v.animalId) {
      await tx.animal.update({ where: { id: v.animalId }, data: { statut: "vendu", dateSortie: v.date, causeSortie: "Vente" } })
    }
    if (fromageSortie) {
      await tx.mouvementFromage.create({
        data: {
          userId, lotFromageId: fromageSortie.lotFromageId, date: v.date, type: "sortie_vente",
          nbPieces: fromageSortie.nbPieces, poidsKg: fromageSortie.poidsKg, venteProduitId: vente.id,
          notes: v.client ? `Vente ${v.client}` : null,
        },
      })
      await recalerEtatLotFromage(tx, userId, fromageSortie.lotFromageId, "sortie")
    }
    await createVenteFromVenteProduit(userId, {
      id: vente.id, type: vente.type, description: vente.description, prixTotal: vente.prixTotal, quantite: vente.quantite,
      unite: vente.unite, prixUnitaire: vente.prixUnitaire, client: vente.client, date: vente.date, tauxTVA: vente.tauxTVA,
      paye: vente.paye, modeReglement: v.modeReglement ?? undefined,
    }, tx)
    return vente
  }, { timeout: 30_000 })
}

// ─── Soins (POST /api/elevage/soins, soin administré) ────────────────────────

const TYPES_MEDICAMENTEUX = new Set(["Vaccination", "Vermifuge", "Traitement vétérinaire"])

export type Soin = {
  animalId?: number | null; lotId?: number | null; date: Date; type: string; produitId?: string | null
  produit?: string | null; stockMedicamentId?: string | null; quantite?: number | null; unite?: string | null
  dose: string; voie: string; motif?: string | null; ordonnanceUrl?: string | null; cout?: number | null
  veterinaire?: string | null; notes?: string | null
}

export async function enregistrerSoin(ctx: Contexte, d: Soin) {
  const userId = ctx.userId
  const cible = d.animalId
    ? (await prisma.animal.findFirst({ where: { id: d.animalId, userId }, select: { especeAnimale: { select: { id: true, nom: true, categorieReglementaire: true, type: true, production: true, productions: true } } } }))?.especeAnimale
    : (await prisma.lotAnimaux.findFirst({ where: { id: d.lotId!, userId }, select: { especeAnimale: { select: { id: true, nom: true, categorieReglementaire: true, type: true, production: true, productions: true } } } }))?.especeAnimale
  if (!cible) throw new Error("Cible de soin introuvable")
  let tempsLait = 0, tempsViande = 0, tempsOeufs = 0
  let nomProduit = d.produit ?? null
  let source: string | null = d.produitId ? "referentiel_produit" : "saisie_libre"
  if (d.produitId) {
    const p = await prisma.produitVeterinaire.findUnique({ where: { id: d.produitId }, include: { delaisParEspece: { where: { especeAnimaleId: cible.id } } } })
    if (!p) throw new Error(`Produit ${d.produitId} introuvable`)
    const r = resoudreDelaisVeterinaires(p, cible)
    tempsLait = r.tempsAttenteLaitJ; tempsViande = r.tempsAttenteViandeJ; tempsOeufs = r.tempsAttenteOeufsJ; source = r.source
    if (!nomProduit) nomProduit = p.nom
  }
  if (TYPES_MEDICAMENTEUX.has(d.type) && d.produitId && !d.stockMedicamentId) throw new Error("LOT_PHARMACIE_REQUIS")
  const stock = d.stockMedicamentId ? await prisma.stockMedicamentElevage.findFirst({ where: { id: d.stockMedicamentId, userId } }) : null
  if (stock?.datePeremption && stock.datePeremption.getTime() < d.date.getTime()) throw new Error(`Lot ${stock.numeroLot} périmé`)
  if (tempsLait > 0 && estEspeceSansDelaiLait(cible)) { if (tempsOeufs === 0) tempsOeufs = tempsLait; tempsLait = 0 }
  const plus = (n: number) => ajouterJours(d.date, n)
  const finLait = tempsLait > 0 ? plus(tempsLait) : null
  const finViande = tempsViande > 0 ? plus(tempsViande) : null
  const finOeufs = tempsOeufs > 0 ? plus(tempsOeufs) : null
  return prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, userId)
    const preleve = stock ? d.quantite ?? 0 : 0
    if (preleve > 0) {
      const dec = await tx.stockMedicamentElevage.updateMany({ where: { id: stock!.id, userId, quantite: { gte: preleve } }, data: { quantite: { decrement: preleve } } })
      if (dec.count !== 1) throw new Error(`STOCK_MEDICAMENT_INSUFFISANT ${stock!.numeroLot}`)
    }
    const soin = await tx.soinAnimal.create({
      data: {
        userId, animalId: d.animalId ?? null, lotId: d.lotId ?? null, date: d.date, type: d.type, produit: nomProduit,
        produitId: d.produitId ?? null, stockMedicamentId: stock?.id ?? null, numeroLotMedicament: stock?.numeroLot ?? null,
        peremptionMedicament: stock?.datePeremption ?? null, quantitePreleveeStock: preleve, dose: d.dose, voie: d.voie,
        motif: d.motif ?? null, ordonnanceUrl: d.ordonnanceUrl || stock?.ordonnanceUrl || null, quantite: d.quantite ?? null,
        unite: d.unite ?? null, cout: d.cout ?? null, veterinaire: d.veterinaire ?? null, datePrevue: null, fait: true,
        notes: d.notes ?? null, nbInjections: 1, intervalleInjectionsHeures: null,
        tempsAttenteLaitJ: tempsLait > 0 ? tempsLait : null, tempsAttenteViandeJ: tempsViande > 0 ? tempsViande : null,
        tempsAttenteOeufsJ: tempsOeufs > 0 ? tempsOeufs : null, delaiAttenteSource: source,
        finAttenteLait: finLait, finAttenteViande: finViande, finAttenteOeufs: finOeufs,
      },
    })
    for (const inj of calendrierInjections(d.date, 1, null, true)) {
      await tx.injectionSoin.create({ data: { id: randomUUID(), userId, soinId: soin.id, numero: inj.numero, datePrevue: inj.datePrevue, dateRealisee: inj.dateRealisee ?? null, statut: inj.statut } })
    }
    let ecartees = 0
    if (finLait) {
      const cibles = await ciblesAffectees(tx, userId, d.animalId ?? null, d.lotId ?? null)
      ecartees = await resyncEcartementLait(tx, userId, cibles, d.date, finLait)
    }
    await createDepenseFromSoinAnimal(userId, { id: soin.id, type: soin.type, cout: soin.cout, date: soin.date, fait: true }, tx)
    return { soin, ecartees }
  }, { timeout: 30_000 })
}

// ─── Abattages (POST /api/elevage/abattages) ─────────────────────────────────

export async function enregistrerAbattage(ctx: Contexte, a: {
  animalId?: number | null; lotId?: number | null; date: Date; quantite: number; poidsVif?: number; poidsCarcasse?: number
  destination: "vente" | "auto_consommation" | "don"; prixVente?: number | null; lieu: string; nEtablissementDestination?: string | null; notes?: string
}) {
  const userId = ctx.userId
  return prisma.$transaction(async (tx) => {
    await verrouillerReglements(tx, userId)
    await verifierAttenteViande(tx, userId, { animalId: a.animalId ?? null, lotId: a.lotId ?? null, date: a.date })
    const ab = await tx.abattage.create({
      data: {
        userId, animalId: a.animalId ?? null, lotId: a.lotId ?? null, date: a.date, quantite: a.quantite, poidsVif: a.poidsVif ?? null,
        poidsCarcasse: a.poidsCarcasse ?? null, destination: a.destination, prixVente: a.prixVente ?? null, lieu: a.lieu,
        nEtablissementDestination: a.nEtablissementDestination ?? null, notes: a.notes ?? null,
      },
      include: { animal: true, lot: true },
    })
    if (a.animalId) {
      await tx.animal.update({ where: { id: a.animalId }, data: { statut: "abattu", dateSortie: a.date, causeSortie: "Abattage", ...(a.nEtablissementDestination ? { nExploitationDestination: a.nEtablissementDestination } : {}) } })
    }
    if (a.lotId && a.quantite) {
      const lot = await tx.lotAnimaux.findFirst({ where: { id: a.lotId, userId } })
      if (lot) {
        const q = Math.max(0, lot.quantiteActuelle - a.quantite)
        await tx.lotAnimaux.update({ where: { id: lot.id }, data: { quantiteActuelle: q, statut: q === 0 ? "termine" : "actif" } })
      }
    }
    await createVenteFromAbattage(userId, {
      id: ab.id, prixVente: ab.prixVente, date: ab.date, destination: ab.destination, quantite: ab.quantite, poidsCarcasse: ab.poidsCarcasse,
      animal: ab.animal ? { nom: ab.animal.nom } : null, lot: ab.lot ? { nom: ab.lot.nom } : null,
    }, tx)
    return ab
  }, { timeout: 30_000 })
}

// ─── Naissances (POST /api/elevage/naissances + création des fiches) ─────────

export type Petit = { sexe: "male" | "femelle"; boucleDefinitive: string | null; modeElevage: "sous_mere" | "biberon"; poids: number; vivant: boolean }

export async function enregistrerNaissance(ctx: Contexte, n: {
  mereId?: number | null; lotId?: number | null; pereIdentifiant: string | null; date: Date; nombreNes: number; nombreVivants: number
  nombreMales: number; nombreFemelles: number; poidsTotal?: number | null; notes?: string | null; saillieId?: string | null
  identifiantsDefinitifs?: string | null; petits?: Petit[]
}) {
  const userId = ctx.userId
  return prisma.$transaction(async (tx) => {
    const created = await tx.naissanceAnimale.create({
      data: {
        userId, mereId: n.mereId ?? null, lotId: n.lotId ?? null, pereIdentifiant: n.pereIdentifiant, identifiantsDefinitifs: n.identifiantsDefinitifs ?? null,
        date: n.date, nombreNes: n.nombreNes, nombreVivants: n.nombreVivants, nombreMales: n.nombreMales, nombreFemelles: n.nombreFemelles,
        poidsTotal: n.poidsTotal ?? null, notes: n.notes ?? null, saillieId: n.saillieId ?? null,
      },
    })
    if (n.saillieId) await tx.saillie.update({ where: { id: n.saillieId }, data: { statut: "Mise-bas réalisée" } })
    if (n.nombreVivants > 0 && n.lotId) await tx.lotAnimaux.update({ where: { id: n.lotId }, data: { quantiteActuelle: { increment: n.nombreVivants } } })
    if (n.petits?.length) {
      await tx.petitNaissance.createMany({
        data: n.petits.map((p, i) => ({ userId, naissanceId: created.id, numero: i + 1, sexe: p.sexe, boucleDefinitive: p.boucleDefinitive, modeElevage: p.modeElevage, poids: p.poids, vivant: p.vivant })),
      })
    }
    return created
  })
}

/** POST /api/elevage/naissances/[id]/fiches : une fiche par petit vivant. */
export async function creerFichesPetits(ctx: Contexte, naissanceId: number) {
  const userId = ctx.userId
  return prisma.$transaction(async (tx) => {
    const naissance = await tx.naissanceAnimale.findFirst({
      where: { id: naissanceId, userId },
      include: { mere: { select: { id: true, especeAnimaleId: true, race: true, raceAnimaleId: true, orientationProduction: true } }, petits: { orderBy: { numero: "asc" } } },
    })
    if (!naissance?.mere) throw new Error("Naissance sans mère")
    const ids: Array<{ id: number; sexe: string | null; numero: number }> = []
    for (const p of naissance.petits.filter((x) => x.vivant && x.animalId == null)) {
      const animal = await tx.animal.create({
        data: {
          userId, especeAnimaleId: naissance.mere.especeAnimaleId, lotId: null, identifiant: p.boucleDefinitive || p.boucleProvisoire || null,
          typeIdentifiant: null, sexe: p.sexe, dateNaissance: naissance.date, dateArrivee: naissance.date, mereId: naissance.mereId,
          pereIdentifiant: naissance.pereIdentifiant, race: naissance.mere.race, raceAnimaleId: naissance.mere.raceAnimaleId,
          orientationProduction: naissance.mere.orientationProduction, poidsActuel: p.poids, statut: "actif", provenance: "Naissance",
          notes: p.modeElevage === "biberon" ? "Élevé au biberon" : "Élevé sous la mère",
        },
        select: { id: true },
      })
      await tx.petitNaissance.update({ where: { id: p.id }, data: { animalId: animal.id } })
      ids.push({ id: animal.id, sexe: p.sexe, numero: p.numero })
    }
    return ids
  })
}
