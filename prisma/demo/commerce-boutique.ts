/**
 * Boutique en ligne « Ferme du Bois Joli » : catalogue et commandes.
 *
 * Les commandes suivent le vrai chemin de l'application, dans l'ordre de leur
 * date : création comme la route publique (prix figés, numéro CMD-AAAA-NNNN
 * par producteur et par année, jeton de suivi), puis changements de statut
 * comme l'écran Boutique (PATCH : `livrerCommandeBoutique` à la livraison,
 * `annulerCommandeBoutique` à l'annulation) et confirmation de paiement
 * (`confirmCommandeBoutique`). La livraison décrémente le stock, crée la
 * fiche client et la vente AUTOMATIQUE du module boutique ; un chèque ou un
 * virement est ensuite rapproché du relevé par le module banque, ce qui
 * solde la vente et confirme le paiement de la commande.
 *
 * Retrait à la ferme le mercredi de 17 h à 19 h ; une commande toutes les
 * quatre semaines environ, sur l'année passée et l'année en cours. Les plus
 * récentes montrent tous les états : livrée impayée, payée par virement en
 * attente de rapprochement, annulée, prête, nouvelle.
 */

import { randomBytes } from "node:crypto"
import { annulerCommandeBoutique, confirmCommandeBoutique, livrerCommandeBoutique } from "../../src/lib/commande-boutique"
import { alea, graine, IDENTITE, journal, prisma, Y, type Contexte } from "./contexte"
import {
  AUJ_ISO, aHeure, ajouterOperation, centimes, dernier, ilYaIso, isoPlus, ouvreSuivant, prochain,
} from "./commerce-outils"

type Produit = { cle: string; nom: string; description: string; prix: number; unite: string; categorie: string; stock: number | null; stockFinal: number | null; ordre: number }

/** Prix TTC en multiples de 0,50 € : quantité × prix reste exact en binaire. */
const PRODUITS: Produit[] = [
  { cle: "panier", nom: "Panier de légumes de saison", description: "Six à huit légumes bio du moment, environ 5 kg, cueillis le matin du retrait.", prix: 20, unite: "panier", categorie: "legumes", stock: null, stockFinal: null, ordre: 1 },
  { cle: "demi", nom: "Demi-panier de légumes", description: "Trois à quatre légumes bio du moment, environ 2,5 kg.", prix: 12, unite: "panier", categorie: "legumes", stock: null, stockFinal: null, ordre: 2 },
  { cle: "oeufs", nom: "Douzaine d'œufs bio", description: "Œufs de nos poules Marans élevées en plein air, ramassés dans la semaine.", prix: 6.5, unite: "douzaine", categorie: "oeufs", stock: 8, stockFinal: 6, ordre: 3 },
  { cle: "crottin", nom: "Crottin de chèvre frais", description: "Lait cru de nos Alpines, moulé à la louche, environ 90 g.", prix: 3.5, unite: "pièce", categorie: "transformations", stock: 18, stockFinal: 14, ordre: 4 },
  { cle: "buche", nom: "Bûche de chèvre cendrée", description: "Pâte lactique affinée trois semaines, environ 180 g.", prix: 6.5, unite: "pièce", categorie: "transformations", stock: 8, stockFinal: 5, ordre: 5 },
  { cle: "tomme", nom: "Tomme de chèvre (env. 350 g)", description: "Pâte pressée affinée deux mois en cave.", prix: 9, unite: "pièce", categorie: "transformations", stock: 6, stockFinal: 4, ordre: 6 },
  { cle: "miel", nom: "Miel de printemps (500 g)", description: "Récolté au rucher du verger, extrait à froid.", prix: 9.5, unite: "bocal", categorie: "miel", stock: 20, stockFinal: 11, ordre: 7 },
  { cle: "jus", nom: "Jus de pomme bio (1 L)", description: "Pommes du verger pressées à l'automne, pasteurisé.", prix: 4, unite: "L", categorie: "transformations", stock: 24, stockFinal: 16, ordre: 8 },
  { cle: "confiture", nom: "Confiture de prunes (250 g)", description: "Reines-claudes et mirabelles du verger, 60 % de fruits.", prix: 4.5, unite: "bocal", categorie: "transformations", stock: 15, stockFinal: 9, ordre: 9 },
]

