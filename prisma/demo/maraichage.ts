/**
 * Maraîchage : deux campagnes complètes (Y-1 et Y) et les cultures d'hiver
 * de Y-2 récoltées en Y-1, calées sur le vrai calendrier des itinéraires.
 *
 * - Les dates des itinéraires Gleba sont dérivées par les fonctions de l'app
 *   (`datesDepuisItp`, calage de zone océanique) : la planification propose
 *   exactement les mêmes. Les itinéraires INRAE portent des dates choisies
 *   dans leur fenêtre d'implantation. Aucune alerte de saison (contrôlée).
 * - Les planches en rotation cultivent l'itinéraire de leur étape, lue dans
 *   le référentiel : le hub Planification affiche « Plan prêt ».
 * - L'état découle du jour : un jalon passé est fait, une culture dont la
 *   récolte est finie est terminée, les récoltes ne vont que jusqu'à hier.
 * - Les récoltes passent par l'écriture de l'app (`ecrireRecoltesPreparees`)
 *   puis sont vendues comme par le PATCH /api/recoltes/[id] : à l'AMAP
 *   (client de type « amap », chèque) ou au marché (espèces), avec le miroir
 *   comptable de `createVenteFromRecolte`. Les légumes de garde restent en
 *   partie en stock pour l'hiver et les bons de livraison du module commerce.
 */

import { createVenteFromRecolte } from "../../src/lib/auto-compta"
import { appliquerDecalageItp, decalageItpPourZone } from "../../src/lib/calendrier-climat"
import { datesDepuisItp } from "../../src/lib/cultures/dates-itp"
import { finRecolteDepuisItp } from "../../src/lib/cultures/fenetre-recolte"
import { nbPlantsCulture } from "../../src/lib/cultures/quantite-plants"
import { alerteSaisonCulture } from "../../src/lib/cultures/saison-culture"
import { ecrireRecoltesPreparees, preparerRecoltes } from "../../src/lib/recolte/creation"
import { alea, AUJ, graine, ilYa, journal, minuit, NOW, passe, plusJours, prisma, round1, round2, Y, type Contexte } from "./contexte"
import { ROTATIONS_PLANCHES } from "./terrain"

const ZONE_FERME = "oceanique" as const
const LARGEUR_PLANCHE = 1.2

/** [mois, jour, années après la campagne]. */
type MJ = [number, number, number?]

type Parametres = {
  variete: string | null
  rangs: number
  /** Espacement sur le rang, en cm. */
  esp: number
  /** Rendement en kg/m² sur la saison ; absent pour un engrais vert. */
  rdt?: number
  /** Prix de vente bio en direct, € TTC/kg. */
  prix?: number
  /** Part de la récolte gardée en stock (légumes de conservation). */
  garde?: number
  /** Arrosée au goutte-à-goutte pendant sa croissance. */
  irriguee?: boolean
}

type Spec = Parametres & {
  planche: string
  itp: string
  /** Mètres de planche occupés (40 m par défaut en plein champ). */
  longueur?: number
  s?: MJ
  p?: MJ
  r?: MJ
  f?: MJ
  /** Décale toutes les dates dérivées de l'ITP (semaines). */
  pousser?: number
}

// ─── Itinéraires Gleba : paramètres des cultures (dates dérivées de l'ITP) ──
const PARAM_ITP: Record<string, Parametres> = {
  "Tomate-printemps": { variete: "Tomate-Marmande", rangs: 2, esp: 60, rdt: 5, prix: 4.2, irriguee: true },
  "Haricot-vert-ete": { variete: "Haricot Contender", rangs: 3, esp: 7, rdt: 1.5, prix: 9, irriguee: true },
  "Chou-kale-ete": { variete: "Chou kale-Nero di Toscana", rangs: 2, esp: 50, rdt: 1.6, prix: 7, irriguee: true },
  "Oignon-printemps": { variete: "Oignon Bulbilles Sturon", rangs: 4, esp: 12, rdt: 3, prix: 3.5, garde: 0.45 },
  "Courge-butternut": { variete: "Courge butternut-Waltham", rangs: 1, esp: 100, rdt: 3, prix: 2.8, garde: 0.6, irriguee: true },
  "Haricot-ete-sec": { variete: "Haricot-Coco de Prague", rangs: 3, esp: 10, rdt: 0.3, prix: 9, garde: 0.7 },
  "EV-Phacelie-automne": { variete: "Phacélie population", rangs: 4, esp: 5 },
  "Haricot-ete-plein-champ": { variete: "Haricot Morgane", rangs: 3, esp: 7, rdt: 1.2, prix: 8, irriguee: true },
  "Laitue-printemps-precoce": { variete: "Laitue Grenobloise", rangs: 4, esp: 30, rdt: 4, prix: 5 },
  "Chou-pomme-printemps": { variete: "Chou pommé Pointu de Chateaurenard", rangs: 2, esp: 50, rdt: 3, prix: 2.8 },
  "Betterave-printemps": { variete: "Betterave Detroit", rangs: 4, esp: 10, rdt: 3, prix: 3.4 },
  "Mache-automne": { variete: "Mâche verte à coeur plein", rangs: 6, esp: 8, rdt: 0.8, prix: 16 },
  "Courgette-printemps": { variete: "Courgette Verte Noire Maraîchère", rangs: 1, esp: 90, rdt: 7, prix: 3, irriguee: true },
  "Carotte-ete-conservation-plein-champ": { variete: "Carotte Touchon", rangs: 4, esp: 3, rdt: 4, prix: 2.8, garde: 0.7, irriguee: true },
}

