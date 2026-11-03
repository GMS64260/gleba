/**
 * Charges réelles de l'EARL : factures fournisseurs, cotisations, abonnements.
 *
 * Ce sont des `DepenseManuelle` comptables saisies comme dans Comptabilité >
 * Transactions (HT et TVA de la facture, fournisseur, numéro de pièce), aux
 * catégories que proposent à la fois l'écran et le plan comptable : `materiel`
 * (immobilisation 215400) n'est jamais employé, ni `engrais`, `intrants`,
 * `achats` ou `alimentation`, qui tombent en 658000. Les factures d'aliment
 * de la coopérative sont les vraies pièces d'achat ; les consommations de
 * l'élevage restent des coûts internes (`comptable: false`) de leur module.
 *
 * Calendrier réel : chaque charge tombe à sa date (prélèvement MSA le 5,
 * électricité le 12, fermage à la Saint-Martin…), décalée au jour ouvré
 * suivant comme le ferait la banque. Une pièce réglée par la banque naît « à
 * payer » et le module banque rapproche l'opération du relevé (règlement
 * daté du relevé) ; un achat en espèces est payé tout de suite ; la dernière
 * facture de la coopérative, payable à 30 jours, reste à crédit.
 */

import { alea, graine, IDENTITE, journal, NOW, prisma, Y, type Contexte } from "./contexte"
import {
  AUJ_ISO, ajouterOperation, depuisHT, finDeMois, ilYaIso, isoDe, isoPlus, midi,
  ouvrePrecedent, ouvreSuivant, centimes, type ModeBancaire,
} from "./commerce-outils"

/** Ajustement global des montants (calibrage de la marge du compte entier). */
const ECHELLE = 1

type Mode = ModeBancaire | "Espèces"
interface Charge {
  famille: string
  /** Date de la pièce (facture, échéance). */
  jour: string
  /** Jour de débit bancaire (null : espèces, ou facture encore à crédit). */
  paiement: string | null
  mode: Mode
  categorie: string
  module: "potager" | "verger" | "elevage" | "autre"
  description: string
  fournisseur: string
  ref: string
  ht: number
  taux: number
  libelleBanque: string
  echeance?: string
  aCredit?: boolean
  /** Prélèvement déjà pointé payé, laissé au visiteur pour le rapprochement. */
  laisseeAuVisiteur?: boolean
}

const MOIS_COURTS = ["JANV", "FEVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOUT", "SEPT", "OCT", "NOV", "DEC"]
const jjmm = (j: string) => `${j.slice(8, 10)}/${j.slice(5, 7)}`

/** Montant HT tiré autour d'une base, au centime, reproductible. */
function tirage(r: () => number, base: number, ecart = 0.12) {
  return Math.round(base * ECHELLE * (1 - ecart + 2 * ecart * r()) * 100) / 100
}

