/**
 * Élevage de la ferme démo : chèvres alpines laitières (cœur de la vitrine)
 * et fromagerie, brebis Solognotes, cochons Gascons, poules Marans, rucher.
 *
 * Calendrier réel : mises-bas vers le 14/02 (lutte naturelle d'automne) et
 * vers le 12/09 (désaisonnement + IA), agnelage de printemps, miellées fin
 * mai et fin juillet. L'historique détaillé (traite, fromagerie, ponte,
 * ventes) court du 1er janvier de l'an passé à aujourd'hui ; l'état découle
 * du jour du reseed. Toutes les écritures passent par `elevage-outils.ts`,
 * qui rejoue les routes de l'application avec ses propres fonctions.
 *
 * Garde-fous du jour du reseed : aucune fenêtre de mise-bas en cours, aucune
 * mise-bas sous 3 jours, aucun tarissement du jour, aucune saillie « En
 * attente » depuis 35 jours, aucun délai d'attente en cours, aucun stock
 * d'aliment au seuil ni médicament proche de péremption.
 */

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { createDepenseFromConsommationAliment } from "../../src/lib/auto-compta"
import { arrondirKg } from "../../src/lib/elevage/cave-fromage"
import { chargerDeclarationsReglementaires } from "../../src/lib/elevage/declarations-reglementaires.server"
import { enregistrerSuiviDeclaration } from "../../src/lib/elevage/suivi-declarations.server"
import { journaliserEvenementReglementaire } from "../../src/lib/elevage/audit-reglementaire"
import { empreinteDeclaration } from "../../src/lib/elevage/declarations-reglementaires"
import { estVenteEnLitres, jourParis, verifierDisponibiliteLait } from "../../src/lib/elevage/bilan-lait"
import { prochainNumeroLot } from "../../src/lib/lait"
import { TAUX_PONTE_PAR_MOIS } from "../../src/lib/elevage/taux-ponte"
import { alea, AUJ, graine, IDENTITE, jour, journal, NOW, plusJours, prisma, round2, Y, type Contexte } from "./contexte"
import { idAliment } from "./identite"
import {
  aHeure, ajouterJours, creerAnimal, creerFichesPetits, creerLot, deplacer, enregistrerAbattage, enregistrerNaissance,
  enregistrerSoin, enregistrerVente, isoDow, jourIso, rattacherAuLot, type Petit,
} from "./elevage-outils"

const JOUR = 86_400_000
const W0 = jour(Y - 1, 1, 1, 0) // début de l'historique détaillé
const HIER = plusJours(AUJ, -1)
const avant = (d: Date) => d.getTime() < NOW.getTime()
const jours = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / JOUR)
const r = alea(graine("elevage-bois-joli"))
const entre = (a: number, b: number) => a + (b - a) * r()
const bruit = (amp: number) => 1 + amp * (r() * 2 - 1)
const minuitUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

const AGREMENT = "FR 85.999.001 CE"
const ABATTOIR = { nom: "Abattoir du Bocage (fictif)", numero: "FR 85.999.050 CE" }
const NEGOCIANT = { nom: "Négoce Chevreaux du Bocage", ede: "85999120" }
const VETO = "Dr Claire Morin — Clinique vétérinaire du Bocage"
const ORDO = (ref: string) => `https://ferme-bois-joli.example/registre/ordonnances/${ref}.pdf`
const IPG = (n: number) => `FR85999${String(n).padStart(6, "0")}` // FR + 11 chiffres

// ════════════════════════════════════════════════════════════════════════════
//  Calendrier de reproduction caprin
// ════════════════════════════════════════════════════════════════════════════

type Groupe = "F" | "S"
type Chevre = {
  cle: string; nom: string; naissance: Date; groupe: Groupe | "LL"; pic: number
  cellules: number; mg: number; mp: number; id?: number
  premiereSaison: number // année de la 1re mise-bas (saison de son groupe)
}

const CHEVRES: Chevre[] = [
  { cle: "bergere", nom: "Bergère", naissance: jour(Y - 6, 2, 18), groupe: "F", pic: 3.6, cellules: 640, mg: 37.5, mp: 32.6, premiereSaison: Y - 5 },
  { cle: "clochette", nom: "Clochette", naissance: jour(Y - 6, 2, 11), groupe: "F", pic: 3.4, cellules: 520, mg: 36.8, mp: 32.1, premiereSaison: Y - 5 },
  { cle: "chataigne", nom: "Châtaigne", naissance: jour(Y - 5, 2, 16), groupe: "F", pic: 3.8, cellules: 380, mg: 38.2, mp: 33.0, premiereSaison: Y - 4 },
  { cle: "reglisse", nom: "Réglisse", naissance: jour(Y - 4, 2, 9), groupe: "F", pic: 3.5, cellules: 310, mg: 36.1, mp: 31.8, premiereSaison: Y - 3 },
  { cle: "caline", nom: "Câline", naissance: jour(Y - 4, 2, 20), groupe: "F", pic: 3.3, cellules: 450, mg: 37.0, mp: 32.4, premiereSaison: Y - 3 },
  { cle: "dragee", nom: "Dragée", naissance: jour(Y - 3, 2, 13), groupe: "F", pic: 3.2, cellules: 280, mg: 35.9, mp: 31.5, premiereSaison: Y - 2 },
  { cle: "praline", nom: "Praline", naissance: jour(Y - 2, 2, 15), groupe: "F", pic: 3.0, cellules: 240, mg: 36.4, mp: 31.9, premiereSaison: Y - 1 },
  { cle: "mirabelle", nom: "Mirabelle", naissance: jour(Y - 6, 3, 2), groupe: "S", pic: 3.4, cellules: 590, mg: 38.0, mp: 33.1, premiereSaison: Y - 5 },
  { cle: "cannelle", nom: "Cannelle", naissance: jour(Y - 5, 2, 25), groupe: "S", pic: 3.6, cellules: 420, mg: 37.2, mp: 32.5, premiereSaison: Y - 4 },
  { cle: "paquerette", nom: "Pâquerette", naissance: jour(Y - 5, 3, 5), groupe: "S", pic: 3.5, cellules: 360, mg: 36.6, mp: 32.2, premiereSaison: Y - 4 },
  { cle: "biscotte", nom: "Biscotte", naissance: jour(Y - 4, 2, 22), groupe: "S", pic: 3.3, cellules: 300, mg: 37.8, mp: 32.8, premiereSaison: Y - 3 },
  { cle: "melisse", nom: "Mélisse", naissance: jour(Y - 3, 3, 1), groupe: "S", pic: 3.1, cellules: 330, mg: 36.9, mp: 32.0, premiereSaison: Y - 2 },
  { cle: "vanille", nom: "Vanille", naissance: jour(Y - 5, 2, 26), groupe: "LL", pic: 2.5, cellules: 470, mg: 38.6, mp: 33.4, premiereSaison: Y - 4 },
]

type Saison = { cle: string; groupe: Groupe; annee: number; centre: Date; ia: boolean; saillies: Map<string, Date> }

/** Saisons de mise-bas autour de l'historique ; la saison qui chevauche AUJ est calée hors de « aujourd'hui ». */
function construireSaisons(): Saison[] {
  const saisons: Saison[] = []
  for (let a = Y - 6; a <= Y + 1; a++) {
    for (const g of ["F", "S"] as Groupe[]) {
      const centre = g === "F" ? jour(a, 2, 14, 8) : jour(a, 9, 12, 8)
      const s: Saison = { cle: `${g}${a}`, groupe: g, annee: a, centre, ia: g === "S", saillies: new Map() }
      const rs = alea(graine(`saison-${g}-${a}`))
      const membres = CHEVRES.filter((c) => c.groupe === g && a >= c.premiereSaison)
      for (const c of membres) {
        const decalage = g === "F" ? Math.round(rs() * 16 - 8) : Math.round(rs() * 2) // IA sur deux jours
        s.saillies.set(c.cle, plusJours(centre, -150 + decalage))
      }
      saisons.push(s)
    }
  }
  // Calage de la saison dont la fenêtre de mise-bas touche aujourd'hui.
  for (const s of saisons) {
    const mbs = [...s.saillies.values()].map((d) => plusJours(d, 150))
    if (!mbs.length) continue
    const debut = Math.min(...mbs.map((d) => d.getTime())), fin = Math.max(...mbs.map((d) => d.getTime()))
    const t = AUJ.getTime()
    if (t >= debut - 3 * JOUR && t <= fin + JOUR) {
      const dejaFaite = t - debut >= (fin - debut) / 2
      const delta = dejaFaite ? Math.floor((AUJ.getTime() - 2 * JOUR - fin) / JOUR) : Math.ceil((AUJ.getTime() + 5 * JOUR - debut) / JOUR)
      for (const [k, d] of s.saillies) s.saillies.set(k, plusJours(d, delta))
    }
  }
  // Tarissement prévu (mise-bas − 60 j) jamais dans les 3 derniers jours pour une gestation en cours.
  for (const s of saisons) {
    for (const [k, d] of s.saillies) {
      const mb = plusJours(d, 150)
      if (mb.getTime() <= AUJ.getTime()) continue
      const tar = plusJours(mb, -60)
      if (tar.getTime() >= AUJ.getTime() - 4 * JOUR && tar.getTime() <= AUJ.getTime() + JOUR) s.saillies.set(k, plusJours(d, 6))
    }
  }
  return saisons
}

/** Lait du jour d'une chèvre (L), selon le stade de lactation. */
function laitJour(c: Chevre, dim: number, primipare: boolean, jourAn: number): number {
  const saison = 1 + 0.06 * Math.cos((2 * Math.PI * (jourAn - 120)) / 365)
  if (c.groupe === "LL") return c.pic * saison * Math.exp(-(dim - 110) / 2600)
  if (dim < 4) return 0
  const pic = c.pic * (primipare ? 0.82 : 1)
  const courbe = dim < 40 ? pic * (0.62 + (0.38 * (dim - 4)) / 36) : pic * Math.exp(-(dim - 40) * 0.0029)
  return courbe * saison
}

// ════════════════════════════════════════════════════════════════════════════