/** Culture qui suit l'étape de rotation sur la même planche (familles hors rotation). */
const SUITES: Record<string, Record<number, Array<{ itp: string; pousser?: number; avant?: boolean; p?: MJ; r?: MJ; f?: MJ; s?: MJ } & Partial<Parametres>>>> = {
  "Rotation-4ans-A": {
    1: [{ itp: "Mache-automne" }],
    2: [{ itp: "INRAE-MESCLUN-0146", variete: "Épinard Géant d'Hiver", rangs: 5, esp: 10, rdt: 1.5, prix: 8, p: [9, 1], r: [10, 15], f: [2, 5, 1] }],
    3: [{ itp: "EV-Phacelie-automne", pousser: 1 }],
    4: [{ itp: "EV-Phacelie-automne" }],
  },
  "Rotation-3ans-Courges": {
    1: [],
    2: [{ itp: "Mache-automne", pousser: 1 }],
    3: [{ itp: "INRAE-MESCLUN-0386", avant: true, variete: "Pomme de terre Ditta", rangs: 2, esp: 35, rdt: 2.5, prix: 2.6, garde: 0.5, p: [3, 25], r: [6, 15], f: [7, 25] }],
  },
  Potager: {
    1: [{ itp: "Mache-automne" }],
    2: [{ itp: "Courgette-printemps" }],
    3: [{ itp: "Carotte-ete-conservation-plein-champ" }],
    4: [{ itp: "INRAE-MESCLUN-0146", variete: "Épinard Géant d'Hiver Verdil", rangs: 5, esp: 10, rdt: 1.5, prix: 8, p: [9, 1], r: [10, 15], f: [2, 5, 1] }],
  },
}

