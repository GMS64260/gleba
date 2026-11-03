/**
 * Clients professionnels : devis, bons de livraison, factures et avoir.
 *
 * Chaque ligne liée à un stock puise dans les lots que les autres modules
 * ont laissés au commerce (`ctx.partage`), après lecture du disponible réel
 * à la date du document (`chargerCatalogueStock`) ; un lot absent fait
 * simplement tomber la ligne, un document sans ligne n'est pas créé. Une
 * facture ne mélange pas les ateliers (sa ventilation par module suit ses
 * lignes de stock) et n'emploie que des unités Factur-X (kg, pièce).
 *
 * Le scénario est ancré sur le jour du reseed, chaque document glissant au
 * plus tôt à la date où son stock existe :
 * - restaurant : une facture réglée par virement (rapprochée), une facture
 *   échue depuis quelques jours dont le virement attend sur le relevé
 *   (« Relancer » sur l'accueil), un devis refusé ;
 * - épicerie : une facture, un avoir AV-0001 puis le solde réglé, un devis
 *   en cours de validité et une facture brouillon prête à émettre ;
 * - cantine : D-0001 accepté → BL-0001 livré → facture émise non échue,
 *   BL-0002 livré à facturer et un devis brouillon pour la suite.
 * Aucun envoi par courriel (refusé sur la démo).
 */

import type { ArticleStockCommercial } from "../../src/lib/commercial/stock-types"
import { chargerCatalogueStock } from "../../src/lib/commercial/catalogue-stock"
import { stockEstDenombrable } from "../../src/lib/commercial/stock-types"
import { dateCivile } from "../../src/lib/commercial/regles"
import { journal, prisma, type Contexte } from "./contexte"
import { agir, convertirEnLivraison, creerBrouillon, facturerDocuments, saisirFacture, type LigneSaisie } from "./commerce-documents"
import { aHeure, ajouterOperation, centimes, ilYaIso, isoPlus, ouvrePrecedent, ouvreSuivant } from "./commerce-outils"

type TypeLot = "recolte" | "fruit" | "transforme" | "fromage"
interface Lot { type: TypeLot; id: string; jour: string; nom: string; detail: string; numLot: string | null; unite: string; poidsPiece: number | null }

/** Prix HT de gros (€/kg ou €/pièce) choisis pour que les lignes tombent juste à 5,5 %. */
const PRIX_LEGUMES: Array<[RegExp, number]> = [[/carotte/i, 1.3], [/butternut|courge|potimarron/i, 1.6], [/haricot/i, 7.5], [/pomme de terre/i, 1.1], [/oignon/i, 1.4], [/^ail/i, 9], [/chalote/i, 6], [/poireau/i, 2.1]]
const PRIX_FRUITS: Array<[RegExp, number]> = [[/reinette/i, 2.4], [/golden/i, 2.1], [/boskoop/i, 2.2], [/conf[ée]rence|williams|poire/i, 2.6], [/mirabelle|reine.claude/i, 4.5], [/noix|noyer|franquette/i, 6.5]]
const prixDe = (table: Array<[RegExp, number]>, texte: string, defaut: number) => table.find(([m]) => m.test(texte))?.[1] ?? defaut

function prixFromage(l: Lot) {
  if (/crottin/i.test(l.nom)) return 2.5
  if (/b[ûu]che/i.test(l.nom)) return 5
  if (/frais|faisselle/i.test(l.nom)) return 2
  if (l.poidsPiece) return Math.max(2, Math.round(l.poidsPiece * 19 * 2) / 2)
  return 4
}