/** Toutes les charges d'un exercice, réglées au plus tard hier. */
function chargesDeLAnnee(annee: number, inflation: number): Charge[] {
  const out: Charge[] = []
  const r = alea(graine(`charges-${annee}`))
  const prix = (base: number, ecart?: number) => tirage(r, base * inflation, ecart)
  let cheque = annee === Y ? 4518 : 4471
  const numeroCheque = () => String(++cheque).padStart(7, "0")

  for (let mois = 1; mois <= 12; mois++) {
    const m = String(mois).padStart(2, "0")
    // MSA : appels provisionnels mensualisés, prélevés le 5.
    const msa = ouvreSuivant(isoDe(annee, mois, 5))
    out.push({ famille: "msa", jour: msa, paiement: msa, mode: "Prélèvement", categorie: "msa", module: "autre",
      description: `Cotisations sociales des exploitants — échéance de ${MOIS_COURTS[mois - 1].toLowerCase()}.`,
      fournisseur: "MSA Loire-Atlantique – Vendée", ref: `MSA-${annee}-${m}`, ht: Math.round(612 * inflation * ECHELLE * 100) / 100, taux: 0,
      libelleBanque: `PRLV SEPA MSA LOIRE-ATLANTIQUE VENDEE ECH ${m}/${annee}` })
    // Électricité : mensualisation prélevée le 12 (hiver plus chargé : chambre froide + éclairage chèvrerie).
    const edf = ouvreSuivant(isoDe(annee, mois, 12))
    const saison = [1.25, 1.2, 1.05, 0.95, 0.9, 0.95, 1.05, 1.05, 0.9, 0.95, 1.1, 1.2][mois - 1]
    out.push({ famille: "electricite", jour: edf, paiement: edf, mode: "Prélèvement", categorie: "energie", module: "autre",
      description: "Électricité — chambre froide, fromagerie et chèvrerie (mensualité).", fournisseur: "Énergies du Bocage (électricité pro)",
      ref: `ELEC-${annee}${m}-0287`, ht: prix(152 * saison, 0.05), taux: 20, libelleBanque: `PRLV SEPA ENERGIES DU BOCAGE MENSUALITE ${m}/${annee}` })
    // Téléphone et internet le 20.
    const tel = ouvreSuivant(isoDe(annee, mois, 20))
    out.push({ famille: "telecom", jour: tel, paiement: tel, mode: "Prélèvement", categorie: "abonnement", module: "autre",
      description: "Box internet et forfait mobile professionnel.", fournisseur: "Télécom Ouest Pro", ref: `TEL-${annee}${m}-7741`,
      ht: Math.round(45.82 * ECHELLE * 100) / 100, taux: 20, libelleBanque: `PRLV SEPA TELECOM OUEST PRO FACT ${m}${String(annee).slice(2)}` })
    // Frais bancaires : arrêté de fin de mois.
    const fb = ouvrePrecedent(finDeMois(annee, mois))
    out.push({ famille: "frais-bancaires", jour: fb, paiement: fb, mode: "Prélèvement", categorie: "abonnement", module: "autre",
      description: "Frais de tenue de compte et cotisation carte professionnelle.", fournisseur: IDENTITE.banque,
      ref: `RELEVE-${annee}-${m}`, ht: 16.9, taux: 0, libelleBanque: `FRAIS TENUE DE COMPTE ET CARTE ${MOIS_COURTS[mois - 1]}` })
    // Aliment du bétail : facture de fin de mois de la coopérative, payée par virement à 30 jours.
    const coop = finDeMois(annee, mois)
    const besoin = [1.35, 1.4, 1.3, 1.05, 0.75, 0.7, 0.7, 0.75, 0.9, 1.05, 1.15, 1.3][mois - 1]
    out.push({ famille: "aliments", jour: coop, paiement: ouvreSuivant(isoPlus(coop, 30)), mode: "Virement", categorie: "aliments", module: "elevage",
      description: "Aliments bio : granulés chèvre laitière, luzerne déshydratée, aliment pondeuses.",
      fournisseur: "Coopérative agricole du Bocage", ref: `FA${String(annee).slice(2)}${m}-0${410 + mois}`, ht: prix(430 * besoin, 0.08), taux: 10,
      echeance: isoPlus(coop, 30), libelleBanque: `VIR SEPA EMIS COOP AGRICOLE DU BOCAGE FA${String(annee).slice(2)}${m}-0${410 + mois}` })
  }

  // Trimestriels : assurance (le 10 du premier mois), honoraires comptables (le 15 du dernier mois).
  for (const t of [1, 4, 7, 10]) {
    const j = ouvreSuivant(isoDe(annee, t, 10))
    out.push({ famille: "assurance", jour: j, paiement: j, mode: "Prélèvement", categorie: "autre", module: "autre",
      description: "Multirisque exploitation et responsabilité civile — échéance trimestrielle.", fournisseur: "Mutuelle agricole du Bocage",
      ref: `ASS-${annee}-T${(t + 2) / 3}`, ht: Math.round(291.4 * inflation * ECHELLE * 100) / 100, taux: 0,
      libelleBanque: `PRLV SEPA MUTUELLE AGRICOLE BOCAGE CONTRAT 4471 T${(t + 2) / 3}` })
  }
  for (const t of [3, 6, 9, 12]) {
    const j = ouvreSuivant(isoDe(annee, t, 15))
    out.push({ famille: "honoraires", jour: j, paiement: j, mode: "Prélèvement", categorie: "prestation", module: "autre",
      description: "Honoraires du cabinet comptable — tenue, TVA et bilan (trimestre).", fournisseur: "Cabinet comptable Bocage Conseil",
      ref: `HON-${annee}-${t / 3}`, ht: Math.round(310 * inflation * ECHELLE * 100) / 100, taux: 20,
      libelleBanque: `PRLV SEPA BOCAGE CONSEIL HONORAIRES T${t / 3}` })
  }

  // Ponctuelles : [famille, mois, jour, mode, catégorie, module, description, fournisseur, ht, taux, libellé]
  const ponctuelles: Array<[string, number, number, Mode, string, Charge["module"], string, string, number, number, string]> = [
    ["semences", 1, 14, "CB", "semences", "potager", "Semences potagères bio — commande d'hiver (carottes, poireaux, salades, courges).", "Graines du Bocage", 590, 10, "CB GRAINES DU BOCAGE"],
    ["outillage", 2, 6, "CB", "petit_outillage", "potager", "Voile de forçage P17 et filet anti-insectes (rouleaux de 100 m).", "Comptoir maraîcher de l'Ouest", 148, 20, "CB COMPTOIR MARAICHER OUEST"],
    ["compost", 2, 18, "Virement", "fertilisants", "potager", "Compost de déchets verts normé NFU 44-051 — 12 t livrées.", "Plateforme de compostage du Bocage", 384, 10, "VIR SEPA EMIS COMPOSTAGE DU BOCAGE"],
    ["entretien", 2, 24, "Chèque", "prestation", "autre", "Révision du tracteur : vidange, filtres et courroie.", "Garage agricole du Bocage", 438, 20, "CHEQUE"],
    ["veterinaire", 2, 27, "Chèque", "veterinaire", "elevage", "Visite de mises-bas et prophylaxie du troupeau caprin.", "Clinique vétérinaire du Bocage", 236, 20, "CHEQUE"],
    ["gds", 3, 9, "Prélèvement", "abonnement", "elevage", "Cotisation annuelle au groupement de défense sanitaire.", "Groupement de défense sanitaire du Bocage", 96, 0, "PRLV SEPA GDS DU BOCAGE COTISATION"],
    ["outillage", 3, 21, "Espèces", "petit_outillage", "potager", "Petit outillage : fourches-bêches, sécateurs, gants.", "Quincaillerie du Bourg", 71, 20, ""],
    ["gnr", 3, 25, "Virement", "carburant", "autre", "Gazole non routier — 450 L livrés en cuve.", "Carburants agricoles du Bocage", 468, 20, "VIR SEPA EMIS CARBURANTS AGRICOLES BOCAGE"],
    ["plants", 4, 3, "Chèque", "semences", "potager", "Plants maraîchers bio : tomates, poivrons, aubergines, courges.", "Pépinière Les Jeunes Pousses", 446, 10, "CHEQUE"],
    ["ecocert", 4, 16, "Virement", "abonnement", "autre", "Certification biologique — contrôle annuel et certificat.", "Ecocert", 655, 20, "VIR SEPA EMIS ECOCERT CERTIFICATION"],
    ["emballages", 4, 22, "CB", "autre", "elevage", "Papier fromager, boîtes à œufs et étiquettes de lots.", "Emballages Fermiers de l'Ouest", 212, 20, "CB EMBALLAGES FERMIERS OUEST"],
    ["eau", 4, 28, "Prélèvement", "energie", "autre", "Eau — relevé semestriel (abreuvement et fromagerie).", "Vendée Eau", 214, 5.5, "PRLV SEPA VENDEE EAU FACTURE SEMESTRE"],
    ["fromagerie", 5, 12, "CB", "autre", "elevage", "Présure, ferments lactiques et sel de fromagerie.", "Fromagerie Fournitures Ouest", 128, 5.5, "CB FROMAGERIE FOURNITURES"],
    ["veterinaire", 6, 4, "CB", "veterinaire", "elevage", "Parage des onglons et traitement antiparasitaire.", "Clinique vétérinaire du Bocage", 182, 20, "CB CLINIQUE VETERINAIRE BOCAGE"],
    ["plants", 6, 10, "Chèque", "semences", "potager", "Plants de poireaux, choux et céleris pour l'automne.", "Pépinière Les Jeunes Pousses", 188, 10, "CHEQUE"],
    ["eta", 6, 22, "Virement", "prestation", "elevage", "Fauche et pressage de la prairie — 38 balles rondes de foin.", "ETA des Deux Vallées", 572, 20, "VIR SEPA EMIS ETA DES DEUX VALLEES"],
    ["gnr", 6, 27, "Virement", "carburant", "autre", "Gazole non routier — 350 L livrés en cuve.", "Carburants agricoles du Bocage", 362, 20, "VIR SEPA EMIS CARBURANTS AGRICOLES BOCAGE"],
    ["emballages", 7, 2, "CB", "autre", "potager", "Sacs kraft, barquettes et étiquettes pour les paniers.", "Emballages Fermiers de l'Ouest", 164, 20, "CB EMBALLAGES FERMIERS OUEST"],
    ["entretien", 7, 17, "Chèque", "prestation", "elevage", "Réparation de la machine à traire (pulsateur et manchons).", "Traite Service de l'Ouest", 246, 20, "CHEQUE"],
    ["remplacement", 8, 21, "Virement", "prestation", "autre", "Service de remplacement — 4 jours de congés d'été.", "Service de remplacement agricole du canton", 512, 20, "VIR SEPA EMIS SERVICE REMPLACEMENT CANTON"],
    ["fromagerie", 9, 1, "CB", "autre", "elevage", "Présure, ferments lactiques et cendre végétale.", "Fromagerie Fournitures Ouest", 141, 5.5, "CB FROMAGERIE FOURNITURES"],
    ["semences", 9, 8, "CB", "semences", "potager", "Semences d'engrais vert (seigle, vesce) et de mâche.", "Graines du Bocage", 154, 10, "CB GRAINES DU BOCAGE"],
    ["veterinaire", 9, 24, "Chèque", "veterinaire", "elevage", "Échographies de gestation et visite du troupeau ovin.", "Clinique vétérinaire du Bocage", 214, 20, "CHEQUE"],
    ["gnr", 9, 29, "Virement", "carburant", "autre", "Gazole non routier — 400 L livrés en cuve.", "Carburants agricoles du Bocage", 418, 20, "VIR SEPA EMIS CARBURANTS AGRICOLES BOCAGE"],
    ["amendement", 10, 6, "Virement", "fertilisants", "potager", "Amendement calcaire marin (lithothamne) — 1,5 t.", "Plateforme de compostage du Bocage", 176, 10, "VIR SEPA EMIS COMPOSTAGE DU BOCAGE"],
    ["emballages", 10, 13, "CB", "autre", "elevage", "Papier fromager, boîtes à œufs et étiquettes de lots.", "Emballages Fermiers de l'Ouest", 198, 20, "CB EMBALLAGES FERMIERS OUEST"],
    ["entretien", 10, 20, "Chèque", "prestation", "potager", "Affûtage et pièces du motoculteur.", "Garage agricole du Bocage", 126, 20, "CHEQUE"],
    ["eau", 10, 28, "Prélèvement", "energie", "autre", "Eau — relevé semestriel (abreuvement et fromagerie).", "Vendée Eau", 196, 5.5, "PRLV SEPA VENDEE EAU FACTURE SEMESTRE"],
    ["fromagerie", 11, 19, "CB", "autre", "elevage", "Présure, ferments lactiques et sel de fromagerie.", "Fromagerie Fournitures Ouest", 118, 5.5, "CB FROMAGERIE FOURNITURES"],
    ["veterinaire", 12, 3, "Chèque", "veterinaire", "elevage", "Prophylaxie annuelle (prises de sang) et visite sanitaire.", "Clinique vétérinaire du Bocage", 268, 20, "CHEQUE"],
    ["gnr", 12, 15, "Virement", "carburant", "autre", "Gazole non routier — 300 L livrés en cuve.", "Carburants agricoles du Bocage", 314, 20, "VIR SEPA EMIS CARBURANTS AGRICOLES BOCAGE"],
  ]
  let n = 0
  for (const [famille, mois, j, mode, categorie, module, description, fournisseur, base, taux, libelle] of ponctuelles) {
    n++
    const jour = ouvreSuivant(isoDe(annee, mois, j))
    const ref = `${famille.slice(0, 3).toUpperCase()}${String(annee).slice(2)}-${String(100 + n * 7 + mois).padStart(4, "0")}`
    const charge: Charge = { famille, jour, paiement: null, mode, categorie, module, description, fournisseur, ref, ht: prix(base, 0.06), taux, libelleBanque: libelle }
    if (mode === "CB") {
      charge.paiement = ouvreSuivant(isoPlus(jour, 1))
      charge.libelleBanque = `${libelle} ${jjmm(jour)}`
    } else if (mode === "Chèque") {
      const numero = numeroCheque()
      charge.paiement = ouvreSuivant(isoPlus(jour, 4 + (n % 4)))
      charge.libelleBanque = `CHEQUE N° ${numero}`
      charge.description += ` Réglé par chèque n° ${numero}.`
    } else if (mode === "Virement") {
      charge.paiement = ouvreSuivant(isoPlus(jour, 8))
      charge.libelleBanque = `${libelle} ${ref}`
    } else if (mode === "Prélèvement") {
      charge.paiement = jour
    }
    out.push(charge)
  }

  // Fermage annuel, dû à la Saint-Martin (11 novembre, férié : payé la veille ouvrée).
  const fermage = ouvrePrecedent(isoDe(annee, 11, 11))
  out.push({ famille: "fermage", jour: fermage, paiement: fermage, mode: "Virement", categorie: "autre", module: "autre",
    description: "Fermage annuel — terres, prairie et bâtiments du Bois Joli (bail rural, échéance de la Saint-Martin).",
    fournisseur: "GFA du Bois Joli", ref: `FERMAGE-${annee}`, ht: Math.round(1465 * inflation * ECHELLE * 100) / 100, taux: 0,
    libelleBanque: `VIR SEPA EMIS GFA DU BOIS JOLI FERMAGE ${annee}` })

  return out
}