/** Serre, tunnel et planches hors rotation : successions annuelles explicites. */
function plan_fixe(): Spec[] {
  return [
    // ── Serre (planches de 10 m) ──
    { planche: "A1", itp: "INRAE-MESCLUN-0518", variete: "Tomate Coeur de Boeuf", rangs: 2, esp: 50, rdt: 10, prix: 4.8, irriguee: true, s: [2, 10], p: [4, 12], r: [7, 5], f: [10, 11] },
    { planche: "A1", itp: "INRAE-MESCLUN-0228", variete: "Mâche verte", rangs: 6, esp: 8, rdt: 0.9, prix: 16, irriguee: true, p: [11, 5], r: [12, 14], f: [1, 25, 1] },
    { planche: "A2", longueur: 6, itp: "INRAE-MESCLUN-0020", variete: "Aubergine Barbentane", rangs: 2, esp: 50, rdt: 5, prix: 4.5, irriguee: true, s: [2, 1], p: [4, 25], r: [7, 10], f: [10, 23] },
    { planche: "A2", longueur: 4, itp: "INRAE-MESCLUN-0023", variete: "Basilic Grand Vert", rangs: 3, esp: 25, rdt: 1.2, prix: 30, irriguee: true, s: [3, 15], p: [4, 25], r: [6, 1], f: [8, 10] },
    { planche: "A2", itp: "INRAE-MESCLUN-0202", variete: "Laitue Pommée d'hiver Triolaise", rangs: 4, esp: 30, rdt: 4, prix: 5, irriguee: true, p: [11, 6], r: [2, 15, 1], f: [3, 1, 1] },
    { planche: "A3", itp: "INRAE-MESCLUN-0446", variete: "Radis de 18 jours", rangs: 8, esp: 3, rdt: 2.5, prix: 5, irriguee: true, s: [3, 6], r: [4, 15], f: [4, 22] },
    { planche: "A3", itp: "INRAE-MESCLUN-0410", variete: "Poivron California Wonder", rangs: 2, esp: 45, rdt: 4, prix: 6, irriguee: true, s: [2, 5], p: [5, 5], r: [7, 15], f: [10, 20] },
    { planche: "A3", itp: "INRAE-MESCLUN-0203", variete: "Batavia reine des glaces", rangs: 4, esp: 30, rdt: 4, prix: 5, irriguee: true, p: [11, 12], r: [2, 18, 1], f: [3, 4, 1] },
    // ── Tunnel (planches de 23 m) ──
    { planche: "C1", itp: "INRAE-MESCLUN-0134", variete: "Courgette Black Beauty", rangs: 1, esp: 90, rdt: 7, prix: 3, irriguee: true, s: [2, 20], p: [3, 25], r: [5, 1], f: [7, 10] },
    { planche: "C1", itp: "INRAE-MESCLUN-0146", variete: "Épinard Géant d'Hiver", rangs: 5, esp: 10, rdt: 1.5, prix: 8, irriguee: true, p: [9, 1], r: [10, 15], f: [2, 5, 1] },
    { planche: "C2", itp: "INRAE-MESCLUN-0198", variete: "Laitue Feuille de Chêne", rangs: 4, esp: 30, rdt: 4, prix: 5, irriguee: true, s: [1, 10], p: [2, 12], r: [4, 15], f: [4, 29] },
    { planche: "C2", itp: "INRAE-MESCLUN-0113", variete: "Concombre Marketmore", rangs: 1, esp: 60, rdt: 9, prix: 3.5, irriguee: true, s: [4, 5], p: [5, 6], r: [6, 15], f: [9, 7] },
    { planche: "C2", itp: "INRAE-MESCLUN-0447", variete: "Radis Rond écarlate", rangs: 8, esp: 3, rdt: 2.5, prix: 5, irriguee: true, s: [9, 24], r: [10, 29], f: [11, 12] },
    { planche: "C3", itp: "INRAE-MESCLUN-0523", variete: "Tomate Cerise", rangs: 2, esp: 50, rdt: 6, prix: 8, irriguee: true, s: [3, 1], p: [5, 4], r: [7, 15], f: [10, 21] },
    { planche: "C3", itp: "INRAE-MESCLUN-0227", variete: "Mâche verte", rangs: 6, esp: 8, rdt: 0.8, prix: 16, irriguee: true, p: [10, 25], r: [11, 16], f: [12, 21] },
    { planche: "C4", itp: "INRAE-MESCLUN-0397", variete: "Petit pois-Merveille de Kelvedon", rangs: 2, esp: 5, rdt: 0.8, prix: 10, irriguee: true, s: [1, 10], p: [2, 5], r: [5, 1], f: [6, 5] },
    { planche: "C4", itp: "INRAE-MESCLUN-0024", variete: "Basilic Grand Vert", rangs: 3, esp: 25, rdt: 1.2, prix: 30, irriguee: true, p: [6, 10], r: [7, 10], f: [8, 20] },
    { planche: "C4", itp: "INRAE-MESCLUN-0133", variete: "Courgette Gold Rush", rangs: 1, esp: 90, rdt: 6, prix: 3, irriguee: true, p: [8, 24], r: [9, 21], f: [11, 12] },
    // ── Plein champ hors rotation (planches de 40 m) ──
    { planche: "B12", itp: "INRAE-MESCLUN-0407", variete: "Poireau Bleu de Solaise", rangs: 3, esp: 12, rdt: 3, prix: 4, p: [7, 10], r: [11, 16], f: [4, 15, 1] },
    { planche: "B13", longueur: 20, itp: "INRAE-MESCLUN-0084", variete: "Chou frisé winster", rangs: 2, esp: 50, rdt: 2, prix: 3.5, p: [7, 27], r: [11, 2], f: [3, 15, 1] },
    { planche: "B13", longueur: 20, itp: "INRAE-MESCLUN-0086", variete: "Chou kale-Redbor F1", rangs: 2, esp: 50, rdt: 1.5, prix: 7, p: [7, 1], r: [10, 5], f: [3, 8, 1] },
    { planche: "B14", longueur: 20, itp: "INRAE-MESCLUN-0009", variete: "Ail Cledor", rangs: 4, esp: 12, rdt: 0.9, prix: 14, garde: 0.6, p: [10, 20], r: [7, 1, 1], f: [7, 29, 1] },
    { planche: "B14", longueur: 20, itp: "INRAE-MESCLUN-0140", variete: null, rangs: 4, esp: 15, rdt: 1.2, prix: 9, garde: 0.5, p: [2, 25], r: [6, 15], f: [7, 20] },
    { planche: "B15", longueur: 20, itp: "INRAE-MESCLUN-0386", variete: "Pomme de terre Bintje", rangs: 2, esp: 35, rdt: 2.5, prix: 2.6, garde: 0.6, p: [3, 25], r: [6, 15], f: [7, 25] },
    { planche: "B15", longueur: 20, itp: "Mache-automne", ...PARAM_ITP["Mache-automne"], variete: "Mâche verte" },
    { planche: "B15", longueur: 20, itp: "Carotte-ete-conservation-plein-champ", ...PARAM_ITP["Carotte-ete-conservation-plein-champ"], variete: "Carotte Nantaise" },
    { planche: "B16", longueur: 20, itp: "INRAE-MESCLUN-0165", variete: "Fève Aguadulce", rangs: 2, esp: 15, rdt: 1.2, prix: 6, p: [11, 12], r: [5, 18, 1], f: [6, 22, 1] },
    { planche: "B16", longueur: 20, itp: "Courgette-printemps", ...PARAM_ITP["Courgette-printemps"], variete: "Courgette Ronde de Nice" },
  ]
}