async function chargerLots(ctx: Contexte): Promise<Lot[]> {
  const p = ctx.partage as {
    maraichage?: { recoltesPourCommerce?: number[] }
    verger?: { lotsFruitsPourCommerce?: number[]; lotsTransformesPourCommerce?: number[] }
    elevage?: { lotsFromagePourCommerce?: string[] }
  }
  const lots: Lot[] = []
  const jj = (d: Date) => d.toISOString().slice(0, 10)
  const recoltes = p.maraichage?.recoltesPourCommerce ?? []
  if (recoltes.length) {
    for (const r of await prisma.recolte.findMany({ where: { userId: ctx.userId, id: { in: recoltes } }, include: { espece: { select: { nom: true } }, culture: { select: { variete: { select: { id: true, nom: true } } } } } })) {
      const espece = r.espece.nom || r.especeId
      const variete = r.culture.variete?.nom || r.culture.variete?.id || null
      lots.push({ type: "recolte", id: String(r.id), jour: jj(r.date), nom: espece, detail: variete && !variete.toLowerCase().startsWith(espece.toLowerCase()) ? `${espece} ${variete}` : (variete ?? espece), numLot: null, unite: r.unite || "kg", poidsPiece: null })
    }
  }
  const fruits = p.verger?.lotsFruitsPourCommerce ?? []
  if (fruits.length) {
    for (const f of await prisma.recolteArbre.findMany({ where: { userId: ctx.userId, id: { in: fruits } }, include: { arbre: { select: { espece: true, variete: true, nom: true } } } })) {
      lots.push({ type: "fruit", id: String(f.id), jour: jj(f.date), nom: `${f.arbre.espece ?? ""} ${f.arbre.variete ?? f.arbre.nom ?? ""}`.trim(), detail: f.arbre.variete ?? f.arbre.nom ?? "Fruits", numLot: f.numLot, unite: "kg", poidsPiece: null })
    }
  }
  const transformes = p.verger?.lotsTransformesPourCommerce ?? []
  if (transformes.length) {
    for (const t of await prisma.lotTransforme.findMany({ where: { userId: ctx.userId, id: { in: transformes } } })) {
      // Factur-X n'admet que unité, pièce, kg, g, L, h et lot : un pot reste hors facture.
      if (!["pièce", "piece", "unité", "unite", "kg", "l"].includes(t.unite.toLowerCase())) continue
      lots.push({ type: "transforme", id: String(t.id), jour: jj(t.date), nom: t.produit, detail: t.produit, numLot: t.numLot, unite: t.unite, poidsPiece: null })
    }
  }
  const fromages = p.elevage?.lotsFromagePourCommerce ?? []
  if (fromages.length) {
    for (const f of await prisma.lotFromage.findMany({ where: { userId: ctx.userId, id: { in: fromages } } })) {
      lots.push({ type: "fromage", id: f.id, jour: jj(f.dateFabrication), nom: f.typeFromage, detail: f.typeFromage, numLot: f.numeroLot, unite: "pièce", poidsPiece: f.nbPieces ? Number(f.poidsTotalKg) / f.nbPieces : null })
    }
  }
  return lots
}

/** Un souhait de ligne : une famille de lots, une quantité visée, un prix. */
interface Voeu { type: TypeLot; motif: RegExp; quantite: number; /** Part maximale du disponible d'un lot. */ part?: number }