export async function seedElevage(ctx: Contexte): Promise<void> {
  const debut = Date.now()
  const P = ctx.parcelles.P, F = ctx.parcelles.F, V = ctx.parcelles.V
  const ede = IDENTITE.numeroEde
  const raceAlpine = await prisma.raceAnimale.findFirst({ where: { especeAnimaleId: "chevre_alpine", nom: "Alpine", userId: null }, select: { id: true } })
  const raceSolognote = await prisma.raceAnimale.findFirst({ where: { especeAnimaleId: "brebis_solognote", nom: "Solognote", userId: null }, select: { id: true } })
  const raceGascon = await prisma.raceAnimale.findFirst({ where: { especeAnimaleId: "cochon_gascon", nom: "Gascon", userId: null }, select: { id: true } })

  // ── Pharmacie (un lot par produit, péremption lointaine) ──────────────────
  const pharmacie = new Map<string, string>()
  const lotsPharma: Array<[string, string, number, string, string]> = [
    ["veto_16", "BRX-2417", 100, "mL", "Coopérative vétérinaire du Bocage (fictive)"],
    ["veto_19", "CXV-0938", 100, "mL", "Clinique vétérinaire du Bocage"],
    ["veto_01", "EPX-5521", 1000, "mL", "Clinique vétérinaire du Bocage"],
    ["veto_06", "PND-7710", 200, "mL", "Clinique vétérinaire du Bocage"],
    ["veto_18", "HPV-3304", 100, "mL", "Clinique vétérinaire du Bocage"],
    ["veto_02", "CYD-1186", 1000, "mL", "Clinique vétérinaire du Bocage"],
    ["veto_04", "PNC-6620", 1000, "mL", "Clinique vétérinaire du Bocage"],
  ]
  for (const [produitId, numeroLot, quantite, unite, fournisseur] of lotsPharma) {
    const row = await prisma.stockMedicamentElevage.create({
      data: {
        userId: ctx.userId, produitId, numeroLot, quantite, unite, fournisseur, datePeremption: plusJours(AUJ, 420 + Math.round(r() * 200)),
        ordonnanceUrl: ORDO(`achat-${numeroLot}`), notes: "Achat sur ordonnance du vétérinaire de suivi",
      },
    })
    pharmacie.set(produitId, row.id)
  }

  // ══ CHÈVRES ════════════════════════════════════════════════════════════════
  const lotChevres = await creerLot(ctx, {
    especeAnimaleId: "chevre_alpine", nom: "Troupeau laitier", dateArrivee: jour(Y - 6, 5, 1, 9), quantiteInitiale: 12,
    provenance: "Constitution du troupeau par achats de chevrettes (GAEC des Brandes, 79999012)", parcelleGeoId: P,
    notes: "Chèvres Alpines en lactation, conduite en deux groupes de mise-bas (février et septembre).",
  })
  const saisons = construireSaisons()
  const sParCle = new Map(saisons.map((s) => [s.cle, s]))
  const hercule = await creerAnimal(ctx, {
    especeAnimaleId: "chevre_alpine", nom: "Hercule", identifiant: "FR79999000214", typeIdentifiant: "IPG caprin", race: "Alpine",
    raceAnimaleId: raceAlpine?.id, sexe: "male", dateNaissance: jour(Y - 5, 3, 1), dateArrivee: jour(Y - 4, 6, 10, 9),
    provenance: "Élevage caprin de la Gâtine (fictif)", nExploitationOrigine: "79999014", parcelleGeoId: P,
    notes: "Bouc reproducteur, lutte naturelle d'automne.",
  })
  let ordre = 300
  for (const c of CHEVRES) {
    const nee = c.cle === "praline"
    const a = await creerAnimal(ctx, {
      especeAnimaleId: "chevre_alpine", nom: c.nom, identifiant: nee ? IPG(ordre++) : `FR79999${String(4100 + ordre++).padStart(6, "0")}`,
      typeIdentifiant: "IPG caprin", race: "Alpine", raceAnimaleId: raceAlpine?.id, orientationProduction: "lait", sexe: "femelle",
      dateNaissance: c.naissance, dateArrivee: nee ? c.naissance : plusJours(c.naissance, 95),
      provenance: nee ? "Naissance" : "GAEC des Brandes (fictif)", nExploitationOrigine: nee ? null : "79999012",
      lotId: nee ? null : lotChevres.id, lactationLongue: c.groupe === "LL", parcelleGeoId: null,
      mereIdentifiant: nee ? null : undefined, notes: c.groupe === "LL" ? "Conduite en lactation longue (non remise à la reproduction)." : null,
    })
    c.id = a.id
  }
  const parCle = new Map(CHEVRES.map((c) => [c.cle, c]))

  // Saillies, gestations, mises-bas. Lactations : [début, fin) par chèvre.
  type Lactation = { chevre: Chevre; debut: Date; fin: Date; primipare: boolean }
  const lactations: Lactation[] = []
  const campagnes = new Map<string, string>()
  const petitsAVendre: Array<{ id: number; date: Date; nom: string }> = []
  const chevrettesGardees: Array<{ id: number; naissance: Date; nom: string }> = []
  let boucle = 100
  const derniereSaisonF = saisons
    .filter((s) => s.groupe === "F" && [...s.saillies.values()].some((d) => plusJours(d, 150).getTime() <= HIER.getTime()))
    .sort((a, b) => b.annee - a.annee)[0]?.cle
  const nomsChevrettes = ["Jade", "Perle"]
  for (const s of saisons) {
    const dates = [...s.saillies.values()]
    if (!dates.length) continue
    const debutLutte = new Date(Math.min(...dates.map((d) => d.getTime())))
    const finLutte = new Date(Math.max(...dates.map((d) => d.getTime())))
    if (debutLutte.getTime() >= AUJ.getTime()) continue
    const recente = plusJours(debutLutte, 150).getTime() >= W0.getTime() - 40 * JOUR
    let campagneId: string | null = null
    if (recente) {
      const camp = await prisma.campagneReproduction.create({
        data: {
          userId: ctx.userId, especeAnimaleId: "chevre_alpine", dateDebut: minuitUTC(debutLutte), dateFin: minuitUTC(finLutte),
          nom: s.groupe === "F" ? `Lutte d'automne ${s.annee - 1} — Hercule` : `Désaisonnement ${s.annee} — IA`,
          typeConduite: s.groupe === "F" ? "Monte naturelle" : "Désaisonnement lumineux",
          objectifMiseBas: minuitUTC(s.centre),
          notes: s.groupe === "F" ? "Monte naturelle en lot, harnais marqueur, échographie à J+34." : "Traitement lumineux puis insémination artificielle sur chaleurs induites.",
        },
      })
      campagneId = camp.id
      campagnes.set(s.cle, camp.id)
    }
    let rangChevrette = 0
    for (const [cle, dateS] of s.saillies) {
      const c = parCle.get(cle)!
      if (dateS.getTime() >= AUJ.getTime()) continue
      const mb = plusJours(dateS, 150)
      const realisee = mb.getTime() <= HIER.getTime()
      const diag = plusJours(dateS, 34)
      const gestante = realisee || diag.getTime() <= HIER.getTime()
      const saillie = await prisma.saillie.create({
        data: {
          userId: ctx.userId, date: aHeure(dateS, 8), femelleId: c.id!, maleId: s.ia ? null : hercule.id, type: s.ia ? "IA" : "Monte naturelle",
          agentInseminateur: s.ia ? "Inséminateur du centre caprin (fictif)" : null, semenceLot: s.ia ? `DEMO-ALP-${s.annee}-07` : null,
          pereExterneRef: s.ia ? "Bouc Alpin améliorateur (semence)" : null, confirmationGestation: gestante ? aHeure(diag, 9) : null,
          campagneId, dateMiseBasAttendue: aHeure(mb, 8), dateTarissementPrevue: aHeure(plusJours(mb, -60), 8),
          statut: realisee ? "Mise-bas réalisée" : gestante ? "Gestante" : "En attente",
          notes: gestante && !realisee ? "Gestation confirmée à l'échographie." : null,
        },
      })
      if (!realisee) continue
      const primipare = s.annee === c.premiereSaison
      const dansFenetre = mb.getTime() >= W0.getTime() - 200 * JOUR
      // Lactation : de la mise-bas au tarissement (mise-bas suivante − 60 j).
      const suivante = sParCle.get(`${s.groupe}${s.annee + 1}`)?.saillies.get(cle)
      const finLact = c.groupe !== "LL" && suivante ? plusJours(suivante, 90) : plusJours(AUJ, 1)
      if (dansFenetre) lactations.push({ chevre: c, debut: mb, fin: finLact, primipare })
      // Naissance (petits détaillés et fiches dans l'historique récent).
      const rp = alea(graine(`portee-${cle}-${s.cle}`))
      const nb = primipare ? (rp() < 0.55 ? 1 : 2) : rp() < 0.2 ? 1 : rp() < 0.85 ? 2 : 3
      const detail = mb.getTime() >= W0.getTime() - 40 * JOUR
      const garder = s.cle === derniereSaisonF && ["reglisse", "dragee"].includes(cle)
      const petits: Petit[] = []
      for (let i = 0; i < nb; i++) {
        const sexe: "male" | "femelle" = garder && i === 0 ? "femelle" : rp() < 0.5 ? "male" : "femelle"
        petits.push({ sexe, boucleDefinitive: IPG(boucle++), modeElevage: "biberon", poids: round2(entre(3.1, 4.2)), vivant: true })
      }
      const naissance = await enregistrerNaissance(ctx, {
        mereId: c.id!, pereIdentifiant: s.ia ? "Bouc Alpin (IA)" : hercule.identifiant, date: aHeure(mb, 5), saillieId: saillie.id,
        nombreNes: nb, nombreVivants: nb, nombreMales: petits.filter((p) => p.sexe === "male").length, nombreFemelles: petits.filter((p) => p.sexe === "femelle").length,
        poidsTotal: round2(petits.reduce((t, p) => t + p.poids, 0)), notes: detail ? "Mise-bas sans assistance, chevreaux au biberon." : "Mise-bas antérieure (historique)",
        identifiantsDefinitifs: detail ? petits.map((p) => p.boucleDefinitive).join(", ") : null, petits: detail ? petits : undefined,
      })
      if (!detail) continue
      const fiches = await creerFichesPetits(ctx, naissance.id)
      for (const f of fiches) {
        await prisma.animal.update({ where: { id: f.id }, data: { typeIdentifiant: "IPG caprin" } })
        if (garder && f.numero === 1) {
          const nom = nomsChevrettes[rangChevrette++] ?? `Chevrette ${f.numero}`
          await prisma.animal.update({ where: { id: f.id }, data: { nom, notes: "Chevrette de renouvellement, élevée au biberon." } })
          chevrettesGardees.push({ id: f.id, naissance: mb, nom })
        } else {
          // Vente au négociant le jeudi suivant les 18 jours.
          let v = plusJours(mb, 18)
          while (isoDow(v) !== 4) v = plusJours(v, 1)
          petitsAVendre.push({ id: f.id, date: aHeure(v, 9), nom: `${c.nom}` })
        }
      }
    }
  }
  // Lactation en cours de Vanille (lactation longue depuis sa mise-bas de septembre Y-2).
  const vanille = parCle.get("vanille")!
  lactations.push({ chevre: vanille, debut: jour(Y - 2, 9, 12), fin: plusJours(AUJ, 1), primipare: false })
  // Composition : Praline (née sur la ferme) rejoint le troupeau à sa première mise-bas.
  const praline = parCle.get("praline")!
  const premiereLactPraline = lactations.filter((l) => l.chevre === praline).sort((a, b) => a.debut.getTime() - b.debut.getTime())[0]
  await rattacherAuLot(ctx, praline.id!, null, lotChevres.id, premiereLactPraline ? premiereLactPraline.debut : jour(Y - 1, 2, 14))
  for (const p of petitsAVendre) {
    if (!avant(p.date) || p.date.getTime() >= AUJ.getTime() - 3 * JOUR) continue
    await enregistrerVente(ctx, {
      date: p.date, type: "animal_vivant", description: `Chevreau de 3 semaines (mère ${p.nom})`, quantite: 1, unite: "tête",
      prixUnitaire: 18, client: NEGOCIANT.nom, modeReglement: "Virement", animalId: p.id,
    })
    await prisma.animal.update({ where: { id: p.id }, data: { nExploitationDestination: NEGOCIANT.ede, motifSortie: "Vente" } })
  }
  journal(`Chèvres : ${CHEVRES.length} chèvres, ${saisons.reduce((t, s) => t + s.saillies.size, 0)} saillies planifiées, ${petitsAVendre.length} chevreaux, ${chevrettesGardees.length} chevrettes gardées`)

  // ── Traite : volumes par chèvre et par jour ────────────────────────────────
  type Collecte = { jour: Date; traite: "Matin" | "Soir"; chevre: Chevre; litres: number; ecarte: boolean; reserve: boolean; lotCle?: number; mg?: number; mp?: number; cellules?: number }
  const collectes: Collecte[] = []
  const matinDuJour = NOW.getTime() >= aHeure(AUJ, 9).getTime()
  for (const l of lactations) {
    const d0 = new Date(Math.max(W0.getTime(), minuitUTC(l.debut).getTime()))
    for (let d = d0; d.getTime() < l.fin.getTime() && d.getTime() <= AUJ.getTime(); d = plusJours(d, 1)) {
      const dim = jours(minuitUTC(l.debut), d)
      const jourAn = jours(jour(d.getUTCFullYear(), 1, 1, 0), d)
      const total = laitJour(l.chevre, dim, l.primipare, jourAn) * bruit(0.035)
      if (total <= 0) continue
      const matin = round2(total * 0.56), soir = round2(total * 0.44)
      collectes.push({ jour: d, traite: "Matin", chevre: l.chevre, litres: matin, ecarte: false, reserve: false })
      if (d.getTime() < AUJ.getTime()) collectes.push({ jour: d, traite: "Soir", chevre: l.chevre, litres: soir, ecarte: false, reserve: false })
    }
  }
  const aujourdHuiSansMatin = !matinDuJour
  const collectesValides = collectes.filter((c) => !(aujourdHuiSansMatin && c.jour.getTime() === AUJ.getTime()))
  const parJour = new Map<string, Collecte[]>()
  for (const c of collectesValides) {
    const k = jourIso(c.jour)
    if (!parJour.has(k)) parJour.set(k, [])
    parJour.get(k)!.push(c)
  }

  // Contrôles mensuels (le 10) : MG, MP, cellules sur la traite du matin.
  const controles: Date[] = []
  for (let d = jour(Y - 1, 1, 10, 0); d.getTime() <= AUJ.getTime(); d = jour(d.getUTCFullYear(), d.getUTCMonth() + 2, 10, 0)) controles.push(d)
  const dernierControle = controles[controles.length - 1]
  // Chèvre en mammite : en lactation 140 j avant aujourd'hui, et encore traite au contrôle suivant.
  const ctrlMammite = controles.filter((d) => jours(d, AUJ) >= 120 && jours(d, AUJ) <= 170).pop() ?? controles[0]
  const candidates = CHEVRES.filter((c) => c.groupe !== "LL" && collectesValides.some((x) => x.chevre === c && x.jour.getTime() === ctrlMammite.getTime())
    && collectesValides.some((x) => x.chevre === c && x.jour.getTime() === plusJours(ctrlMammite, 35).getTime()))
  const mammite = candidates[0] ?? null
  // Chèvre « sous surveillance » au dernier contrôle (une seule).
  const surveillee = CHEVRES.find((c) => c !== mammite && collectesValides.some((x) => x.chevre === c && x.jour.getTime() === dernierControle.getTime()) && c.cellules >= 500)
  for (const d of controles) {
    for (const c of parJour.get(jourIso(d)) ?? []) {
      if (c.traite !== "Matin") continue
      let cell = c.chevre.cellules * bruit(0.15)
      if (c.chevre === mammite && d.getTime() === ctrlMammite.getTime()) cell = 1760
      if (c.chevre === surveillee && d.getTime() === dernierControle.getTime()) cell = 1080
      if (cell >= 950 && !(c.chevre === surveillee && d.getTime() === dernierControle.getTime()) && !(c.chevre === mammite && d.getTime() === ctrlMammite.getTime())) cell = 880
      c.cellules = Math.round(cell)
      c.mg = round2(c.chevre.mg * bruit(0.04))
      c.mp = round2(c.chevre.mp * bruit(0.03))
    }
  }
  // Lait écarté : Penidural (4 j) le lendemain du contrôle → collectes J+1 à J+5.
  const soinMammite = mammite ? aHeure(plusJours(ctrlMammite, 1), 8) : null
  if (mammite && soinMammite) {
    for (const c of collectesValides) if (c.chevre === mammite && c.jour.getTime() >= minuitUTC(soinMammite).getTime() && c.jour.getTime() <= plusJours(soinMammite, 4).getTime()) c.ecarte = true
  }
  // Lait gardé hors fromagerie (~6,5 %) : chevreaux, lait cru vendu.
  for (const [, liste] of parJour) {
    const eligibles = liste.filter((c) => !c.ecarte)
    const total = eligibles.reduce((t, c) => t + c.litres, 0)
    let garde = 0
    for (const c of [...eligibles].sort(() => r() - 0.5)) {
      if (garde >= total * 0.065) break
      c.reserve = true
      garde += c.litres
    }
  }

  // ── Fromagerie : une fabrication par jour (soir de la veille + matin) ─────
  type TypeFromage = "Crottin" | "Bûche cendrée" | "Tomme"
  const ROTATION: Record<number, TypeFromage> = { 1: "Crottin", 2: "Tomme", 3: "Crottin", 4: "Bûche cendrée", 5: "Crottin", 6: "Tomme", 7: "Bûche cendrée" }
  const FROMAGES: Record<TypeFromage, { affinage: number; echeance: number; dlc: boolean; litresParPiece: number; kgParPiece?: number; rendement?: number; prix: number; unite: string }> = {
    "Crottin": { affinage: 7, echeance: 21, dlc: true, litresParPiece: 0.5, kgParPiece: 0.075, prix: 2.2, unite: "pièce" },
    "Bûche cendrée": { affinage: 10, echeance: 28, dlc: true, litresParPiece: 1.3, kgParPiece: 0.2, prix: 5.0, unite: "pièce" },
    "Tomme": { affinage: 45, echeance: 90, dlc: false, litresParPiece: 14, rendement: 0.1, prix: 27, unite: "kg" },
  }
  type LotF = { id: string; numero: string; type: TypeFromage; date: Date; pieces: number; kg: number; restePieces: number; resteKg: number }
  const lotsF: LotF[] = []
  let pool: Collecte[] = []
  const finFab = matinDuJour ? AUJ : HIER
  for (let d = W0; d.getTime() <= finFab.getTime(); d = plusJours(d, 1)) {
    const veille = jourIso(plusJours(d, -1)), ajd = jourIso(d)
    pool.push(...(parJour.get(veille) ?? []).filter((c) => c.traite === "Soir" && !c.ecarte && !c.reserve))
    pool.push(...(parJour.get(ajd) ?? []).filter((c) => c.traite === "Matin" && !c.ecarte && !c.reserve))
    const volume = round2(pool.reduce((t, c) => t + c.litres, 0))
    if (volume < 9) continue
    let type = ROTATION[isoDow(d)]
    if (type === "Tomme" && volume < 15) type = "Crottin"
    const spec = FROMAGES[type]
    const pieces = Math.max(1, type === "Tomme" ? Math.round(volume / spec.litresParPiece) : Math.floor(volume / spec.litresParPiece))
    const kg = arrondirKg(type === "Tomme" ? volume * spec.rendement! * bruit(0.03) : pieces * spec.kgParPiece! * bruit(0.03))
    const dateFab = aHeure(d, 8, 30)
    const lot = await prisma.$transaction(async (tx) => {
      const numero = await prochainNumeroLot(tx, ctx.userId, dateFab)
      return tx.lotFromage.create({
        data: {
          userId: ctx.userId, numeroLot: numero, dateFabrication: dateFab, typeFromage: type, volumeLaitUtiliseL: volume, nbPieces: pieces,
          poidsTotalKg: kg, dluo: spec.dlc ? null : aHeure(plusJours(d, spec.echeance), 8), dlc: spec.dlc ? aHeure(plusJours(d, spec.echeance), 8) : null,
          statutBioSnapshot: "AB", traitementThermique: "cru", allergenes: "Lait de chèvre", numeroAgrement: AGREMENT,
          etat: "affinage", notes: type === "Tomme" ? "Pâte pressée non cuite, affinage 2 mois en cave." : "Caillé lactique 24 h, moulage à la louche.",
        },
      })
    })
    for (const c of pool) c.lotCle = lotsF.length
    lotsF.push({ id: lot.id, numero: lot.numeroLot, type, date: d, pieces, kg, restePieces: pieces, resteKg: kg })
    pool = []
  }
  // Écriture des collectes (createMany) avec leur fabrication.
  const lignes = collectesValides.map((c) => ({
    userId: ctx.userId, date: c.jour, traite: c.traite, animalId: c.chevre.id!, quantiteLitres: c.litres,
    mgGpl: c.mg ?? null, mpGpl: c.mp ?? null, cellulesParMl: c.cellules ?? null, ecarteAttente: false,
    lotFromageId: c.lotCle != null ? lotsF[c.lotCle].id : null,
  }))
  for (let i = 0; i < lignes.length; i += 2000) await prisma.collecteLait.createMany({ data: lignes.slice(i, i + 2000) })
  journal(`Traite : ${lignes.length} collectes, ${lotsF.length} fabrications`)

  // Mammite : soin tracé (lait écarté par l'application).
  if (mammite && soinMammite) {
    const res = await enregistrerSoin(ctx, {
      animalId: mammite.id, date: soinMammite, type: "Traitement vétérinaire", produitId: "veto_06", stockMedicamentId: pharmacie.get("veto_06"),
      quantite: 6, unite: "mL", dose: "6 mL (1 mL/10 kg PV)", voie: "IM", motif: "Mammite subclinique (1 760 000 cellules au contrôle)",
      ordonnanceUrl: ORDO(`${jourIso(soinMammite)}-penidural`), cout: 38, veterinaire: VETO, notes: "Lait écarté pendant le délai d'attente.",
    })
    journal(`Mammite de ${mammite.nom} : ${res.ecartees} collectes écartées`)
  }

  // ── Ventes de fromage (marché, AMAP, boutique) et lait cru ────────────────
  type Canal = { client: string; heure: [number, number]; mode: "CB" | "Chèque" | "Espèces"; part: Record<TypeFromage, number> }
  const CANAUX: Record<number, Canal> = {
    2: { client: "AMAP du Bocage", heure: [17, 30], mode: "Chèque", part: { "Crottin": 0.45, "Bûche cendrée": 0.35, "Tomme": 0 } },
    3: { client: "Boutique de la ferme", heure: [16, 0], mode: "Espèces", part: { "Crottin": 0.3, "Bûche cendrée": 0.35, "Tomme": 0.08 } },
    6: { client: "Marché de Montaigu", heure: [11, 30], mode: "CB", part: { "Crottin": 0.6, "Bûche cendrée": 0.55, "Tomme": 0.16 } },
  }
  const evenements: Date[] = []
  for (let d = W0; d.getTime() <= AUJ.getTime(); d = plusJours(d, 1)) {
    const c = CANAUX[isoDow(d)]
    if (c && avant(aHeure(d, c.heure[0], c.heure[1]))) evenements.push(aHeure(d, c.heure[0], c.heure[1]))
  }
  const limite = (l: LotF) => plusJours(l.date, FROMAGES[l.type].echeance - 8)
  let nbVentesFromage = 0, caFromage = 0
  for (let i = 0; i < evenements.length; i++) {
    const e = evenements[i]
    const suivant = evenements[i + 1] ?? plusJours(AUJ, 3)
    const canal = CANAUX[isoDow(e)]
    for (const type of ["Crottin", "Bûche cendrée", "Tomme"] as TypeFromage[]) {
      const spec = FROMAGES[type]
      const prets = lotsF.filter((l) => l.type === type && plusJours(l.date, spec.affinage).getTime() <= e.getTime() && (l.restePieces > 0 && l.resteKg > 1e-6))
      if (!prets.length) continue
      const reste = (l: LotF) => (type === "Tomme" ? l.resteKg : l.restePieces)
      const obligatoire = prets.filter((l) => limite(l).getTime() < suivant.getTime()).reduce((t, l) => t + reste(l), 0)
      const dispo = prets.reduce((t, l) => t + reste(l), 0)
      let cible = obligatoire + (dispo - obligatoire) * canal.part[type] * bruit(0.15)
      cible = type === "Tomme" ? Math.round(cible * 20) / 20 : Math.round(cible)
      for (const l of prets) {
        if (cible <= (type === "Tomme" ? 0.04 : 0)) break
        const q = type === "Tomme" ? arrondirKg(Math.min(l.resteKg, cible)) : Math.min(l.restePieces, cible)
        if (q <= 0) continue
        await enregistrerVente(ctx, {
          date: e, type: "fromage", description: type === "Tomme" ? "Tomme de chèvre fermière" : type === "Crottin" ? "Crottin de chèvre" : "Bûche cendrée",
          quantite: q, unite: spec.unite, prixUnitaire: spec.prix, client: canal.client, modeReglement: canal.mode, lotFromageId: l.id,
        })
        nbVentesFromage++
        caFromage += q * spec.prix
        if (type === "Tomme") { l.resteKg = arrondirKg(l.resteKg - q); if (l.resteKg <= 1e-6) l.restePieces = 0 }
        else { l.restePieces -= q; l.resteKg = arrondirKg(l.kg * (l.restePieces / l.pieces)); if (l.restePieces <= 0) l.resteKg = 0 }
        cible = type === "Tomme" ? arrondirKg(cible - q) : cible - q
      }
    }
  }
  // État de cave des lots non écoulés : prêt après affinage.
  for (const l of lotsF) {
    if (l.restePieces <= 0) continue
    if (plusJours(l.date, FROMAGES[l.type].affinage).getTime() <= AUJ.getTime()) await prisma.lotFromage.update({ where: { id: l.id }, data: { etat: "pret" } })
  }
  // Lait cru : vente du vendredi à la boutique, couverte par la traite gardée.
  let nbLaitCru = 0
  for (let d = plusJours(W0, 7); d.getTime() <= AUJ.getTime(); d = plusJours(d, 1)) {
    if (isoDow(d) !== 5 || !avant(aHeure(d, 16, 30))) continue
    let garde = 0
    for (let k = 0; k < 7; k++) for (const c of parJour.get(jourIso(plusJours(d, -k))) ?? []) if (c.reserve) garde += c.litres
    const litres = Math.floor(garde * 0.4)
    if (litres < 3) continue
    const alerte = await verifierDisponibiliteLait(prisma, ctx.userId, { ajout: [{ jour: jourParis(aHeure(d, 16, 30)), poste: "venduCru", litres }] })
    if (alerte) continue
    await enregistrerVente(ctx, { date: aHeure(d, 16, 30), type: "lait", description: "Lait cru de chèvre (bouteilles 1 L)", quantite: litres, unite: "L", prixUnitaire: 1.6, client: "Boutique de la ferme", modeReglement: "Espèces" })
    nbLaitCru++
  }
  void estVenteEnLitres
  journal(`Fromagerie : ${nbVentesFromage} ventes de fromage (${Math.round(caFromage)} €), ${nbLaitCru} ventes de lait cru`)

  // ── Soins collectifs du troupeau laitier (délais terminés avant aujourd'hui) ──
  const fini = (d: Date, delai: number) => avant(d) && plusJours(d, delai + 1).getTime() < AUJ.getTime()
  for (const a of [Y - 1, Y]) {
    const effectif = CHEVRES.length
    const soins: Array<[Date, Parameters<typeof enregistrerSoin>[1], number]> = [
      [jour(a, 3, 15, 8), { lotId: lotChevres.id, date: jour(a, 3, 15, 8), type: "Vaccination", produitId: "veto_16", stockMedicamentId: pharmacie.get("veto_16"), quantite: 2 * effectif, unite: "mL", dose: "2 mL par chèvre", voie: "SC", motif: "Rappel annuel entérotoxémie", ordonnanceUrl: ORDO(`${a}-03-bravoxin`), cout: 24, veterinaire: VETO }, 0],
      [jour(a, 8, 6, 8), { lotId: lotChevres.id, date: jour(a, 8, 6, 8), type: "Vaccination", produitId: "veto_19", stockMedicamentId: pharmacie.get("veto_19"), quantite: 2 * effectif, unite: "mL", dose: "2 mL par chèvre", voie: "SC", motif: "Rappel annuel fièvre Q avant la lutte", ordonnanceUrl: ORDO(`${a}-08-coxevac`), cout: 52, veterinaire: VETO }, 0],
      [jour(a, 10, 18, 8), { lotId: lotChevres.id, date: jour(a, 10, 18, 8), type: "Vermifuge", produitId: "veto_01", stockMedicamentId: pharmacie.get("veto_01"), quantite: 6.5 * effectif, unite: "mL", dose: "1 mL/10 kg PV", voie: "Pour-on", motif: "Coproscopie de mélange positive (strongles)", ordonnanceUrl: ORDO(`${a}-10-eprinex`), cout: 41, veterinaire: VETO }, 10],
    ]
    for (const [d, s, delai] of soins) if (fini(d, delai)) await enregistrerSoin(ctx, s)
  }

  // ══ BREBIS SOLOGNOTES ═════════════════════════════════════════════════════
  const lotBrebis = await creerLot(ctx, {
    especeAnimaleId: "brebis_solognote", nom: "Troupeau Solognote", dateArrivee: jour(Y - 3, 9, 20, 9), quantiteInitiale: 15,
    provenance: "Élevage conservatoire de Sologne (fictif), n° 49999031", parcelleGeoId: P, notes: "Brebis rustiques, agnelage de printemps, pâturage tournant.",
  })
  const hector = await creerAnimal(ctx, {
    especeAnimaleId: "brebis_solognote", nom: "Hector", identifiant: "FR49999000312", typeIdentifiant: "IPG ovin", race: "Solognote", raceAnimaleId: raceSolognote?.id,
    orientationProduction: "viande", sexe: "male", dateNaissance: jour(Y - 4, 3, 28), dateArrivee: jour(Y - 3, 9, 20, 9), provenance: "Élevage conservatoire de Sologne (fictif)",
    nExploitationOrigine: "49999031", parcelleGeoId: P,
  })
  let agneauxEnLot = 0
  for (const a of [Y - 1, Y, Y + 1]) {
    // Fenêtre d'agnelage du 22/03 au 24/04, calée hors d'aujourd'hui.
    let w0 = jour(a, 3, 22, 6), w1 = jour(a, 4, 24, 6)
    if (AUJ.getTime() >= w0.getTime() - JOUR && AUJ.getTime() <= w1.getTime() + JOUR) {
      if (jours(w0, AUJ) >= 10) w1 = plusJours(AUJ, -2)
      else { const dec = jours(w0, AUJ) + 5; w0 = plusJours(w0, dec); w1 = plusJours(w1, dec) }
    }
    const lutteDebut = plusJours(w0, -150), lutteFin = plusJours(w1, -150)
    if (!avant(lutteDebut)) continue
    await prisma.campagneReproduction.create({
      data: { userId: ctx.userId, especeAnimaleId: "brebis_solognote", nom: `Lutte d'automne ${a - 1} — bélier Hector`, typeConduite: "Monte naturelle", dateDebut: minuitUTC(lutteDebut), dateFin: minuitUTC(lutteFin), objectifMiseBas: jour(a, 4, 5, 0), notes: "Bélier dans le lot sur deux cycles." },
    })
    const ra = alea(graine(`agnelage-${a}`))
    let nes = 0
    for (let i = 0; i < 11; i++) {
      const d = aHeure(plusJours(w0, Math.round((jours(w0, w1) * i) / 10)), 5)
      if (!avant(d) || d.getTime() >= AUJ.getTime()) continue
      const n = ra() < 0.45 ? 2 : 1
      const males = n === 2 ? (ra() < 0.5 ? 1 : 2) : ra() < 0.5 ? 1 : 0
      await enregistrerNaissance(ctx, { lotId: lotBrebis.id, pereIdentifiant: hector.identifiant, date: d, nombreNes: n, nombreVivants: n, nombreMales: males, nombreFemelles: n - males, notes: "Agnelage en bergerie" })
      nes += n
    }
    agneauxEnLot += nes
    // Vaccination avant agnelage, vermifuge après sevrage, rotation sur le regain.
    const vacc = jour(a, 2, 20, 8)
    if (fini(vacc, 0) && vacc.getTime() < w0.getTime()) await enregistrerSoin(ctx, { lotId: lotBrebis.id, date: vacc, type: "Vaccination", produitId: "veto_18", stockMedicamentId: pharmacie.get("veto_18"), quantite: 30, unite: "mL", dose: "2 mL par brebis", voie: "SC", motif: "Rappel annuel avant agnelage", ordonnanceUrl: ORDO(`${a}-02-heptavac`), cout: 21, veterinaire: VETO })
    const verm = jour(a, 6, 25, 8)
    if (fini(verm, 14)) await enregistrerSoin(ctx, { lotId: lotBrebis.id, date: verm, type: "Vermifuge", produitId: "veto_02", stockMedicamentId: pharmacie.get("veto_02"), quantite: 260, unite: "mL", dose: "2,5 mL/10 kg PV", voie: "PO", motif: "Coproscopie positive au sevrage", ordonnanceUrl: ORDO(`${a}-06-cydectine`), cout: 34, veterinaire: VETO })
    const vers = jour(a, 9, 15, 9), retour = jour(a, 12, 10, 9)
    if (avant(vers)) { await deplacer(ctx, { lotId: lotBrebis.id, avant: P, apres: F, date: vers, motif: "Rotation pâturage", notes: "Pâturage du regain après fauche" }); await deplacer(ctx, { animalId: hector.id, avant: P, apres: F, date: vers, motif: "Rotation pâturage" }) }
    if (avant(retour)) { await deplacer(ctx, { lotId: lotBrebis.id, avant: F, apres: P, date: retour, motif: "Rotation pâturage", notes: "Retour près de la bergerie pour l'hiver" }); await deplacer(ctx, { animalId: hector.id, avant: F, apres: P, date: retour, motif: "Rotation pâturage" }) }
    // Agneaux vendus en caissettes (abattoir), trois agnelles gardées.
    const ventes: Array<[Date, number]> = [[jour(a, 8, 26, 7), 5], [jour(a, 9, 23, 7), 5], [jour(a, 10, 21, 7), Math.max(0, nes - 13)]]
    let vendus = 0
    for (const [d, n] of ventes) {
      if (!avant(d) || n <= 0 || nes === 0) continue
      const q = Math.min(n, nes - 3 - vendus)
      if (q <= 0) continue
      const carcasse = round2(q * entre(16.5, 18.5))
      await enregistrerAbattage(ctx, { lotId: lotBrebis.id, date: d, quantite: q, poidsVif: round2(carcasse / 0.46), poidsCarcasse: carcasse, destination: "vente", prixVente: round2(carcasse * 15.5), lieu: "abattoir", nEtablissementDestination: ABATTOIR.numero, notes: `${q} agneaux vendus en caissettes (${ABATTOIR.nom})` })
      vendus += q
    }
  }
  journal(`Brebis : lot de 15 brebis, ${agneauxEnLot} agneaux nés`)

  // ══ COCHONS GASCONS ═══════════════════════════════════════════════════════
  const nomsPorcs = [["Gaston", "Marcel"], ["Truffe", "Grignotte"], ["Pistache", "Paprika"]]
  let porcsActifs = 0
  for (const [k, a] of [Y - 2, Y - 1, Y].entries()) {
    const arrivee = jour(a, 9, 26, 9)
    if (!avant(arrivee)) continue
    for (const [j, nom] of nomsPorcs[k].entries()) {
      const p = await creerAnimal(ctx, {
        especeAnimaleId: "cochon_gascon", nom, identifiant: `FR49999${String(70000 + k * 10 + j).padStart(7, "0")}`, typeIdentifiant: "IPG porcin", race: "Gascon", raceAnimaleId: raceGascon?.id,
        sexe: j === 0 ? "male" : "femelle", dateNaissance: jour(a, 7, 14), dateArrivee: arrivee, provenance: "Élevage de porcs gascons du Layon (fictif)", nExploitationOrigine: "49999077",
        prixAchat: 140, parcelleGeoId: P, notes: j === 0 ? "Mâle castré, engraissement en plein air." : "Engraissement en plein air.",
      })
      const verm = plusJours(arrivee, 6)
      if (fini(verm, 14)) await enregistrerSoin(ctx, { animalId: p.id, date: verm, type: "Vermifuge", produitId: "veto_04", stockMedicamentId: pharmacie.get("veto_04"), quantite: 2.5, unite: "mL", dose: "1 mL/10 kg PV", voie: "PO", motif: "Vermifugation à l'arrivée", ordonnanceUrl: ORDO(`${a}-09-panacur-${nom.toLowerCase()}`), cout: 6, veterinaire: VETO })
      // Pesées mensuelles, abattage début décembre de l'année suivante.
      const abattage = jour(a + 1, 12, 3, 7)
      for (let d = arrivee, m = 0; d.getTime() < Math.min(abattage.getTime(), AUJ.getTime()); d = plusJours(d, 30), m++) {
        await prisma.pesee.create({ data: { userId: ctx.userId, animalId: p.id, date: aHeure(d, 9), poidsKg: round2(22 + m * 30 * 0.36 * bruit(0.05)), notes: m === 0 ? "Pesée à l'arrivée" : null } })
      }
      const derniere = await prisma.pesee.findFirst({ where: { animalId: p.id }, orderBy: { date: "desc" } })
      await prisma.animal.update({ where: { id: p.id }, data: { poidsActuel: derniere?.poidsKg ?? null } })
      if (avant(abattage) && abattage.getTime() < AUJ.getTime()) {
        const carcasse = round2(entre(92, 104))
        await enregistrerAbattage(ctx, { animalId: p.id, date: abattage, quantite: 1, poidsVif: round2(carcasse / 0.78), poidsCarcasse: carcasse, destination: "vente", prixVente: round2(carcasse * 11.5), lieu: "abattoir", nEtablissementDestination: ABATTOIR.numero, notes: "Vente en caissettes (porc gascon plein air)" })
      } else porcsActifs++
    }
  }
  journal(`Cochons : ${porcsActifs} en engraissement`)

  // ══ POULES MARANS ═════════════════════════════════════════════════════════
  const lotPoules = await creerLot(ctx, {
    especeAnimaleId: "poule_marans", nom: "Pondeuses Marans", dateArrivee: jour(Y - 2, 9, 18, 9), quantiteInitiale: 32,
    provenance: "Couvoir de la Sèvre (fictif) — poulettes de 18 semaines", parcelleGeoId: P, notes: "Parcours herbeux autour du poulailler.",
  })
  await prisma.lotAnimaux.update({ where: { id: lotPoules.id }, data: { quantiteActuelle: 30, notes: "Parcours herbeux autour du poulailler. Deux pertes (renard) l'hiver dernier." } })
  const pontes: Array<{ userId: string; lotId: number; date: Date; quantite: number; casses: number; sales: number }> = []
  for (let d = W0; d.getTime() <= HIER.getTime(); d = plusJours(d, 1)) {
    const taux = TAUX_PONTE_PAR_MOIS.marans[d.getUTCMonth()] / 100
    const q = Math.min(33, Math.max(1, Math.round(30 * taux * bruit(0.12))))
    pontes.push({ userId: ctx.userId, lotId: lotPoules.id, date: d, quantite: q, casses: r() < 0.08 ? 1 : 0, sales: r() < 0.06 ? 1 : 0 })
  }
  const pontesCrees = await prisma.productionOeuf.createManyAndReturn({ data: pontes, select: { id: true, date: true, quantite: true, casses: true, sales: true } })
  const stockOeufs = pontesCrees.map((p) => ({ ...p, reste: p.quantite - (p.casses ?? 0) - (p.sales ?? 0) })).sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id)
  let nbVentesOeufs = 0
  const PART_OEUFS: Record<number, [string, number, "CB" | "Chèque" | "Espèces", number, number]> = {
    2: ["AMAP du Bocage", 0.45, "Chèque", 17, 30], 3: ["Boutique de la ferme", 0.3, "Espèces", 16, 0], 6: ["Marché de Montaigu", 0.7, "CB", 11, 30],
  }
  for (let d = plusJours(W0, 3); d.getTime() <= AUJ.getTime(); d = plusJours(d, 1)) {
    const canal = PART_OEUFS[isoDow(d)]
    if (canal) {
      const e = aHeure(d, canal[3], canal[4])
      if (!avant(e)) continue
      const vendables = stockOeufs.filter((p) => p.reste > 0 && p.date.getTime() <= d.getTime() && p.date.getTime() >= plusJours(d, -20).getTime())
      const dispo = vendables.reduce((t, p) => t + p.reste, 0)
      const boites = Math.floor((Math.max(0, dispo - 30) * canal[1]) / 6)
      if (boites < 1) continue
      await enregistrerVente(ctx, { date: e, type: "oeufs", description: "Œufs de Marans bio (boîte de 6)", quantite: boites, unite: "boîte", prixUnitaire: 4.2, client: canal[0], modeReglement: canal[2] })
      nbVentesOeufs++
      let n = boites * 6
      for (const p of vendables) { if (n <= 0) break; const s = Math.min(p.reste, n); p.reste -= s; n -= s }
    }
    if (isoDow(d) === 7 && avant(aHeure(d, 18))) {
      // Œufs de plus de 16 jours non vendus : consommation familiale.
      for (const p of stockOeufs) {
        if (p.reste > 0 && jours(p.date, d) >= 16) {
          await prisma.mouvementStockOeuf.create({ data: { userId: ctx.userId, productionId: p.id, date: aHeure(d, 18), type: "autoconsommation", quantite: p.reste, notes: "Consommation familiale (œufs de plus de 15 jours)" } })
          p.reste = 0
        }
      }
    }
  }
  for (const a of [Y - 1, Y]) for (const [m, j] of [[4, 2], [10, 2]]) {
    const d = jour(a, m, j, 8)
    if (fini(d, 0)) await enregistrerSoin(ctx, { lotId: lotPoules.id, date: d, type: "Autre", produitId: "veto_30", produit: "Vinaigre de cidre 4%", dose: "1 cL par litre d'eau pendant 5 jours", voie: "PO", motif: "Cure de printemps et d'automne (abreuvoirs)", cout: 4 })
  }
  const oeufsStock = stockOeufs.filter((p) => p.reste > 0 && jours(p.date, AUJ) <= 20).reduce((t, p) => t + p.reste, 0)
  journal(`Poules : ${pontes.length} pontes, ${nbVentesOeufs} ventes, ${oeufsStock} œufs commercialisables en stock`)

  // ══ RUCHER ════════════════════════════════════════════════════════════════
  const lotRucher = await creerLot(ctx, {
    especeAnimaleId: "abeille_ruche", nom: "Rucher du verger", dateArrivee: jour(Y - 3, 4, 15, 9), quantiteInitiale: 6,
    provenance: "Essaims d'un apiculteur voisin (fictif)", parcelleGeoId: V, notes: "6 colonies Dadant 10 cadres en bordure du verger.",
  })
  const recoltes: Array<{ id: number; date: Date; reste: number }> = []
  const DEMANDE = [1.5, 1.5, 1.5, 1.8, 2.2, 3, 4, 6.5, 5.5, 5, 3.5, 4.5]
  let nbVentesMiel = 0
  for (let d = jour(Y - 1, 5, 20, 0); d.getTime() <= AUJ.getTime(); d = plusJours(d, 1)) {
    for (const [m, j, kg, cle] of [[5, 27, 50, "PRINTEMPS"], [7, 26, 66, "ETE"]] as const) {
      if (d.getUTCMonth() + 1 === m && d.getUTCDate() === j && avant(aHeure(d, 15))) {
        const q = round2(kg * bruit(0.08))
        const p = await prisma.productionRuche.create({ data: { userId: ctx.userId, lotId: lotRucher.id, date: aHeure(d, 15), produit: "miel", quantite: q, unite: "kg", numeroLot: `MIEL-${d.getUTCFullYear()}-${cle}`, notes: m === 5 ? "Miel de printemps (fruitiers, aubépine)" : "Miel d'été (ronce, châtaignier)" } })
        recoltes.push({ id: p.id, date: p.date, reste: q })
      }
    }
    if (isoDow(d) === 6 && avant(aHeure(d, 11, 45))) {
      const stock = recoltes.filter((x) => x.date.getTime() <= d.getTime()).reduce((t, x) => t + x.reste, 0)
      let q = DEMANDE[d.getUTCMonth()] * bruit(0.2)
      if (stock < 25) q = Math.min(q, stock * 0.12)
      q = Math.floor(q * 2) / 2
      if (q < 0.5) continue
      await enregistrerVente(ctx, { date: aHeure(d, 11, 45), type: "miel", description: "Miel du rucher (pots de 500 g)", quantite: q, unite: "kg", prixUnitaire: 20, client: "Marché de Montaigu", modeReglement: "CB" })
      nbVentesMiel++
      let n = q
      for (const x of recoltes) { if (n <= 0) break; const s = Math.min(x.reste, n); x.reste = round2(x.reste - s); n = round2(n - s) }
    }
  }
  for (const a of [Y - 1, Y]) {
    const ete = jour(a, 8, 5, 9), hiver = jour(a, 12, 28, 9)
    if (fini(ete, 0)) await enregistrerSoin(ctx, { lotId: lotRucher.id, date: ete, type: "Traitement vétérinaire", produit: "Thymol en plaquettes (lutte contre le varroa)", dose: "2 plaquettes par ruche", voie: "Local", motif: "Traitement d'été après la miellée", cout: 48 })
    if (fini(hiver, 0)) await enregistrerSoin(ctx, { lotId: lotRucher.id, date: hiver, type: "Traitement vétérinaire", produit: "Acide oxalique (dégouttement hors couvain)", dose: "5 mL par inter-cadre occupé", voie: "Local", motif: "Traitement d'hiver contre le varroa", cout: 18 })
  }
  const mielStock = round2(recoltes.reduce((t, x) => t + x.reste, 0))
  journal(`Rucher : ${recoltes.length} récoltes, ${nbVentesMiel} ventes, ${mielStock} kg de miel en stock`)

  // ══ NOUVEAU BOUC (entrée à J-2, déclaration à faire) ═══════════════════════
  const naissanceBouc = [jour(Y, 2, 14), jour(Y - 1, 9, 12), jour(Y - 1, 2, 14)].find((d) => jours(d, AUJ) >= 150)!
  const ulysse = await creerAnimal(ctx, {
    especeAnimaleId: "chevre_alpine", nom: "Ulysse", identifiant: "FR79999000731", typeIdentifiant: "IPG caprin", race: "Alpine", raceAnimaleId: raceAlpine?.id,
    orientationProduction: "lait", sexe: "male", dateNaissance: naissanceBouc, dateArrivee: ilYaJours(2, 9), provenance: "Centre de sélection caprine (fictif)",
    nExploitationOrigine: "79999088", prixAchat: 450, parcelleGeoId: P, notes: "Jeune bouc de renouvellement, en quarantaine à l'arrivée.",
  })

  // ══ ALIMENTATION : consommations mensuelles et stocks ═════════════════════
  const RATIONS: Array<{ alim: string; lotId?: number; animalIds?: number[]; parJour: (m: number) => number; tetes: (d: Date) => number }> = [
    { alim: "foin", lotId: lotChevres.id, parJour: (m) => ([10, 11, 0, 1, 2, 3].includes(m) ? 2.1 : 0.8), tetes: () => 12 },
    { alim: "luzerne", lotId: lotChevres.id, parJour: () => 0.4, tetes: () => 12 },
    { alim: "granules-chevre", lotId: lotChevres.id, parJour: () => 0.55, tetes: () => 10 },
    { alim: "orge", lotId: lotChevres.id, parJour: () => 0.25, tetes: () => 12 },
    { alim: "foin", lotId: lotBrebis.id, parJour: (m) => ([11, 0, 1, 2].includes(m) ? 1.5 : 0), tetes: () => 16 },
    { alim: "orge", lotId: lotBrebis.id, parJour: (m) => ([1, 2, 3].includes(m) ? 0.3 : 0), tetes: () => 15 },
    { alim: "pondeuses", lotId: lotPoules.id, parJour: () => 0.12, tetes: () => 30 },
  ]
  const porcs = await prisma.animal.findMany({ where: { userId: ctx.userId, especeAnimaleId: "cochon_gascon" }, select: { id: true, dateArrivee: true, dateSortie: true } })
  const STOCKS: Record<string, { stock: number; min: number; lot: number; fournisseur: string }> = {
    foin: { stock: 6000, min: 1500, lot: 6000, fournisseur: "Foin de la ferme et voisin (fictif)" },
    luzerne: { stock: 900, min: 300, lot: 1200, fournisseur: "Coopérative agricole du Bocage (fictive)" },
    "granules-chevre": { stock: 600, min: 200, lot: 1000, fournisseur: "Coopérative agricole du Bocage (fictive)" },
    orge: { stock: 700, min: 200, lot: 800, fournisseur: "GAEC voisin (fictif)" },
    pondeuses: { stock: 220, min: 100, lot: 250, fournisseur: "Coopérative agricole du Bocage (fictive)" },
    porc: { stock: 300, min: 120, lot: 500, fournisseur: "Coopérative agricole du Bocage (fictive)" },
    lapin: { stock: 75, min: 25, lot: 50, fournisseur: "Coopérative agricole du Bocage (fictive)" },
  }
  const approvisionnements: Array<{ date: string; alimentId: string; kg: number; fournisseur: string; reference: string }> = []
  const derniereEcriture = new Map<string, Date>()
  let nbConso = 0
  const approvisionner = async (cle: string, d: Date, kg: number) => {
    const s = STOCKS[cle]
    s.stock += kg
    derniereEcriture.set(cle, d)
    const reference = `FA-${d.getUTCFullYear()}-${String(approvisionnements.length + 101).padStart(4, "0")}`
    approvisionnements.push({ date: d.toISOString(), alimentId: idAliment(ctx, cle), kg, fournisseur: s.fournisseur, reference })
    const just = await prisma.justificatifAlimentElevage.create({ data: { userId: ctx.userId, alimentId: idAliment(ctx, cle), typeDocument: cle === "foin" ? "BON_LIVRAISON" : "FACTURE", dateDocument: d, reference, fournisseur: s.fournisseur, numeroLot: `DEMO-${cle.toUpperCase()}-${jourIso(d)}`, notes: `${kg} kg livrés` } })
    await journaliserEvenementReglementaire(prisma, { userId: ctx.userId, declarationKey: `justificatif-aliment:${just.id}`, action: "JUSTIFICATIF_ALIMENT_CREE", actorUserId: ctx.userId, snapshotHash: empreinteDeclaration(JSON.parse(JSON.stringify(just))), metadata: { objectType: "justificatif_aliment", objectId: just.id, after: JSON.parse(JSON.stringify(just)) } })
  }
  for (let m = new Date(W0); ; m = jour(m.getUTCFullYear(), m.getUTCMonth() + 2, 1, 0)) {
    const finMois = jour(m.getUTCFullYear(), m.getUTCMonth() + 2, 0, 18)
    if (!avant(finMois)) break
    const nbJours = finMois.getUTCDate()
    if (m.getUTCMonth() === 5) await approvisionner("foin", jour(m.getUTCFullYear(), 6, 24, 17), 9500) // fenaison
    const lignesMois: Array<{ cle: string; quantite: number; lotId?: number; animalId?: number }> = []
    for (const rr of RATIONS) {
      const q = Math.round(rr.parJour(m.getUTCMonth()) * rr.tetes(m) * nbJours)
      if (q > 0) lignesMois.push({ cle: rr.alim, quantite: q, lotId: rr.lotId })
    }
    for (const p of porcs) {
      if (!p.dateArrivee || p.dateArrivee.getTime() > finMois.getTime() || (p.dateSortie && p.dateSortie.getTime() < m.getTime())) continue
      lignesMois.push({ cle: "porc", quantite: Math.round(2.1 * nbJours), animalId: p.id })
    }
    for (const l of lignesMois) {
      const s = STOCKS[l.cle]
      if (s.stock - l.quantite < s.min * 1.4) await approvisionner(l.cle, jour(finMois.getUTCFullYear(), finMois.getUTCMonth() + 1, 8, 9), Math.max(s.lot, l.quantite * 2))
      const conso = await prisma.consommationAliment.create({ data: { userId: ctx.userId, alimentId: idAliment(ctx, l.cle), lotId: l.lotId ?? null, animalId: l.animalId ?? null, date: finMois, quantite: l.quantite, notes: "Relevé mensuel" } })
      await createDepenseFromConsommationAliment(ctx.userId, { id: conso.id, alimentId: conso.alimentId, quantite: conso.quantite, date: conso.date })
      s.stock -= l.quantite
      derniereEcriture.set(l.cle, finMois)
      nbConso++
    }
  }
  for (const [cle, s] of Object.entries(STOCKS)) {
    await prisma.userStockAliment.update({ where: { userId_alimentId: { userId: ctx.userId, alimentId: idAliment(ctx, cle) } }, data: { stock: Math.round(s.stock), dateStock: derniereEcriture.get(cle) ?? jour(Y, 1, 1) } })
  }
  for (const [nom, lotId, profil, poids, lait, gest, compo] of [
    ["Chèvres en lactation", lotChevres.id, "caprin", 65, 3.2, "aucune", [["foin", 2.1], ["luzerne", 0.4], ["granules-chevre", 0.6], ["orge", 0.25]]],
    ["Chèvres taries, fin de gestation", lotChevres.id, "caprin", 68, 0, "gestation_finale", [["foin", 2.2], ["luzerne", 0.4], ["granules-chevre", 0.3]]],
    ["Brebis en fin de gestation", lotBrebis.id, "ovin", 55, 0, "gestation_finale", [["foin", 1.6], ["orge", 0.3]]],
  ] as const) {
    await prisma.planRation.create({ data: { userId: ctx.userId, nom, lotId, stade: gest === "aucune" ? "lactation" : "tarissement", profilEspece: profil, poidsVif: poids, litresLait: lait, tauxButyreux: 36, stadeGestation: gest, composition: compo.map(([cle, q]) => ({ alimentId: idAliment(ctx, cle), quantiteKg: q })) } })
  }
  journal(`Alimentation : ${nbConso} consommations, ${approvisionnements.length} approvisionnements`)

  // ══ SUIVI SANITAIRE, REGISTRE, TOURNÉE ════════════════════════════════════
  for (const c of chevrettesGardees) {
    for (let d = plusJours(c.naissance, 30), m = 1; d.getTime() < AUJ.getTime(); d = plusJours(d, 30), m++) {
      await prisma.pesee.create({ data: { userId: ctx.userId, animalId: c.id, date: aHeure(d, 9), poidsKg: round2(3.8 + m * 30 * 0.14 * bruit(0.05)) } })
    }
    const der = await prisma.pesee.findFirst({ where: { animalId: c.id }, orderBy: { date: "desc" } })
    if (der) await prisma.animal.update({ where: { id: c.id }, data: { poidsActuel: der.poidsKg } })
  }
  const prophylaxies: Array<[number, number, string, string, string]> = [
    [1, 22, "Prophylaxie brucellose (prise de sang de cheptel)", "Clinique vétérinaire du Bocage (vétérinaire sanitaire)", "Négatif, cheptel officiellement indemne"],
    [3, 5, "Coproscopie de mélange — chèvres", "Laboratoire d'analyses du Bocage (fictif)", "120 opg strongles, pas de traitement"],
    [6, 20, "Coproscopie de mélange — brebis", "Laboratoire d'analyses du Bocage (fictif)", "650 opg strongles, vermifugation"],
    [10, 10, "Coproscopie de mélange — chèvres", "Laboratoire d'analyses du Bocage (fictif)", "480 opg strongles, traitement ciblé"],
    [11, 25, "Dépistage CAEV (sérologie de cheptel)", "Laboratoire d'analyses du Bocage (fictif)", "Négatif sur toutes les chèvres"],
  ]
  for (const a of [Y - 1, Y]) for (const [m, j, type, organisme, resultat] of prophylaxies) {
    const d = jour(a, m, j, 9)
    if (!avant(d) || d.getTime() >= AUJ.getTime()) continue
    await prisma.prophylaxieElevage.create({ data: { userId: ctx.userId, especeAnimaleId: type.includes("brebis") ? "brebis_solognote" : "chevre_alpine", type, datePrevue: d, dateRealisee: d, statut: "realisee", organisme, resultat, notes: `Réf. DEMO-${a}-${String(m).padStart(2, "0")}${j}` } })
  }
  for (const a of [Y - 1, Y]) for (const [m, j, libelle, categorie, montant] of [
    [1, 31, "Recensement annuel des ovins et caprins (EDE)", "IDENTIFICATION", null], [3, 31, "Cotisation annuelle au GDS de Vendée", "SANITAIRE", 186],
    [4, 1, "Assurance mortalité du cheptel — échéance annuelle", "ASSURANCE", 420], [5, 15, "Déclaration PAC (aides ovines et caprines)", "PAC", null],
  ] as const) {
    const d = jour(a, m, j, 9)
    if (d.getTime() < AUJ.getTime()) await prisma.echeanceAdministrativeElevage.create({ data: { userId: ctx.userId, libelle: `${libelle} ${a}`, categorie, dateEcheance: d, statut: "fait", montant } })
  }
  await prisma.echeanceAdministrativeElevage.create({ data: { userId: ctx.userId, libelle: "Commande des boucles d'identification (prochaines naissances)", categorie: "IDENTIFICATION", dateEcheance: plusJours(AUJ, 12), statut: "a_faire", montant: 64, notes: "Boucles électroniques pour les chevreaux et agneaux à venir." } })
  for (const [client, production, d0, d1, prix, notes] of [
    ["AMAP du Bocage", "Fromages et œufs (paniers hebdomadaires)", jour(Y - 1, 4, 1, 0), null, "Panier fromage 9 € · boîte de 6 œufs 4,20 €", "Distribution le mardi soir."],
    ["Restaurant La Table du Bocage", "Fromages (crottins, tommes)", jour(Y - 1, 9, 1, 0), null, "Crottin 1,90 € HT · tomme 22 € HT/kg", "Livraison le jeudi, facture mensuelle."],
    [NEGOCIANT.nom, "Chevreaux de 3 semaines", jour(Y - 2, 1, 1, 0), null, "18 € par chevreau", "Enlèvement le jeudi à la ferme."],
  ] as const) {
    await prisma.contratElevage.create({ data: { userId: ctx.userId, client, production, dateDebut: d0, dateFin: d1, prix, actif: true, notes } })
  }
  // Tournée : tâche quotidienne du jour, tâches périodiques à venir.
  const taches: Array<[string, string, string, number, number, number | undefined]> = [
    ["Ramassage des œufs et contrôle des abreuvoirs", "controle", "normale", 1, 0, lotPoules.id],
    ["Tour des clôtures électriques — Pâture du Grand Pré", "paturage", "basse", 7, 3, undefined],
    ["Pesée des chevrettes de renouvellement", "controle", "normale", 30, 12, undefined],
    ["Parage des onglons — troupeau laitier", "soin", "normale", 120, 64, lotChevres.id],
  ]
  for (const [titre, categorie, priorite, recurrence, dans, lotId] of taches) {
    const prochaine = aHeure(plusJours(AUJ, dans), 7)
    const t = await prisma.tacheTerrainElevage.create({ data: { userId: ctx.userId, titre, categorie, priorite, lotId: lotId ?? null, prochaineEcheance: prochaine, recurrenceJours: recurrence, actif: true } })
    const real: Prisma.RealisationTacheElevageCreateManyInput[] = []
    for (let k = 1, e = plusJours(prochaine, -recurrence); k <= Math.min(60, Math.floor(400 / recurrence)); k++, e = plusJours(e, -recurrence)) {
      real.push({ userId: ctx.userId, tacheId: t.id, dateEcheance: e, dateRealisation: new Date(e.getTime() + 2.5 * 3_600_000), clientOperationId: randomUUID() })
    }
    await prisma.realisationTacheElevage.createMany({ data: real })
  }
  // Statuts sanitaires : une ligne par maladie et par cible caprine ou ovine active.
  const maladies = await prisma.maladieElevage.findMany({ where: { userId: null, active: true }, select: { id: true, especesCibles: true } })
  const actifs = await prisma.animal.findMany({ where: { userId: ctx.userId, statut: "actif", especeAnimaleId: { in: ["chevre_alpine", "brebis_solognote"] } }, select: { id: true, especeAnimaleId: true } })
  const statuts: Prisma.StatutSanitaireElevageCreateManyInput[] = []
  const dateCtrl = [jour(Y, 1, 22, 9), jour(Y - 1, 1, 22, 9)].find((d) => d.getTime() < AUJ.getTime())!
  const code = (e: string) => (e.startsWith("chevre") ? "caprin" : "ovin")
  for (const m of maladies) {
    for (const a of actifs) if (m.especesCibles.includes(code(a.especeAnimaleId))) statuts.push({ userId: ctx.userId, animalId: a.id, maladieId: m.id, statut: "indemne", dateControle: dateCtrl, laboratoire: "Laboratoire d'analyses du Bocage (fictif)", numeroAnalyse: `DEMO-${jourIso(dateCtrl)}-${a.id}` })
    for (const [lotId, e] of [[lotChevres.id, "chevre_alpine"], [lotBrebis.id, "brebis_solognote"]] as const) if (m.especesCibles.includes(code(e))) statuts.push({ userId: ctx.userId, lotId, maladieId: m.id, statut: "indemne", dateControle: dateCtrl, laboratoire: "Laboratoire d'analyses du Bocage (fictif)", numeroAnalyse: `DEMO-${jourIso(dateCtrl)}-L${lotId}` })
  }
  await prisma.statutSanitaireElevage.createMany({ data: statuts })
  // Cadre réglementaire : lieux de détention et intervenants.
  const lieux = [
    { type: "SITE", nom: "Site du Bois Joli", numeroEde: ede, adresse: IDENTITE.adresse, codePostal: IDENTITE.codePostal, ville: IDENTITE.ville, especes: ["caprin", "ovin", "porcin", "volaille", "abeille"], usages: "Siège de l'exploitation" },
    { type: "BATIMENT", nom: "Chèvrerie et fromagerie", especes: ["caprin"], usages: "Stabulation libre, salle de traite 2 × 6, fromagerie attenante" },
    { type: "PARCELLE", nom: "Pâture du Grand Pré", especes: ["caprin", "ovin", "porcin", "volaille"], usages: "Pâturage tournant en paddocks, poulailler, parc à cochons" },
    { type: "PARCELLE", nom: "Prairie de fauche", especes: ["ovin"], usages: "Fauche en juin, regain pâturé par les brebis à l'automne" },
    { type: "AUTRE", nom: "Rucher du verger", especes: ["abeille"], usages: "6 colonies Dadant" },
  ]
  for (const l of lieux) {
    const created = await prisma.lieuDetentionElevage.create({ data: { exploitationId: ctx.exploitationId, ...l } })
    const snap = JSON.parse(JSON.stringify(created))
    await journaliserEvenementReglementaire(prisma, { userId: ctx.userId, declarationKey: `cadre-reglementaire:lieu:${created.id}`, action: "CADRE_LIEU_CREE", actorUserId: ctx.userId, snapshotHash: empreinteDeclaration(snap), metadata: { objectType: "lieu", objectId: created.id, after: snap } })
  }
  const intervenants = [
    { role: "DETENTEUR", nom: "Camille Lefèvre", fonction: "Co-gérante de l'EARL", telephone: "02 61 91 00 10" },
    { role: "PROPRIETAIRE_ANIMAUX", organisme: IDENTITE.raisonSociale, fonction: "Propriétaire des animaux (identique au détenteur)" },
    { role: "RESPONSABLE_REGISTRE", nom: "Thomas Lefèvre", fonction: "Co-gérant de l'EARL", perimetreDelegation: "Tenue du registre d'élevage et notifications EDE", dateDebut: jour(Y - 2, 1, 1, 0) },
    { role: "VETERINAIRE_SUIVI", nom: "Dr Claire Morin", organisme: "Clinique vétérinaire du Bocage", email: "cabinet@clinique-bocage.example.com", telephone: "02 61 91 00 20" },
    { role: "VETERINAIRE_SANITAIRE", nom: "Dr Paul Garnier", organisme: "Clinique vétérinaire du Bocage", telephone: "02 61 91 00 21" },
    { role: "GDS_OVS", organisme: "GDS de Vendée", fonction: "Adhérent (section caprine et ovine)" },
    { role: "ORGANISATION_PRODUCTION", statut: "NON_CONCERNE", fonction: "Non adhérent : vente directe" },
    { role: "PROGRAMME_SANITAIRE", organisme: "Clinique vétérinaire du Bocage", fonction: "Programme sanitaire d'élevage (bilan annuel)" },
  ]
  for (const i of intervenants) {
    const created = await prisma.intervenantElevage.create({ data: { exploitationId: ctx.exploitationId, statut: "ACTIF", especes: ["caprin", "ovin"], ...i } })
    const snap = JSON.parse(JSON.stringify(created))
    await journaliserEvenementReglementaire(prisma, { userId: ctx.userId, declarationKey: `cadre-reglementaire:intervenant:${created.id}`, action: "CADRE_INTERVENANT_CREE", actorUserId: ctx.userId, snapshotHash: empreinteDeclaration(snap), metadata: { objectType: "intervenant", objectId: created.id, after: snap } })
  }

  // ══ DÉCLARATIONS : transmises puis acceptées (sauf l'entrée du jour J-2) ══
  let nbDecl = 0
  for (const year of [Y - 1, Y]) {
    const res = await chargerDeclarationsReglementaires(ctx.userId, { year, maintenant: NOW })
    for (const d of res.declarations) {
      if (!["A_DECLARER", "A_COMPLETER", "HORS_DELAI"].includes(d.statut)) continue
      if (d.key === `animal:${ulysse.id}:ENTREE`) continue
      if (d.anomalies.length) { console.warn(`  ⚠ déclaration ${d.key} incomplète : ${d.anomalies.join(" ; ")}`); continue }
      const evt = new Date(d.dateEvenement)
      const transmis = new Date(Math.min(aHeure(plusJours(evt, 2), 18, 30).getTime(), NOW.getTime() - 3_600_000))
      const ref = `DEMO-EDE-${year}-${String(++nbDecl).padStart(4, "0")}`
      await prisma.$transaction((tx) => enregistrerSuiviDeclaration(tx, { userId: ctx.userId, acteur: ctx.userId, year, declaration: d, statut: "TRANSMISE", statutAvant: d.statut, transmisAt: transmis, canalTransmission: "Portail EDE", referenceTransmission: ref, notes: null }))
      const accepte = aHeure(plusJours(transmis, 2), 9)
      if (accepte.getTime() < NOW.getTime()) {
        await prisma.$transaction((tx) => enregistrerSuiviDeclaration(tx, { userId: ctx.userId, acteur: ctx.userId, year, declaration: d, statut: "ACCEPTEE", statutAvant: "TRANSMISE", transmisAt: transmis, canalTransmission: "Portail EDE", referenceTransmission: ref, notes: "Accusé de réception de l'EDE" }))
      }
      const evts = await prisma.declarationReglementaireEvenement.findMany({ where: { userId: ctx.userId, declarationKey: d.key }, orderBy: { createdAt: "asc" }, select: { id: true } })
      if (evts[0]) await prisma.declarationReglementaireEvenement.update({ where: { id: evts[0].id }, data: { createdAt: transmis } })
      if (evts[1]) await prisma.declarationReglementaireEvenement.update({ where: { id: evts[1].id }, data: { createdAt: accepte } })
    }
  }
  journal(`Déclarations : ${nbDecl} transmises à l'EDE`)

  // ══ PARTAGE AVEC LE COMMERCE ══════════════════════════════════════════════
  const cave = await prisma.lotFromage.findMany({ where: { userId: ctx.userId, etat: "pret" }, include: { mouvements: { select: { nbPieces: true, poidsKg: true } } }, orderBy: { dateFabrication: "asc" } })
  const fromagesDisponibles = lotsF.filter((l) => l.restePieces > 0 && cave.some((c) => c.id === l.id)).map((l) => ({
    lotFromageId: l.id, numeroLot: l.numero, typeFromage: l.type, restantPieces: l.restePieces, restantKg: l.resteKg,
    echeance: plusJours(l.date, FROMAGES[l.type].echeance).toISOString(), unite: FROMAGES[l.type].unite,
  }))
  ctx.partage.elevage = {
    lotsFromagePourCommerce: fromagesDisponibles.map((f) => f.lotFromageId),
    fromagesDisponibles,
    lotPondeusesId: lotPoules.id,
    oeufsCommercialisables: oeufsStock,
    pontesDisponibles: stockOeufs.filter((p) => p.reste > 0 && jours(p.date, AUJ) <= 20).map((p) => ({ productionId: p.id, date: p.date.toISOString(), restant: p.reste })),
    lotRucherId: lotRucher.id,
    mielStockKg: mielStock,
    recoltesMielDisponibles: recoltes.filter((x) => x.reste > 0).map((x) => ({ productionId: x.id, restantKg: x.reste })),
    approvisionnementsAliments: approvisionnements,
    achatsAnimauxDejaEnCompta: "Miroirs achat_animal_individuel (porcs, bouc Ulysse) créés par l'application : ne pas ressaisir.",
  }
  journal(`Élevage terminé en ${Math.round((Date.now() - debut) / 1000)} s`)
}

function ilYaJours(n: number, heure: number) {
  return aHeure(plusJours(AUJ, -n), heure)
}
void ajouterJours