/** Clients de la boutique ; les quatre premiers ont déjà leur fiche (identite.ts). */
const CLIENTS: Array<{ nom: string; email: string; tel: string }> = [
  { nom: "Linh Nguyen", email: "linh.nguyen@example.org", tel: "06 39 98 41 27" },
  { nom: "Marie Dubois", email: "marie.dubois@example.org", tel: "06 39 98 10 54" },
  { nom: "Jean Bertin", email: "jean.bertin@example.org", tel: "06 39 98 77 03" },
  { nom: "Claire Moreau", email: "claire.moreau@example.org", tel: "06 39 98 22 91" },
  { nom: "Paul Girard", email: "paul.girard@example.org", tel: "06 39 98 35 60" },
  { nom: "Sophie Martineau", email: "sophie.martineau@example.org", tel: "06 39 98 68 12" },
  { nom: "Hugo Bernier", email: "hugo.bernier@example.org", tel: "06 39 98 50 46" },
  { nom: "Nadia Benali", email: "nadia.benali@example.org", tel: "06 39 98 93 38" },
  { nom: "Yann Le Goff", email: "yann.legoff@example.org", tel: "06 39 98 14 85" },
]

type Fin = "payee-cheque" | "payee-especes" | "payee-virement" | "virement-a-rapprocher" | "impayee" | "annulee" | "prete" | "nouvelle"
interface CommandePrevue { creee: Date; retrait: string; fin: Fin; client: (typeof CLIENTS)[number]; lignes: Array<[string, number]> }

/** Contenu de saison : paniers d'avril à décembre, fromages de mars à décembre, jus et confitures d'octobre à mars. */
function panier(r: () => number, mois: number): Array<[string, number]> {
  const l: Array<[string, number]> = []
  const pick = <T,>(t: T[]) => t[Math.floor(r() * t.length)]
  if (mois >= 4) l.push([r() < 0.55 ? "panier" : "demi", 1])
  if (mois >= 3 && r() < 0.65) l.push(pick([["crottin", 2], ["crottin", 3], ["buche", 1], ["tomme", 1]] as Array<[string, number]>))
  if (r() < 0.45) l.push(["oeufs", 1])
  if ((mois >= 10 || mois <= 3) && r() < 0.7) l.push(pick([["jus", 2], ["jus", 3], ["confiture", 2]] as Array<[string, number]>))
  if ((mois >= 7 || mois <= 2) && r() < 0.35) l.push(["miel", 1])
  if (l.length === 0) l.push(["jus", 2], ["confiture", 1])
  return l
}

function plan(): CommandePrevue[] {
  const r = alea(graine("boutique-commandes"))
  const debut = `${Y - 1}-01-01`
  // Dernier mercredi passé (le retrait du jour n'a pas encore eu lieu).
  const w0 = dernier(3, ilYaIso(1))
  const cmds: CommandePrevue[] = []
  const client = (i: number) => CLIENTS[i % CLIENTS.length]
  const creation = (retrait: string, avant: number, heure: number) => aHeure(isoPlus(retrait, -avant), heure, Math.floor(r() * 50))
  let i = 0
  for (let k = 2; ; k += 4) {
    const retrait = isoPlus(w0, -7 * k)
    if (retrait < isoPlus(debut, 6)) break
    const mois = Number(retrait.slice(5, 7))
    const fin: Fin = (["payee-cheque", "payee-especes", "payee-cheque", "payee-virement"] as Fin[])[i % 4]
    cmds.push({ creee: creation(retrait, 1 + (i % 3), 18), retrait, fin, client: client(i * 4 + 3), lignes: panier(r, mois) })
    i++
  }
  const mois0 = Number(w0.slice(5, 7))
  cmds.push({ creee: creation(w0, 2, 19), retrait: w0, fin: "impayee", client: CLIENTS[2], lignes: panier(r, mois0) })
  cmds.push({ creee: creation(isoPlus(w0, -7), 3, 20), retrait: isoPlus(w0, -7), fin: "virement-a-rapprocher", client: CLIENTS[0], lignes: panier(r, mois0) })
  cmds.push({ creee: creation(isoPlus(w0, -7), 5, 9), retrait: isoPlus(w0, -7), fin: "annulee", client: CLIENTS[6], lignes: panier(r, mois0) })
  // Commandes en cours : retrait au prochain mercredi (aujourd'hui inclus).
  const suivant = prochain(3, AUJ_ISO)
  cmds.push({ creee: aHeure(ilYaIso(3), 17, 42), retrait: suivant, fin: "prete", client: CLIENTS[5], lignes: panier(r, mois0) })
  cmds.push({ creee: aHeure(ilYaIso(1), 20, 8), retrait: suivant, fin: "nouvelle", client: CLIENTS[3], lignes: panier(r, mois0) })
  return cmds.sort((a, b) => a.creee.getTime() - b.creee.getTime())
}