/**
 * Règle l'échéance de chaque pièce par rapport au jour du reseed : rien n'est
 * daté après hier, une seule facture (la dernière de la coopérative) reste à
 * crédit, et le dernier prélèvement d'électricité, pointé payé à la saisie,
 * attend son rapprochement.
 */
function calerSurAujourdhui(charges: Charge[]): Charge[] {
  const hier = ilYaIso(1)
  const out: Charge[] = []
  for (const c of charges) {
    if (c.jour > hier) continue
    if (c.famille === "aliments") {
      if (c.echeance! >= AUJ_ISO) {
        out.push({ ...c, paiement: null, aCredit: true })
        continue
      }
      // Échue avant aujourd'hui : payée à l'échéance, ou la veille ouvrée si
      // le jour ouvré suivant tombe aujourd'hui ou après.
      if (c.paiement! > hier) c.paiement = ouvrePrecedent(c.echeance!)
      if (c.paiement! > hier) c.paiement = ouvrePrecedent(hier)
    }
    if (c.paiement && c.paiement > hier) continue
    out.push(c)
  }
  // Une seule facture à crédit : la plus récente ; les autres sont réglées hier au plus tard.
  const aCredit = out.filter((c) => c.aCredit).sort((a, b) => b.jour.localeCompare(a.jour))
  for (const c of aCredit.slice(1)) {
    c.aCredit = false
    c.paiement = ouvrePrecedent(hier)
  }
  const derniereEdf = out.filter((c) => c.famille === "electricite").sort((a, b) => b.jour.localeCompare(a.jour))[0]
  if (derniereEdf) derniereEdf.laisseeAuVisiteur = true
  return out
}