/** Plus grande quantité ≤ q au pas du lot (entière pour un stock compté à la pièce). */
function quantiteExacte(q: number, _pu: number, pas: number) {
  return Math.max(0, Math.floor(q / pas + 1e-9) * pas)
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
/**
 * Factur-X recalcule la TVA de la facture sur la somme des HT de ses lignes
 * et la compare au total, somme des TVA arrondies ligne à ligne : on retire
 * au besoin une unité à la ligne dont l'arrondi s'écarte le plus.
 */
function ajusterPourFacturX(lignes: LigneSaisie[], pasDe: (l: LigneSaisie) => number) {
  for (let essai = 0; essai < 30; essai++) {
    const ht = lignes.map((l) => r2(l.quantite * l.prixUnitaire))
    const tvaLignes = r2(ht.reduce((s, h, i) => s + r2((h * lignes[i].tauxTVA) / 100), 0))
    const tvaGlobale = r2(ht.reduce((s, h, i) => s + (h * lignes[i].tauxTVA) / 100, 0))
    if (tvaLignes === tvaGlobale) return lignes
    const ecarts = ht.map((h, i) => Math.abs(r2((h * lignes[i].tauxTVA) / 100) - (h * lignes[i].tauxTVA) / 100))
    const i = ecarts.indexOf(Math.max(...ecarts))
    lignes[i] = { ...lignes[i], quantite: r2(lignes[i].quantite - pasDe(lignes[i])) }
    if (lignes[i].quantite <= 0) lignes.splice(i, 1)
  }
  return lignes
}

function prixDuLot(l: Lot) {
  if (l.type === "recolte") return prixDe(PRIX_LEGUMES, l.nom, 1.8)
  if (l.type === "fruit") return prixDe(PRIX_FRUITS, l.nom, 2.4)
  if (l.type === "transforme") return 3
  return prixFromage(l)
}

function descriptionDuLot(l: Lot) {
  const jjmm = `${l.jour.slice(8, 10)}/${l.jour.slice(5, 7)}`
  if (l.type === "recolte") return `${l.detail} bio — récolte du ${jjmm}`
  if (l.type === "fruit") return `${l.detail} bio, catégorie I — lot ${l.numLot ?? jjmm}`
  if (l.type === "transforme") return `${l.detail} — lot ${l.numLot}`
  return `${l.detail} de chèvre fermier au lait cru — lot ${l.numLot}`
}

class Stock {
  constructor(private userId: string, private lots: Lot[]) {}
  private cache = new Map<string, Map<string, ArticleStockCommercial>>()
  async catalogue(jour: string, frais = false) {
    if (!frais && this.cache.has(jour)) return this.cache.get(jour)!
    const articles = await chargerCatalogueStock(this.userId, prisma, dateCivile(jour))
    const mes = new Set(this.lots.map((l) => `${l.type}:${l.id}`))
    const m = new Map(articles.filter((a) => mes.has(`${a.type}:${a.id}`)).map((a) => [`${a.type}:${a.id}`, a]))
    this.cache.set(jour, m)
    return m
  }
  /** Lignes servies à la date `jour` (premiers lots arrivés d'abord). */
  async composer(jour: string, voeux: Voeu[], frais = false): Promise<LigneSaisie[]> {
    const dispo = await this.catalogue(jour, frais)
    const lignes: LigneSaisie[] = []
    const pris = new Map<string, number>()
    for (const v of voeux) {
      const candidats = this.lots.filter((l) => l.type === v.type && v.motif.test(`${l.nom} ${l.detail}`) && l.jour <= jour).sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id))
      // Un seul lot par souhait (traçabilité d'une ligne = un lot) : celui qui
      // sert le plus, le plus ancien à égalité.
      let meilleur: { l: Lot; a: ArticleStockCommercial; q: number; pu: number } | null = null
      for (const l of candidats) {
        const a = dispo.get(`${l.type}:${l.id}`)
        if (!a || a.disponible == null) continue
        const libre = a.disponible - (pris.get(a.id) ?? 0)
        const pas = stockEstDenombrable(a.unite) ? 1 : 0.5
        const pu = prixDuLot(l)
        const q = quantiteExacte(Math.min(v.quantite, libre * (v.part ?? 0.6)), pu, pas)
        if (q > 0 && (!meilleur || q > meilleur.q)) meilleur = { l, a, q, pu }
      }
      if (!meilleur) continue
      const { l, a, q, pu } = meilleur
      lignes.push({ articleStockType: l.type, articleStockId: l.id, description: descriptionDuLot(l), quantite: q, unite: a.unite, prixUnitaire: pu, tauxTVA: 5.5 })
      pris.set(a.id, (pris.get(a.id) ?? 0) + q)
    }
    return ajusterPourFacturX(lignes, (l) => (stockEstDenombrable(l.unite) ? 1 : 0.5))
  }
  /** Premier jour de [min, max] où au moins `minimum` lignes sont servies. */
  async premierJour(min: string, max: string, voeux: Voeu[], minimum = 1): Promise<string | null> {
    if (min > max) return null
    const jours = [...new Set([min, ...this.lots.filter((l) => l.jour > min && l.jour <= max).map((l) => l.jour)])].sort()
    for (const j of jours) if ((await this.composer(j, voeux)).length >= minimum) return j
    return null
  }
  invalider() { this.cache.clear() }
}

type Etape = { quand: Date; quoi: string; faire: () => Promise<void> }