export async function seedBoutique(ctx: Contexte): Promise<{ commandes: number; ventes: number }> {
  const { userId } = ctx
  const slug = "ferme-du-bois-joli" + (ctx.clone ? `-${userId.slice(-6)}` : "")
  const boutique = await prisma.boutique.create({
    data: {
      userId, slug, nom: "Ferme du Bois Joli",
      description: "Légumes, œufs, fromages de chèvre, miel et jus de pomme bio de la ferme, à retirer le mercredi soir à la ferme.",
      descCourte: "Produits bio de la ferme, retrait le mercredi", couleurPrimaire: "#16a34a", couleurSecondaire: "#f59e0b",
      email: IDENTITE.email, telephone: IDENTITE.telephone, adresse: IDENTITE.adresse, ville: IDENTITE.ville, codePostal: IDENTITE.codePostal,
      horairesOuverture: "Retrait à la ferme le mercredi de 17 h à 19 h.",
      modesPaiement: "Espèces, chèque ou virement au retrait",
      modesLivraison: "Retrait à la ferme (mercredi 17 h – 19 h)",
      conditionsVente: "Commande jusqu'au mardi soir pour un retrait le mercredi. Produits issus de l'agriculture biologique (FR-BIO-01).",
      active: true,
    },
  })
  const produits = new Map<string, { id: number; p: Produit }>()
  for (const p of PRODUITS) {
    const row = await prisma.produitBoutique.create({
      data: { userId, boutiqueId: boutique.id, nom: p.nom, description: p.description, prix: p.prix, unite: p.unite, stockDispo: p.stock, categorie: p.categorie, ordre: p.ordre, actif: true, statutBio: "AB" },
    })
    produits.set(p.cle, { id: row.id, p })
  }

  const cmds = plan()
  const parAnnee = new Map<number, number>()
  const remises = new Map<string, Array<{ venteId: number; centimes: number }>>()
  let ventes = 0
  for (const c of cmds) {
    // Le producteur réassort son stock avant que la commande ne passe : la
    // route publique refuse toute quantité au-delà du disponible.
    for (const [cle, q] of c.lignes) {
      const { id, p } = produits.get(cle)!
      if (p.stock == null) continue
      const actuel = (await prisma.produitBoutique.findUniqueOrThrow({ where: { id } })).stockDispo ?? 0
      if (actuel < q) await prisma.produitBoutique.update({ where: { id }, data: { stockDispo: actuel + p.stock } })
    }
    const annee = c.creee.getUTCFullYear()
    const rang = (parAnnee.get(annee) ?? 0) + 1
    parAnnee.set(annee, rang)
    const lignes = c.lignes.map(([cle, quantite]) => {
      const { id, p } = produits.get(cle)!
      return { produitId: id, nom: p.nom, prixUnitaire: p.prix, unite: p.unite, quantite, total: p.prix * quantite }
    })
    const total = lignes.reduce((s, l) => s + l.total, 0)
    const cmd = await prisma.commandeBoutique.create({
      data: {
        userId, boutiqueId: boutique.id, numero: `CMD-${annee}-${String(rang).padStart(4, "0")}`, suiviToken: randomBytes(16).toString("hex"),
        clientNom: c.client.nom, clientEmail: c.client.email, clientTelephone: c.client.tel, total,
        modeLivraison: "Retrait à la ferme (mercredi 17 h – 19 h)", dateRetraitSouhaitee: aHeure(c.retrait, 15),
        statut: "nouveau", createdAt: c.creee, updatedAt: c.creee, lignes: { create: lignes },
      },
    })
    const statut = (s: string) => prisma.commandeBoutique.update({ where: { id: cmd.id }, data: { statut: s } })
    // Écran Boutique : « Livrée » matérialise la vente (stock, fiche client, écriture).
    const livrer = async () => {
      await prisma.$transaction((tx) => livrerCommandeBoutique(cmd.id, tx))
      await statut("livree")
      return (await prisma.commandeBoutique.findUniqueOrThrow({ where: { id: cmd.id } })).venteManuelleId!
    }
    if (c.fin === "nouvelle") continue
    if (c.fin === "annulee") {
      await statut("confirmee")
      await prisma.$transaction((tx) => annulerCommandeBoutique(cmd.id, "Annulé", tx))
      continue
    }
    if (c.fin === "prete") {
      await statut("confirmee")
      await statut("prete")
      continue
    }
    if (c.fin === "virement-a-rapprocher") {
      // Virement reçu le lendemain de la commande ; le producteur confirme le
      // paiement dans la Boutique sans importer son relevé.
      const recu = ouvreSuivant(isoPlus(c.creee.toISOString().slice(0, 10), 1))
      await prisma.$transaction((tx) => confirmCommandeBoutique(cmd.id, { provider: "Virement", ref: `VIR-${cmd.numero}` }, tx))
      await livrer()
      ventes++
      ajouterOperation(ctx, { jour: recu, libelle: `VIR SEPA RECU ${c.client.nom.toUpperCase()} ${cmd.numero}`, centimes: centimes(total), reglements: [], aRapprocherParLeVisiteur: true })
      continue
    }
    await statut("confirmee")
    if (c.fin !== "impayee") await statut("prete")
    const venteId = await livrer()
    ventes++
    if (c.fin === "payee-especes") {
      await prisma.$transaction((tx) => confirmCommandeBoutique(cmd.id, { provider: "Manuel" }, tx))
    } else if (c.fin === "payee-virement") {
      ajouterOperation(ctx, {
        jour: ouvreSuivant(isoPlus(c.retrait, 1)),
        libelle: `VIR SEPA RECU ${c.client.nom.toUpperCase()} ${cmd.numero}`,
        centimes: centimes(total),
        reglements: [{ cible: { type: "VenteManuelle", id: venteId }, centimes: centimes(total), mode: "Virement" }],
      })
    } else if (c.fin === "payee-cheque") {
      // Chèques remis en banque le vendredi qui suit le retrait.
      const remise = ouvreSuivant(isoPlus(c.retrait, 2))
      remises.set(remise, [...(remises.get(remise) ?? []), { venteId, centimes: centimes(total) }])
    }
  }
  let numeroRemise = 8812
  for (const [jour, cheques] of [...remises].sort(([a], [b]) => a.localeCompare(b))) {
    if (jour >= AUJ_ISO) continue
    const somme = cheques.reduce((s, ch) => s + ch.centimes, 0)
    ajouterOperation(ctx, {
      jour,
      libelle: `REMISE CHEQUES N° ${String(++numeroRemise).padStart(7, "0")} (${cheques.length} CHQ)`,
      centimes: somme,
      reglements: cheques.map((ch) => ({ cible: { type: "VenteManuelle" as const, id: ch.venteId }, centimes: ch.centimes, mode: "Chèque" as const })),
    })
  }

  // Inventaire du jour : le producteur recompte ses rayons.
  for (const { id, p } of produits.values()) {
    if (p.stockFinal != null) await prisma.produitBoutique.update({ where: { id }, data: { stockDispo: p.stockFinal } })
  }
  journal(`Boutique ${slug} : ${PRODUITS.length} produits, ${cmds.length} commandes (${ventes} livrées)`)
  return { commandes: cmds.length, ventes }
}