/** Marge visée du compte entier, par exercice (comptes d'une EARL saine). */
const MARGE_VISEE: Record<number, number> = { [Y - 1]: 0.345, [Y]: 0.355 }
/** Recettes de la boutique et des professionnels, encore à venir dans ce module. */
const RECETTES_COMMERCE: Record<number, number> = { [Y - 1]: 700, [Y]: 1400 }
/** Tarifs fixes : ni la banque ni l'opérateur ne suivent l'activité. */
const TARIFS_FIXES = new Set(["frais-bancaires", "telecom"])

/**
 * Les charges suivent la taille réelle de la ferme : les recettes des autres
 * ateliers (déjà saisies, l'élevage compris quand il est joué) fixent, pour
 * chaque exercice, le niveau de charges d'une marge d'environ 35 %, une fois
 * leurs propres charges comptables déduites. Le coefficient reste borné : une
 * ferme sans élevage garde des charges plausibles.
 */
async function calibrer(ctx: Contexte, charges: Charge[]) {
  for (const annee of [Y - 1, Y]) {
    const debut = new Date(annee, 0, 1), fin = annee === Y ? NOW : new Date(annee, 11, 31, 23, 59, 59, 999)
    const date = { gte: debut, lte: fin }
    const [ventes, factures, depenses] = await Promise.all([
      prisma.venteManuelle.aggregate({ where: { userId: ctx.userId, date }, _sum: { montant: true } }),
      prisma.facture.findMany({ where: { userId: ctx.userId, date, statut: { notIn: ["brouillon", "annulee"] } }, select: { type: true, totalTTC: true } }),
      prisma.depenseManuelle.aggregate({ where: { userId: ctx.userId, date, comptable: true }, _sum: { montant: true } }),
    ])
    const recettes = (ventes._sum.montant ?? 0) + factures.reduce((s, f) => s + (f.type === "avoir" ? -1 : 1) * f.totalTTC, 0) + RECETTES_COMMERCE[annee]
    const del = charges.filter((c) => c.jour.startsWith(String(annee)))
    const fixes = del.filter((c) => TARIFS_FIXES.has(c.famille)).reduce((s, c) => s + depuisHT(c.ht, c.taux).montant, 0)
    const variables = del.filter((c) => !TARIFS_FIXES.has(c.famille)).reduce((s, c) => s + depuisHT(c.ht, c.taux).montant, 0)
    const cible = recettes * (1 - MARGE_VISEE[annee]) - (depenses._sum.montant ?? 0) - fixes
    const k = Math.min(1.7, Math.max(0.55, variables > 0 ? cible / variables : 1))
    for (const c of del) if (!TARIFS_FIXES.has(c.famille)) c.ht = Math.round(c.ht * k * 100) / 100
  }
}