/** Nom d'un tiers tel que l'écrit un relevé : majuscules sans accents. */
const banqueNom = (nom: string) => nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/^RESTAURANT /, "")

export async function seedB2B(ctx: Contexte): Promise<{ documents: number; factures: number }> {
  const { userId } = ctx
  const lots = await chargerLots(ctx)
  const stock = new Stock(userId, lots)
  const J = ilYaIso
  const resto = ctx.clients.restaurant, epicerie = ctx.clients.epicerie, cantine = ctx.clients.cantine
  const etapes: Etape[] = []
  const notes: string[] = []
  let documents = 0, factures = 0

  /** Choisit la première alternative servie dans la fenêtre, au plus tôt après `cible`. */
  async function planifier(cible: string, max: string, alternatives: Voeu[][], minimum = 1) {
    for (const voeux of alternatives) {
      const j = await stock.premierJour(cible, max, voeux, minimum)
      if (!j) continue
      // Un jour ouvré : pas de livraison ni de facture le dimanche.
      const ouvre = ouvreSuivant(j) <= max ? ouvreSuivant(j) : ouvrePrecedent(max) >= j ? ouvrePrecedent(max) : j
      return { jour: ouvre, voeux }
    }
    return null
  }
  const ajouter = (quand: Date, quoi: string, faire: () => Promise<void>) => etapes.push({ quand, quoi, faire })
  async function lignesAu(jour: string, voeux: Voeu[], quoi: string) {
    stock.invalider()
    const l = await stock.composer(jour, voeux, true)
    if (!l.length) notes.push(`${quoi} : stock épuisé, document non créé`)
    return l
  }

  const fromages = (q: number): Voeu[] => [{ type: "fromage", motif: /crottin/i, quantite: q * 2 }, { type: "fromage", motif: /b[ûu]che|tomme|brique/i, quantite: q }]

  // ── Restaurant : facture réglée par virement (rapprochée) ────────────────
  const fa = await planifier(J(70), J(36), [fromages(10), [{ type: "recolte", motif: /butternut|courge/i, quantite: 20, part: 0.8 }, { type: "recolte", motif: /haricot|ail|chalote|oignon/i, quantite: 2.5, part: 0.9 }, { type: "recolte", motif: /carotte/i, quantite: 20, part: 0.7 }], [{ type: "fruit", motif: /reinette|golden|conf[ée]rence|poire/i, quantite: 12 }, { type: "fruit", motif: /mirabelle|noix|noyer|franquette/i, quantite: 3 }]], 2)
  if (fa) {
    const quand = aHeure(fa.jour, 9, 10)
    ajouter(quand, "facture restaurant réglée", async () => {
      const lignes = await lignesAu(fa.jour, fa.voeux, "Facture restaurant")
      if (!lignes.length) return
      const f = await saisirFacture(userId, { type: "facture", statut: "emise", clientId: resto.id, jour: fa.jour, echeance: isoPlus(fa.jour, 30),
        objet: "Livraison de la semaine — cuisine du restaurant", notes: "Règlement par virement à 30 jours (RIB en pied de facture).", lignes })
      factures++
      const paiement = ouvreSuivant(isoPlus(fa.jour, 32))
      ajouterOperation(ctx, { jour: paiement, libelle: `VIR SEPA RECU ${banqueNom(resto.nom)} ${f.numero}`, centimes: centimes(f.totalTTC),
        reglements: [{ cible: { type: "Facture", id: f.id }, centimes: centimes(f.totalTTC), mode: "Virement" }] })
    })
  } else notes.push("Facture restaurant réglée : aucun stock disponible")

  // ── Épicerie : facture, avoir, solde réglé ──────────────────────────────
  const fc = await planifier(J(50), J(9), [[
    { type: "fruit", motif: /boskoop|golden|reinette/i, quantite: 30, part: 0.8 }, { type: "fruit", motif: /conf[ée]rence|poire|mirabelle/i, quantite: 10, part: 0.8 },
    { type: "fruit", motif: /noix|noyer|franquette/i, quantite: 4, part: 0.8 }, { type: "transforme", motif: /jus/i, quantite: 18 },
  ]], 3)
  if (fc) {
    ajouter(aHeure(fc.jour, 10, 5), "facture épicerie et avoir", async () => {
      const lignes = await lignesAu(fc.jour, fc.voeux, "Facture épicerie")
      if (!lignes.length) return
      const f = await saisirFacture(userId, { type: "facture", statut: "emise", clientId: epicerie.id, jour: fc.jour, echeance: isoPlus(fc.jour, 30),
        objet: "Fruits et jus du verger — livraison en magasin", notes: "Règlement par virement à 30 jours.", lignes })
      factures++
      // Avoir : une cagette arrivée abîmée, reprise sur la ligne de fruits la plus fragile.
      const fragile = f.lignes.find((l) => /conf[ée]rence|poire|mirabelle/i.test(l.description)) ?? f.lignes.find((l) => l.unite === "kg") ?? f.lignes[0]
      const qAvoir = fragile.unite === "kg" ? Math.min(fragile.quantite, quantiteExacte(4, fragile.prixUnitaire, 0.5) || 2) : 1
      const jourAvoir = ouvreSuivant(isoPlus(fc.jour, 3))
      const av = await saisirFacture(userId, { type: "avoir", statut: "emise", clientId: epicerie.id, jour: jourAvoir, factureOrigineId: f.id,
        objet: `Avoir sur ${f.numero} — marchandise abîmée au transport`, notes: `Reprise de ${qAvoir} ${fragile.unite} constatés abîmés à la réception (bon de réception de l'épicerie).`,
        lignes: [{ description: `Reprise : ${fragile.description.split(" — ")[0]} abîmés au transport`, quantite: qAvoir, unite: fragile.unite, prixUnitaire: fragile.prixUnitaire, tauxTVA: fragile.tauxTVA as 0 | 2.1 | 5.5 | 10 | 20 }] })
      factures++
      const solde = centimes(f.totalTTC) - centimes(av.totalTTC)
      let paiement = ouvreSuivant(isoPlus(fc.jour, 31))
      if (paiement >= J(1)) paiement = ouvrePrecedent(J(2))
      if (paiement <= jourAvoir) paiement = ouvreSuivant(isoPlus(jourAvoir, 1))
      ajouterOperation(ctx, { jour: paiement, libelle: `VIR SEPA RECU ${banqueNom(epicerie.nom)} ${f.numero} ${av.numero}`, centimes: solde,
        reglements: [{ cible: { type: "Facture", id: f.id }, centimes: solde, mode: "Virement" }] })
    })
  } else notes.push("Facture épicerie : aucun stock disponible")

  // ── Restaurant : facture échue, virement reçu hier, à rapprocher ─────────
  const jourVirement = ouvrePrecedent(J(1))
  const fb = await planifier(J(42), isoPlus(jourVirement, -33), [fromages(8), [{ type: "recolte", motif: /butternut|courge/i, quantite: 14, part: 0.8 }, { type: "recolte", motif: /carotte/i, quantite: 25, part: 0.7 }]], 2)
  if (fb) {
    ajouter(aHeure(fb.jour, 9, 40), "facture restaurant échue", async () => {
      const lignes = await lignesAu(fb.jour, fb.voeux, "Facture restaurant échue")
      if (!lignes.length) return
      const f = await saisirFacture(userId, { type: "facture", statut: "emise", clientId: resto.id, jour: fb.jour, echeance: isoPlus(fb.jour, 30),
        objet: "Livraison de la semaine — cuisine du restaurant", notes: "Règlement par virement à 30 jours (RIB en pied de facture).", lignes })
      factures++
      ajouterOperation(ctx, { jour: jourVirement, libelle: `VIR SEPA RECU ${banqueNom(resto.nom)} ${f.numero}`, centimes: centimes(f.totalTTC), reglements: [], aRapprocherParLeVisiteur: true })
    })
  } else notes.push("Facture restaurant échue : aucun stock disponible")

  // ── Cantine : D-0001 accepté → BL-0001 livré → facture émise non échue ───
  const voeuxCantine: Voeu[] = [{ type: "recolte", motif: /carotte.*touchon|touchon/i, quantite: 40, part: 0.85 }, { type: "recolte", motif: /carotte.*nantaise|nantaise/i, quantite: 20, part: 0.85 }, { type: "recolte", motif: /butternut|courge/i, quantite: 15, part: 0.8 }, { type: "recolte", motif: /pomme de terre|oignon/i, quantite: 30, part: 0.8 }]
  const liv = await planifier(J(14), J(5), [voeuxCantine], 2)
  let jourLivraison1: string | null = null
  if (liv) {
    jourLivraison1 = liv.jour
    const emission = ouvrePrecedent(isoPlus(liv.jour, -16))
    const accord = ouvrePrecedent(isoPlus(liv.jour, -12))
    const conversion = ouvrePrecedent(isoPlus(liv.jour, -2))
    const facturation = ouvreSuivant(isoPlus(liv.jour, 2)) < J(0) ? ouvreSuivant(isoPlus(liv.jour, 2)) : ouvrePrecedent(J(1))
    let devisId = "", blId = ""
    ajouter(aHeure(emission, 8, 30), "devis cantine", async () => {
      const lignes = await lignesAu(liv.jour, liv.voeux, "Devis cantine")
      if (!lignes.length) return
      const d = await creerBrouillon(userId, { type: "devis", clientId: cantine.id, date: emission, dateValidite: isoPlus(emission, 30), dateLivraison: liv.jour,
        objet: "Légumes bio de conservation — menus de la quinzaine", notes: "Livraison en cuisine centrale le matin avant 9 h. Prix fermes jusqu'à la date de validité.",
        adresseLivraison: "", categorieOperation: "biens", lignes })
      await agir(userId, d.id, "emettre", aHeure(emission, 8, 45))
      devisId = d.id
      documents++
    })
    ajouter(aHeure(accord, 14, 0), "accord cantine", async () => { if (devisId) await agir(userId, devisId, "accepter", aHeure(accord, 14, 0)) })
    ajouter(aHeure(conversion, 16, 0), "BL cantine", async () => {
      if (!devisId) return
      blId = (await convertirEnLivraison(userId, devisId, aHeure(conversion, 16, 0))).id
      documents++
    })
    ajouter(aHeure(liv.jour, 7, 30), "livraison cantine", async () => { if (blId) await agir(userId, blId, "livrer", aHeure(liv.jour, 7, 30)) })
    ajouter(aHeure(facturation, 9, 0), "facture cantine", async () => {
      if (!blId) return
      await facturerDocuments(userId, [blId], aHeure(facturation, 9, 0), isoPlus(facturation, 45))
      factures++
    })
  } else notes.push("Cantine D-0001 / BL-0001 : aucun stock disponible")

  // ── Cantine : BL-0002 livré, à facturer en fin de mois ───────────────────
  const min2 = jourLivraison1 && isoPlus(jourLivraison1, 7) > J(3) ? isoPlus(jourLivraison1, 7) : J(3)
  const liv2 = await planifier(min2, J(1), [voeuxCantine.map((v) => ({ ...v, quantite: Math.round(v.quantite * 0.8) }))], 2)
  if (liv2) {
    const emission = ouvrePrecedent(isoPlus(liv2.jour, -1))
    let blId = ""
    ajouter(aHeure(emission, 17, 0), "BL cantine 2", async () => {
      const lignes = await lignesAu(liv2.jour, liv2.voeux, "BL cantine 2")
      if (!lignes.length) return
      const d = await creerBrouillon(userId, { type: "livraison", clientId: cantine.id, date: emission, dateValidite: null, dateLivraison: liv2.jour,
        objet: "Légumes bio de conservation — livraison hebdomadaire", notes: "Livraison en cuisine centrale le matin avant 9 h.", adresseLivraison: "", categorieOperation: "biens", lignes })
      await agir(userId, d.id, "emettre", aHeure(emission, 17, 10))
      blId = d.id
      documents++
    })
    ajouter(aHeure(liv2.jour, 7, 45), "livraison cantine 2", async () => { if (blId) await agir(userId, blId, "livrer", aHeure(liv2.jour, 7, 45)) })
  }

  // ── Restaurant : devis refusé ────────────────────────────────────────────
  const dr = await planifier(J(25), J(15), [fromages(12), [{ type: "recolte", motif: /butternut|courge/i, quantite: 12, part: 0.8 }, { type: "recolte", motif: /carotte/i, quantite: 30, part: 0.8 }, { type: "recolte", motif: /haricot/i, quantite: 1, part: 0.9 }]])
  if (dr) {
    const refus = ouvreSuivant(isoPlus(dr.jour, 7))
    let id = ""
    ajouter(aHeure(dr.jour, 11, 0), "devis restaurant", async () => {
      const lignes = await lignesAu(dr.jour, dr.voeux, "Devis restaurant")
      if (!lignes.length) return
      const d = await creerBrouillon(userId, { type: "devis", clientId: resto.id, date: dr.jour, dateValidite: isoPlus(dr.jour, 30), dateLivraison: null,
        objet: "Proposition pour la carte d'automne", notes: "Volumes hebdomadaires à confirmer selon la carte.", adresseLivraison: "", categorieOperation: "biens", lignes })
      await agir(userId, d.id, "emettre", aHeure(dr.jour, 11, 15))
      id = d.id
      documents++
    })
    ajouter(aHeure(refus, 15, 30), "refus restaurant", async () => { if (id) await agir(userId, id, "refuser", aHeure(refus, 15, 30)) })
  }

  // ── Épicerie : devis émis, encore valide ─────────────────────────────────
  const de = await planifier(J(6), J(2), [[{ type: "transforme", motif: /jus/i, quantite: 24, part: 0.7 }, { type: "fruit", motif: /boskoop|golden|reinette/i, quantite: 20 }, { type: "fruit", motif: /noix|noyer|franquette/i, quantite: 4 }]])
  if (de) {
    ajouter(aHeure(de.jour, 10, 30), "devis épicerie", async () => {
      const lignes = await lignesAu(de.jour, de.voeux, "Devis épicerie")
      if (!lignes.length) return
      const d = await creerBrouillon(userId, { type: "devis", clientId: epicerie.id, date: de.jour, dateValidite: isoPlus(de.jour, 30), dateLivraison: null,
        objet: "Commande de fin d'année — jus, pommes et noix", notes: "Livraison possible le mardi matin.", adresseLivraison: "", categorieOperation: "biens", lignes })
      await agir(userId, d.id, "emettre", aHeure(de.jour, 10, 45))
      documents++
    })
  }

  // ── Brouillons de la veille : devis cantine, facture épicerie ───────────
  const veille = J(1)
  ajouter(aHeure(veille, 18, 0), "devis brouillon cantine", async () => {
    const livraison = isoPlus(veille, 9)
    const lignes = await lignesAu(veille, voeuxCantine.slice(0, 2), "Devis brouillon cantine")
    if (!lignes.length) return
    await creerBrouillon(userId, { type: "devis", clientId: cantine.id, date: veille, dateValidite: isoPlus(veille, 30), dateLivraison: livraison,
      objet: "Légumes bio de conservation — menus de la quinzaine suivante", notes: "À relire avec le chef de cuisine avant envoi.", adresseLivraison: "", categorieOperation: "biens", lignes })
    documents++
  })
  ajouter(aHeure(veille, 18, 20), "facture brouillon épicerie", async () => {
    const lignes = await lignesAu(veille, [{ type: "fruit", motif: /noix|noyer|franquette/i, quantite: 3 }, { type: "transforme", motif: /jus/i, quantite: 12, part: 0.5 }], "Facture brouillon épicerie")
    if (!lignes.length) return
    await saisirFacture(userId, { type: "facture", statut: "brouillon", clientId: epicerie.id, jour: veille, echeance: isoPlus(veille, 30),
      objet: "Réassort du magasin — noix et jus de pomme", notes: "Règlement par virement à 30 jours.", lignes })
    factures++
  })

  for (const e of etapes.sort((a, b) => a.quand.getTime() - b.quand.getTime())) await e.faire()
  for (const n of notes) console.log(`  · ${n}`)
  journal(`Clients professionnels : ${documents} devis et bons, ${factures} factures et avoirs (${lots.length} lots de stock proposés)`)
  return { documents, factures }
}