type ItpLu = Awaited<ReturnType<typeof chargerItps>> extends Map<string, infer T> ? T : never

async function chargerItps(ids: string[]) {
  const rows = await prisma.iTP.findMany({ where: { id: { in: ids } } })
  return new Map(rows.map((r) => [r.id, r]))
}

const utc = (d: Date | null) => (d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null)
const jm = (c: number, [m, j, an = 0]: MJ) => new Date(Date.UTC(c + an, m - 1, j))

type CultureCalculee = Spec & {
  annee: number
  especeId: string
  dateSemis: Date | null
  datePlantation: Date | null
  dateRecolte: Date | null
  finRecolte: Date | null
}

function semainesItp(itp: ItpLu) {
  const dec = decalageItpPourZone(itp.zoneClimat, ZONE_FERME)
  return appliquerDecalageItp({
    semaineSemis: itp.semaineSemis,
    semainePlantation: itp.semainePlantation,
    semaineRecolte: itp.semaineRecolte,
    semaineImplantationDebut: itp.semaineImplantationDebut,
    semaineImplantationFin: itp.semaineImplantationFin,
    semaineRecolteFin: itp.semaineRecolteFin,
  }, dec)
}

function calculerDates(spec: Spec, c: number, itp: ItpLu): CultureCalculee {
  let dateSemis: Date | null, datePlantation: Date | null, dateRecolte: Date | null, finRecolte: Date | null
  if (spec.r) {
    dateSemis = spec.s ? jm(c, spec.s) : null
    datePlantation = spec.p ? jm(c, spec.p) : null
    dateRecolte = jm(c, spec.r)
    finRecolte = spec.f ? jm(c, spec.f) : null
  } else {
    const sem = semainesItp(itp)
    const d = datesDepuisItp(c, { ...sem, dureeCulture: itp.dureeCulture, delaiPremiereRecolteAnnees: itp.delaiPremiereRecolteAnnees })
    dateSemis = utc(d.dateSemis)
    datePlantation = utc(d.datePlantation)
    dateRecolte = utc(d.dateRecolte)
    finRecolte = utc(finRecolteDepuisItp(d.dateRecolte, { ...sem, dureeRecolte: itp.dureeRecolte }))
    const n = (spec.pousser ?? 0) * 7
    if (n) {
      dateSemis = dateSemis && plusJours(dateSemis, n)
      datePlantation = datePlantation && plusJours(datePlantation, n)
      dateRecolte = dateRecolte && plusJours(dateRecolte, n)
      finRecolte = finRecolte && plusJours(finRecolte, n)
    }
  }
  return { ...spec, annee: c, especeId: itp.especeId!, dateSemis, datePlantation, dateRecolte, finRecolte }
}

/** Toutes les cultures implantées pendant la campagne `c`. */
async function planCampagne(c: number, etapes: Map<string, { rotation: string; etape: number; itp: string }>, itps: Map<string, ItpLu>) {
  const specs: Spec[] = [...plan_fixe()]
  for (const [planche, { rotation, etape, itp }] of etapes) {
    const n = ROTATIONS_NB.get(rotation)!
    // Étape de la planche pour la campagne c (règle de src/lib/rotation/etape-cycle.ts).
    const etapeC = ((((etape - 1) + (c - Y)) % n) + n) % n + 1
    const itpEtape = ROTATION_ITP.get(`${rotation}#${etapeC}`) ?? itp
    const p = PARAM_ITP[itpEtape]
    if (!p) { console.warn(`⚠ Paramètres manquants pour l'itinéraire de rotation ${itpEtape}`); continue }
    const suites = SUITES[rotation]?.[etapeC] ?? []
    for (const s of suites.filter((x) => x.avant)) specs.push({ planche, ...(PARAM_ITP[s.itp] ?? {}), ...s } as Spec)
    specs.push({ planche, itp: itpEtape, ...p })
    for (const s of suites.filter((x) => !x.avant)) specs.push({ planche, ...(PARAM_ITP[s.itp] ?? {}), ...s } as Spec)
  }
  const out: CultureCalculee[] = []
  for (const spec of specs) {
    const itp = itps.get(spec.itp)
    if (!itp?.especeId) { console.warn(`⚠ Itinéraire absent du référentiel : ${spec.itp}`); continue }
    out.push(calculerDates(spec, c, itp))
  }
  return out
}

const ROTATIONS_NB = new Map<string, number>()
const ROTATION_ITP = new Map<string, string>()