export async function seedCharges(ctx: Contexte): Promise<{ nombre: number; total: number }> {
  const charges = calerSurAujourdhui([
    ...chargesDeLAnnee(Y - 1, 0.975),
    ...chargesDeLAnnee(Y, 1),
  ]).sort((a, b) => a.jour.localeCompare(b.jour) || a.famille.localeCompare(b.famille))
  await calibrer(ctx, charges)

  let total = 0
  for (const c of charges) {
    const m = depuisHT(c.ht, c.taux)
    const especes = c.mode === "Espèces"
    // Pièce réglée par la banque : à payer jusqu'au rapprochement du relevé.
    // Le dernier prélèvement EDF est pointé payé à la saisie, comme un
    // exploitant qui coche « payée » sans attendre son relevé.
    const payeeALaSaisie = especes || Boolean(c.laisseeAuVisiteur)
    const depense = await prisma.depenseManuelle.create({
      data: {
        userId: ctx.userId,
        date: midi(c.jour),
        categorie: c.categorie,
        description: c.description,
        tauxTVA: c.taux,
        montantHT: m.montantHT,
        montantTVA: m.montantTVA,
        montant: m.montant,
        journal: "AC",
        modeReglement: payeeALaSaisie ? c.mode : c.aCredit ? "À crédit" : null,
        numeroPiece: c.ref,
        refFacture: c.ref,
        module: c.module,
        fournisseurNom: c.fournisseur,
        paye: payeeALaSaisie,
        comptable: true,
        dateEcheance: c.echeance ? midi(c.echeance) : null,
        tvaInferee: false,
      },
    })
    total += m.montant
    if (c.paiement && !especes) {
      ajouterOperation(ctx, {
        jour: c.paiement,
        libelle: c.libelleBanque,
        centimes: -centimes(m.montant),
        reglements: [{ cible: { type: "DepenseManuelle", id: depense.id }, centimes: centimes(m.montant), mode: c.mode as ModeBancaire }],
        aRapprocherParLeVisiteur: c.laisseeAuVisiteur,
      })
    }
  }
  journal(`Charges : ${charges.length} pièces fournisseurs (${Math.round(total)} € TTC sur ${Y - 1} et ${Y}), dont une facture à crédit`)
  return { nombre: charges.length, total }
}