/** Contrôle : pas de chevauchement sur une même portion de planche, pas d'alerte de saison. */
function controler(cultures: CultureCalculee[], itps: Map<string, ItpLu>) {
  const parPlanche = new Map<string, CultureCalculee[]>()
  for (const c of cultures) parPlanche.set(c.planche, [...(parPlanche.get(c.planche) ?? []), c])
  const debut = (c: CultureCalculee) => (c.datePlantation ?? c.dateSemis ?? c.dateRecolte)!.getTime()
  const fin = (c: CultureCalculee) => (c.finRecolte ?? plusJours(c.dateRecolte!, 28)).getTime()
  for (const [planche, liste] of parPlanche) {
    const longueurPlanche = planche.startsWith("A") ? 10 : planche.startsWith("C") ? 23 : 40
    for (const a of liste) {
      // Occupation au moment où `a` s'implante : deux demi-planches qui se
      // succèdent ne se cumulent pas.
      const t = debut(a)
      const occupe = liste.filter((b) => debut(b) <= t && fin(b) > t)
      const total = occupe.reduce((s, b) => s + (b.longueur ?? longueurPlanche), 0)
      if (total > longueurPlanche + 0.01) {
        console.warn(`⚠ Chevauchement sur ${planche} : ${occupe.map((b) => `${b.itp} ${b.annee}`).join(" / ")}`)
      }
    }
  }
  for (const c of cultures) {
    const itp = itps.get(c.itp)!
    const alerte = alerteSaisonCulture({ itp: { ...semainesItp(itp), implantation: itp.implantation }, dateSemis: c.dateSemis, datePlantation: c.datePlantation })
    if (alerte) console.warn(`⚠ Alerte de saison ${c.planche} ${c.itp} ${c.annee} : ${alerte.message}`)
  }
}

export async function seedMaraichage(ctx: Contexte) {
  const { userId } = ctx
  const planches = await prisma.planche.findMany({ where: { userId }, select: { id: true, nom: true, rotationId: true } })
  const plancheId = new Map(planches.map((p) => [p.nom, p.id]))

  // Étapes réellement affectées (rotation présente dans le référentiel).
  const details = await prisma.rotationDetail.findMany({ select: { rotationId: true, annee: true, itpId: true } })
  const rotations = await prisma.rotation.findMany({ select: { id: true, nbAnnees: true } })
  for (const r of rotations) ROTATIONS_NB.set(r.id, r.nbAnnees ?? Math.max(1, ...details.filter((d) => d.rotationId === r.id).map((d) => d.annee ?? 1)))
  for (const d of details) if (d.itpId && d.annee) ROTATION_ITP.set(`${d.rotationId}#${d.annee}`, d.itpId)
  const etapes = new Map<string, { rotation: string; etape: number; itp: string }>()
  for (const p of planches) {
    const r = ROTATIONS_PLANCHES[p.nom]
    if (!r || p.rotationId !== r[0]) continue
    const itp = ROTATION_ITP.get(`${r[0]}#${r[1]}`)
    if (itp) etapes.set(p.nom, { rotation: r[0], etape: r[1], itp })
  }

  const idsItp = new Set<string>([...Object.keys(PARAM_ITP), ...plan_fixe().map((s) => s.itp), ...ROTATION_ITP.values()])
  for (const suites of Object.values(SUITES)) for (const l of Object.values(suites)) for (const s of l) idsItp.add(s.itp)
  const itps = await chargerItps([...idsItp])

  // Campagnes Y-1 et Y en entier, plus les cultures d'hiver implantées en Y-2
  // et récoltées en Y-1 (poireaux, choux, mâche, ail…) : sans elles, un reseed
  // de janvier comparerait ses récoltes à un début d'année N-1 vide.
  const toutes: CultureCalculee[] = []
  for (const c of [Y - 2, Y - 1, Y]) {
    const plan = await planCampagne(c, etapes, itps)
    toutes.push(...(c === Y - 2 ? plan.filter((x) => (x.finRecolte ?? x.dateRecolte)!.getUTCFullYear() >= Y - 1) : plan))
  }
  controler(toutes, itps)

  const varietes = new Set((await prisma.variete.findMany({ where: { id: { in: toutes.map((c) => c.variete).filter((v): v is string => !!v) } }, select: { id: true } })).map((v) => v.id))
  const amap = ctx.clients.amap
  const recoltesPourCommerce: number[] = []
  let nbRecoltes = 0
  let nbCultures = 0

  for (const c of toutes.sort((a, b) => (a.datePlantation ?? a.dateSemis ?? a.dateRecolte)!.getTime() - (b.datePlantation ?? b.dateSemis ?? b.dateRecolte)!.getTime())) {
    const longueur = c.longueur ?? (c.planche.startsWith("A") ? 10 : c.planche.startsWith("C") ? 23 : 40)
    const engraisVert = c.rdt == null
    const enCroissanceEte = (c.datePlantation ?? c.dateSemis ?? c.dateRecolte)!.getUTCMonth() + 1
    const culture = await prisma.culture.create({
      data: {
        userId, especeId: c.especeId, varieteId: c.variete && varietes.has(c.variete) ? c.variete : null, itpId: c.itp,
        plancheId: plancheId.get(c.planche)!, annee: c.annee,
        dateSemis: c.dateSemis, datePlantation: c.datePlantation, dateRecolte: c.dateRecolte, finRecolte: c.finRecolte,
        semisFait: passe(c.dateSemis), plantationFaite: passe(c.datePlantation),
        recolteFaite: engraisVert && passe(c.dateRecolte),
        longueur, nbRangs: c.rangs, espacement: Math.round(c.esp), quantite: nbPlantsCulture(longueur, c.rangs, c.esp),
        aIrriguer: c.irriguee && (c.planche.startsWith("A") || c.planche.startsWith("C") || (enCroissanceEte >= 3 && enCroissanceEte <= 8)) ? true : null,
        notes: engraisVert ? "Engrais vert : la « récolte » est la destruction (broyage puis incorporation superficielle)." : null,
      },
    })
    nbCultures++
    if (!engraisVert && c.dateRecolte && passe(c.dateRecolte)) {
      const ids = await recolter(ctx, culture.id, c, longueur, amap)
      nbRecoltes += ids.total
      if (c.annee === Y) recoltesPourCommerce.push(...ids.enStock)
    }
    // Terminée quand la fenêtre de récolte est close (la veille au plus tard).
    if (c.finRecolte && c.finRecolte.getTime() < AUJ.getTime()) {
      await prisma.culture.update({ where: { id: culture.id }, data: { terminee: "x", recolteFaite: true } })
    }
  }

  await seedIrrigation(ctx)
  await seedSuiviCultural(ctx, plancheId)
  ctx.partage.maraichage = { recoltesPourCommerce }
  journal(`Maraîchage : ${nbCultures} cultures de ${Y - 2} à ${Y}, ${nbRecoltes} récoltes (${recoltesPourCommerce.length} lots en stock pour le commerce)`)
}

/** Passages hebdomadaires de récolte, puis vente comme le PATCH de l'app. */
async function recolter(ctx: Contexte, cultureId: number, c: CultureCalculee, longueur: number, amap: { id: number; nom: string }) {
  const r = alea(graine(`${c.planche}-${c.itp}-${c.annee}`))
  const debut = c.dateRecolte!
  const finFenetre = c.finRecolte ?? plusJours(debut, 28)
  const nbTotal = Math.max(1, Math.floor((finFenetre.getTime() - debut.getTime()) / (7 * 86_400_000)) + 1)
  const totalKg = (c.rdt ?? 0) * longueur * LARGEUR_PLANCHE
  const poids = Array.from({ length: nbTotal }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / nbTotal) + 0.35)
  const somme = poids.reduce((a, b) => a + b, 0)
  const entrees: Array<{ especeId: string; cultureId: number; date: Date; quantite: number }> = []
  for (let i = 0; i < nbTotal; i++) {
    const date = plusJours(debut, i * 7)
    if (date.getTime() > AUJ.getTime() || date.getTime() > finFenetre.getTime()) break
    // La ferme monte en charge : les saisons passées ont rendu 10 % de moins.
    const progression = date.getUTCFullYear() < Y ? 0.9 : 1
    const kg = round1((totalKg * poids[i]) / somme * (0.88 + r() * 0.24) * progression)
    if (kg <= 0) continue
    entrees.push({ especeId: c.especeId, cultureId, date, quantite: kg })
  }
  const ecrites: Array<{ id: number; date: Date; quantite: number; unite: string | null; especeId: string }> = []
  for (let i = 0; i < entrees.length; i += 20) {
    const prep = await preparerRecoltes(ctx.userId, entrees.slice(i, i + 20))
    if (!prep.ok) { console.warn(`⚠ Récoltes refusées (${c.planche} ${c.itp}) : ${prep.error}`); break }
    const res = await prisma.$transaction((tx) => ecrireRecoltesPreparees(tx, prep.recoltes))
    ecrites.push(...res.map((x) => ({ id: x.id, date: x.date, quantite: x.quantite, unite: x.unite ?? null, especeId: x.especeId })))
  }

  const enStock: number[] = []
  for (const [i, rec] of ecrites.entries()) {
    const garde = (c.garde ?? 0) > 0 && i >= Math.floor(ecrites.length * 0.35) && r() < (c.garde ?? 0)
    if (r() < 0.04) {
      await prisma.recolte.update({ where: { id: rec.id }, data: { statut: "consomme", notes: "Autoconsommation de la ferme" } })
      continue
    }
    // Légumes de garde : vendus au fil de l'hiver, sinon toujours en stock.
    const dateVente = garde ? plusJours(rec.date, 30 + Math.floor(r() * 110)) : rec.date
    if (dateVente.getTime() > AUJ.getTime()) {
      enStock.push(rec.id)
      continue
    }
    const marche = (i + c.annee) % 3 === 2
    const prixKg = round2((c.prix ?? 0) * (0.95 + r() * 0.1))
    const prixTotal = round2(rec.quantite * prixKg)
    if (prixTotal <= 0) continue
    const client = marche ? { clientId: null, clientNom: "Marché de Montaigu" } : { clientId: amap.id, clientNom: amap.nom }
    await prisma.$transaction(async (tx) => {
      await tx.recolte.update({ where: { id: rec.id }, data: { statut: "vendu", dateVente, prixKg, prixTotal, ...client } })
      const vente = await createVenteFromRecolte(ctx.userId, { id: rec.id, especeId: rec.especeId, quantite: rec.quantite, unite: rec.unite, prixKg, prixTotal, dateVente, ...client }, tx)
      if (vente) await tx.venteManuelle.update({ where: { id: vente.id }, data: { modeReglement: marche ? "Espèces" : "Chèque" } })
    })
  }
  return { total: ecrites.length, enStock }
}

/** Arrosages notés (traces, comme l'app les écrit) : la veille pour les cultures sous abri en place. */
async function seedIrrigation(ctx: Contexte) {
  const enPlace = await prisma.culture.findMany({
    where: { userId: ctx.userId, aIrriguer: true, terminee: null, OR: [{ plantationFaite: true }, { semisFait: true }] },
    select: { id: true, planche: { select: { nom: true } } },
  })
  const hier = ilYa(1, 7)
  for (const c of enPlace) {
    // Tout est arrosé la veille : sous abri, une planche oubliée ressortirait
    // en « Urgent » (bilan hydrique critique sans pluie).
    await prisma.irrigationPlanifiee.create({ data: { userId: ctx.userId, cultureId: c.id, datePrevue: hier, dateEffective: hier, fait: true, notes: "Arrosage noté" } })
    await prisma.culture.update({ where: { id: c.id }, data: { derniereIrrigation: hier } })
  }
}

/** Analyses de sol, fumures de la ferme, interventions tracées, stock de semences. */
async function seedSuiviCultural(ctx: Contexte, plancheId: Map<string, string>) {
  const { userId } = ctx
  const analyses = [
    { nom: `Serre — analyse ${Y - 1}`, planche: "A2", argile: 14, limon: 41, sable: 45, ph: 6.8, matiereOrg: 4.9, cec: 11.2, n: 2.4, p: 0.21, k: 0.32, ca: 2.1, mg: 0.24 },
    { nom: `Tunnel — analyse ${Y - 1}`, planche: "C3", argile: 15, limon: 42, sable: 43, ph: 6.7, matiereOrg: 4.5, cec: 10.6, n: 2.2, p: 0.18, k: 0.29, ca: 2.0, mg: 0.22 },
    { nom: `Plein champ — analyse ${Y - 1}`, planche: "B6", argile: 24, limon: 46, sable: 30, ph: 6.4, matiereOrg: 3.6, cec: 13.8, n: 1.8, p: 0.12, k: 0.24, ca: 2.6, mg: 0.31 },
  ]
  for (const a of analyses) {
    const { planche, ...valeurs } = a
    await prisma.analyseSol.create({
      data: { userId, plancheId: plancheId.get(planche) ?? null, dateAnalyse: new Date(Date.UTC(Y - 1, 9, 14)), laboratoire: "Laboratoire Agro-Sol Ouest (Angers)", notes: "Sol bien pourvu en matière organique, pH favorable ; maintenir les apports de fumier composté.", ...valeurs },
    })
  }

  // Fumures : le fumier des brebis et des poules (ressource de la ferme, sans coût d'achat).
  for (const an of [Y - 1, Y]) {
    for (const [i, planche] of ["B1", "B2", "B5", "B9", "B12", "B15"].entries()) {
      const date = new Date(Date.UTC(an, 1, 10 + i * 3))
      if (!passe(date)) continue
      await prisma.fertilisation.create({ data: { userId, plancheId: plancheId.get(planche)!, fertilisantId: i % 3 === 2 ? "Fumier de poules" : "Fumier de mouton", date, quantite: i % 3 === 2 ? 60 : 150, notes: "Fumier composté de la ferme, épandu avant préparation de la planche." } })
    }
    for (const planche of ["A1", "A2", "A3", "C1", "C2", "C3", "C4"]) {
      const date = new Date(Date.UTC(an, 2, 2))
      if (!passe(date)) continue
      await prisma.fertilisation.create({ data: { userId, plancheId: plancheId.get(planche)!, fertilisantId: "Lombricompost", date, quantite: 25, notes: "Lombricompost sous abri avant les plantations de printemps." } })
    }
  }

  // Interventions de la campagne en cours (traçabilité et temps de travail).
  const cultures = await prisma.culture.findMany({ where: { userId, annee: Y }, select: { id: true, especeId: true, itpId: true, datePlantation: true, dateSemis: true, plancheId: true } })
  const trouver = (itp: string) => cultures.find((c) => c.itpId === itp)
  const interventions: Array<{ itp: string; type: string; jours: number; description: string; minutes: number; personnes?: number; phyto?: { produit: string; amm: string; cible: string; dose: number; unite: string; surface: number; dar: number } }> = [
    { itp: "INRAE-MESCLUN-0518", type: "tuteurage", jours: 10, description: "Palissage des tomates sur ficelle, gourmands retirés", minutes: 90, personnes: 2 },
    { itp: "INRAE-MESCLUN-0518", type: "ebourgeonnage", jours: 40, description: "Ébourgeonnage hebdomadaire", minutes: 45 },
    { itp: "INRAE-MESCLUN-0523", type: "tuteurage", jours: 12, description: "Tuteurage des tomates cerises", minutes: 120, personnes: 2 },
    { itp: "Tomate-printemps", type: "paillage", jours: 3, description: "Paillage de paille de la ferme", minutes: 120, personnes: 2 },
    { itp: "Tomate-printemps", type: "traitement_phyto", jours: 45, description: "Prévention du mildiou après orages", minutes: 40, phyto: { produit: "Bouillie bordelaise RSR Disperss", amm: "2000232", cible: "Mildiou (Phytophthora infestans)", dose: 3, unite: "kg/ha", surface: 48, dar: 3 } },
    { itp: "Courge-butternut", type: "paillage", jours: 5, description: "Paillage des courges", minutes: 90, personnes: 2 },
    { itp: "Carotte-ete-conservation-plein-champ", type: "desherbage", jours: 20, description: "Désherbage manuel du rang", minutes: 180, personnes: 2 },
    { itp: "Oignon-printemps", type: "binage", jours: 30, description: "Binage à la houe maraîchère", minutes: 75 },
    { itp: "INRAE-MESCLUN-0407", type: "binage", jours: 35, description: "Binage et buttage des poireaux", minutes: 120 },
  ]
  for (const it of interventions) {
    const c = trouver(it.itp)
    const base = c?.datePlantation ?? c?.dateSemis
    if (!c || !base) continue
    const date = plusJours(base, it.jours)
    if (!passe(date)) continue
    await prisma.intervention.create({
      data: {
        userId, date, type: it.type, cultureId: c.id, plancheId: c.plancheId, description: it.description, dureeMinutes: it.minutes, nbPersonnes: it.personnes ?? 1, fait: true,
        ...(it.phyto ? { produitPhyto: it.phyto.produit, numAMM: it.phyto.amm, cibleTraitement: it.phyto.cible, doseAppliquee: it.phyto.dose, uniteDose: it.phyto.unite, surfaceTraitee: it.phyto.surface, dar: it.phyto.dar, conditionsMeteo: "Temps couvert, vent faible", ventKmh: 8, temperatureC: 19 } : {}),
      },
    })
  }
  // Deux travaux à venir, visibles dans le journal.
  for (const [itp, jours, type, description] of [
    ["INRAE-MESCLUN-0009", 25, "paillage", "Paillage de l'ail après la levée"],
    ["INRAE-MESCLUN-0228", 3, "arrosage", "Arrosage de reprise de la mâche"],
  ] as const) {
    const c = trouver(itp)
    const base = c?.datePlantation ?? c?.dateSemis
    if (!c || !base) continue
    const datePrevue = plusJours(base, jours)
    if (passe(datePrevue)) continue
    await prisma.intervention.create({ data: { userId, date: datePrevue, datePrevue, type, cultureId: c.id, plancheId: c.plancheId, description, fait: false } })
  }

  // Stock de semences (graines en g, prix au gramme).
  const semences: Array<[string, number, number, number]> = [
    ["Carotte Nantaise", 120, 40, 0.35], ["Carotte Touchon", 90, 40, 0.38], ["Mâche verte", 260, 100, 0.12], ["Radis de 18 jours", 320, 100, 0.06],
    ["Épinard Géant d'Hiver", 420, 150, 0.05], ["Haricot Contender", 1500, 500, 0.03], ["Petit pois-Merveille de Kelvedon", 1800, 500, 0.025],
    ["Fève Aguadulce", 2600, 1000, 0.018], ["Poireau Bleu de Solaise", 35, 10, 1.1], ["Laitue Batavia", 14, 5, 2.4], ["Tomate Coeur de Boeuf", 3, 1, 9.5], ["Basilic Grand Vert", 18, 5, 1.6],
  ]
  for (const [varieteId, stockGraines, stockMinGraines, coutUnitaire] of semences) {
    const v = await prisma.variete.findUnique({ where: { id: varieteId }, select: { id: true } })
    if (!v) continue
    await prisma.userStockVariete.create({ data: { userId, varieteId, stockGraines, stockMinGraines, coutUnitaire, uniteStock: null, dateStock: new Date(Date.UTC(Y, 0, 20)) } })
  }
  void minuit
  void NOW
}
