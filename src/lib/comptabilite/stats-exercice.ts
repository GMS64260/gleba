/**
 * Tableau de bord comptable d'un exercice (GET /api/comptabilite/stats).
 * Agrège les données financières de tous les modules.
 */

import prisma from '@/lib/prisma'
import { bucketModuleCompta } from '@/lib/comptabilite/modules'
import { getKpiCompta } from '@/lib/kpi'
import { bornesExerciceKpi, chargerLignesDepensesDevise, chargerMensuelComptaParDevise } from '@/lib/kpi/compta'
import { monnaieImpayee, ventilerImpayeesParDevise } from '@/lib/comptabilite/ventilation-impayees'
import { deviseCouranteExploitation } from '@/lib/comptabilite/devise-reglement'
import { monnaieVente, monnaieCommande, SELECT_CONTEXTE_FISCAL_VENTE } from '@/lib/comptabilite/devise-vente'
import {
  chargerDevisesDossiers,
  chargerMonnaiesDepenses,
  chargerMonnaiesVentesBrutes,
  cleDossierDepense,
  cleDossierDepenseSource,
  monnaieParCle,
  monnaieVenteBrute,
  SELECT_IDENTITE_DEPENSE,
} from '@/lib/comptabilite/devise-ecritures'
import { estPresent, soustraireParDevise, sommerParDevise, totalSiUneDevise, type TotalDevise } from '@/lib/comptabilite/totaux-devise'
import type { Devise } from '@/lib/territoires'
import { chargerAvoirsBois } from '@/lib/comptabilite/avoirs-bois.server'
import { chargerEncoursCompta } from '@/lib/comptabilite/encours'
import { STATUTS_COMMANDES_EN_ATTENTE } from '@/lib/comptabilite/alertes'

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const COLORS = {
  oeufs: '#f59e0b',
  viande: '#ef4444',
  miel: '#d97706',
  cire: '#eab308',
  propolis: '#92400e',
  pollen: '#f59e0b',
  gelee_royale: '#fbbf24',
  autre_ruche: '#b45309',
  produits_ruche: '#d97706',
  fruits: '#22c55e',
  legumes: '#84cc16',
  bois: '#92400e',
  service: '#3b82f6',
  autre: '#6b7280',
  soins: '#ef4444',
  aliments: '#f97316',
  operations: '#8b5cf6',
  fertilisation: '#22c55e',
  achats: '#0ea5e9',
  materiel: '#64748b',
  carburant: '#f59e0b',
  main_oeuvre: '#ec4899',
}

/** Libellés des catégories de dépenses (saisies et miroirs automatiques). */
const LABELS_CATEGORIE_DEPENSE: Record<string, string> = {
  semences: 'Semences et plants',
  plants: 'Plants',
  engrais: 'Engrais et amendements',
  intrants: 'Intrants',
  phyto: 'Produits phytosanitaires',
  carburant: 'Carburant',
  energie: 'Énergie',
  materiel: 'Matériel',
  petit_outillage: 'Petit outillage',
  prestation: 'Prestations',
  veterinaire: 'Vétérinaire',
  alimentation: 'Alimentation animale',
  aliments: 'Alimentation animale',
  fertilisants: 'Engrais et amendements',
  achats: 'Achats d’animaux',
  animal_vivant: 'Achats d’animaux',
  msa: 'Cotisations MSA',
  main_oeuvre: 'Main d’œuvre',
  abonnement: 'Abonnements',
  autre: 'Autre',
}

/**
 * Libellé d'une catégorie de dépense, le même à la liste, au CSV et au
 * graphique. Une catégorie inconnue garde son nom : elle ne devient jamais
 * « Autre » (signalement FB-6PQOC4).
 */
export function libelleCategorieDepense(categorie: string | null | undefined): string {
  const cle = (categorie ?? '').trim()
  if (!cle) return LABELS_CATEGORIE_DEPENSE.autre
  return LABELS_CATEGORIE_DEPENSE[cle] ||
    cle.charAt(0).toUpperCase() + cle.slice(1).replace(/_/g, ' ')
}

/** Ventes automatiques reprises au graphique par catégorie (aucune table brute ne les porte). */
export const SOURCES_AUTO_CATEGORIE = ['commande_boutique', 'paie_lait', 'abattage', 'reservation_elevage'] as const

export interface OptionsStatsExercice {
  /**
   * `sourceType` des ventes automatiques comptées au graphique par catégorie.
   * La zone privée y ajoute les ventes de caisse.
   */
  sourcesAutoCategorie?: readonly string[]
}

type Modules = { elevage: number; verger: number; potager: number; autre: number }
const CLES_MODULES = ['elevage', 'verger', 'potager', 'autre'] as const
const auCentime = (n: number) => Math.round(n * 100) / 100

/** Un groupe d'une devise ventilé par module (montants au centime). */
interface GroupeModules { monnaie: Devise | null; total: number; parModule: Modules }

/** Montants imputés à un module, groupés par devise ; ordre EUR, XPF, inconnue. */
function grouperParModule(
  lignes: ReadonlyArray<{ module: keyof Modules; montant: number; monnaie: Devise | null }>,
  devise: Devise,
): GroupeModules[] {
  return sommerParDevise(lignes, (l) => l.monnaie, (l) => l.montant, devise).map(({ monnaie }) => {
    const parModule: Modules = { elevage: 0, verger: 0, potager: 0, autre: 0 }
    for (const l of lignes) if (l.monnaie === monnaie) parModule[l.module] += l.montant
    for (const k of CLES_MODULES) parModule[k] = auCentime(parModule[k])
    return { monnaie, total: auCentime(CLES_MODULES.reduce((s, k) => s + parModule[k], 0)), parModule }
  })
}

/** Devises présentes dans plusieurs ventilations (groupes non vides). */
function devisesPresentes(...listes: ReadonlyArray<readonly TotalDevise[]>): Set<Devise | null> {
  return new Set(listes.flat().filter(estPresent).map((t) => t.monnaie))
}

/**
 * GET /api/comptabilite/stats : tableau de bord comptable d'un exercice.
 *
 * Contrat devise (lot devise-totaux-api, 16/11/2026) : chaque total monétaire
 * agrégé a un voisin `<nom>ParDevise` ; le total historique reste rempli pour
 * une seule devise et vaut `null` dès que deux coexistent. Chaque écriture
 * garde sa devise figée (facture, contexte de vente, dossier de règlement) ;
 * sans devise figée, elle suit la devise courante de l'exploitation.
 *
 * Frontière public/privé : la route `stats/route.ts` est une surcharge de la
 * zone privée, figée à sa version de main dans le dépôt public. Ce calcul est
 * PUBLIC : la route privée et la route publique `stats/devises` l'appellent.
 */
export async function calculerStatsExercice(userId: string, year: number, asOf: Date = new Date(), options: OptionsStatsExercice = {}) {
  const sourcesAuto = [...(options.sourcesAutoCategorie ?? SOURCES_AUTO_CATEGORIE)]
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

  // Source unique de vérité : revenus, dépenses, bénéfice, N-1 YTD.
  // Les ventilations détaillées (par catégorie, par mois, par module)
  // restent ci-dessous, mais TOUS les totaux exposés en haut de la réponse
  // proviennent de `getKpiCompta`, alignant la page d'accueil Compta, le
  // module Rapports et le module Coûts de production.
  const kpiCompta = await getKpiCompta(userId, year, asOf, { parDevise: true })
  const bornesComptables = bornesExerciceKpi(year, asOf)
  const exploitation = await prisma.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } })
  const devise = deviseCouranteExploitation(exploitation)

  // ========================================
  // REVENUS
  // ========================================
  // Ticket cmvflua2x (2026-10-19) — les revenus PAR MODULE viennent de la SSOT
  // (`kpiCompta.revenusParModuleYtd`), sur les mêmes écritures que le total.
  // Les lectures brutes ci-dessous ne servent qu'aux graphiques par catégorie.
  const [
    ventesElevage,
    recoltesArbresPrix,
    venteBois,
    recoltesPotagerVendues,
    ventesManuellesParCategorie,
    // DÉPENSES
    depensesSoins,
    depensesOperations,
    consommationsAliments,
    fertilisations,
    achatsLots,
    achatsAnimaux,
    achatsArbres,
    campagnesPlantation,
    depensesComptables,
    depensesManuellesParModule,
    interventionsAvecCout,
    // ALERTES
    stocksBasAliments,
    stocksBasGraines,
    commandesEnAttente,
  ] = await Promise.all([
    // Ventes élevage (audit compta 2026-06 : exclure les annulées). Lues une
    // à une : chacune garde la devise de sa facture ou de son miroir.
    prisma.venteProduit.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear }, annule: false },
      select: { id: true, type: true, prixTotal: true, factureId: true },
    }),

    // Récoltes arbres avec prix (vendues uniquement)
    prisma.recolteArbre.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear }, prixKg: { not: null }, statut: 'vendu' },
      select: { id: true, quantite: true, prixKg: true, date: true, factureId: true },
    }),

    // DEV3 #5 - Audit Marc : statut='vendu' (canonique) ; toute ligne avec
    // prixVente renseigné et destination « vente » est aussi captée.
    prisma.productionBois.findMany({
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
        prixVente: { not: null },
        OR: [{ statut: 'vendu' }, { destination: { in: ['vente', 'Vente'] } }],
      },
      select: { id: true, prixVente: true, factureId: true },
    }),

    // Récoltes potager vendues
    prisma.recolte.findMany({
      where: { userId, statut: 'vendu', dateVente: { gte: startOfYear, lte: endOfYear }, prixTotal: { not: null } },
      select: { id: true, quantite: true, prixKg: true, prixTotal: true, dateVente: true, factureId: true },
    }),

    // Ventes manuelles par catégorie. Miroirs auto exclus (leur source brute
    // est lue plus haut), sauf les ventes sans table brute (boutique, paie du
    // lait, abattages, réservations ; caisse côté zone privée).
    prisma.venteManuelle.findMany({
      where: {
        userId,
        date: { gte: startOfYear, lte: endOfYear },
        OR: [{ auto: { not: true } }, { auto: true, sourceType: { in: sourcesAuto } }],
      },
      select: { categorie: true, montant: true, ...SELECT_CONTEXTE_FISCAL_VENTE },
    }),

    // Soins animaux (coût analytique)
    prisma.soinAnimal.aggregate({
      where: { userId, date: { gte: startOfYear, lte: endOfYear }, cout: { not: null }, fait: true },
      _sum: { cout: true },
    }),

    // Opérations arbres réalisées : une opération planifiée n'est pas une
    // dépense (même règle que son miroir et que Transactions).
    prisma.operationArbre.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear }, cout: { not: null }, NOT: { fait: false } },
      select: { id: true, cout: true },
    }),

    // Consommation aliments (avec prix)
    prisma.consommationAliment.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear } },
      include: {
        aliment: {
          select: {
            prix: true,
            userStocks: { where: { userId }, select: { prix: true, coutUnitaire: true }, take: 1 },
          },
        },
      },
    }),

    // Fertilisation (avec prix)
    prisma.fertilisation.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear } },
      include: { fertilisant: { select: { prix: true } } },
    }),

    // Achats lots animaux
    prisma.lotAnimaux.findMany({
      where: { userId, dateArrivee: { gte: startOfYear, lte: endOfYear }, prixAchatTotal: { not: null } },
      select: { id: true, prixAchatTotal: true },
    }),

    // Achats animaux individuels
    prisma.animal.findMany({
      where: { userId, dateArrivee: { gte: startOfYear, lte: endOfYear }, prixAchat: { not: null }, prixAchatInclusDansLot: false },
      select: { id: true, prixAchat: true },
    }),

    // Achats arbres (verger), datés comme leur miroir : achat, sinon
    // plantation, sinon création.
    prisma.arbre.findMany({
      where: {
        userId,
        prixAchat: { not: null },
        OR: [
          { dateAchat: { gte: startOfYear, lte: endOfYear } },
          { datePlantation: { gte: startOfYear, lte: endOfYear }, dateAchat: null },
          { dateAchat: null, datePlantation: null, createdAt: { gte: startOfYear, lte: endOfYear } },
        ],
      },
      select: { id: true, prixAchat: true },
    }),

    // Coûts réels des campagnes de plantation (revue du 2026-10-29). Même
    // date que la liste et le miroir ; le miroir auto est exclu plus bas.
    prisma.campagnePlantation.findMany({
      where: { userId, coutReel: { gt: 0 }, OR: [
        { datePlantationReelle: { gte: startOfYear, lte: endOfYear } },
        { datePlantationReelle: null, datePlantationPrevue: { gte: startOfYear, lte: endOfYear } },
        { datePlantationReelle: null, datePlantationPrevue: null, createdAt: { gte: startOfYear, lte: endOfYear } },
      ] },
      select: { id: true, coutReel: true },
    }),

    // Charges comptables de l'exercice, une à une avec leur devise (dossier
    // de règlement figé, sinon devise courante) : le camembert par catégorie
    // suit le total comptable (revue du 2026-11-01).
    chargerLignesDepensesDevise(userId, bornesComptables.debut, bornesComptables.fin, devise),

    // Dépenses manuelles par MODULE d'imputation (exclure auto=true).
    // Ticket cmsx69cuc — chaque charge manuelle sur SON module.
    prisma.depenseManuelle.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear }, auto: { not: true } },
      select: { ...SELECT_IDENTITE_DEPENSE, module: true, montant: true },
    }),

    // Interventions culturales réalisées avec un coût (leur miroir est exclu
    // ci-dessus comme tous les miroirs).
    prisma.intervention.findMany({
      where: { userId, date: { gte: startOfYear, lte: endOfYear }, coutTotal: { not: null }, NOT: { fait: false } },
      select: { id: true, coutTotal: true, arbreId: true },
    }),

    // Stocks bas aliments (per-user)
    prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_stock_aliments
      WHERE user_id = ${userId}
        AND stock IS NOT NULL
        AND stock_min IS NOT NULL
        AND stock <= stock_min
    ` as Promise<{ count: bigint }[]>,

    // Stocks bas graines (per-user)
    prisma.userStockVariete.count({ where: { userId, stockGraines: { lt: 100, not: null } } }),

    // QA 2026-05-15 — Bug #5 : commandes boutique non livrées de l'année.
    prisma.commandeBoutique.findMany({
      where: { userId, createdAt: { gte: startOfYear, lte: endOfYear }, statut: { in: [...STATUTS_COMMANDES_EN_ATTENTE] } },
    }),
  ])

  // ========================================
  // DEVISES DES ÉCRITURES
  // ========================================
  // Ventes d'atelier : facture liée, sinon miroir, sinon devise courante.
  // Dépenses : dossier de règlement figé, sinon devise courante. Les coûts
  // analytiques (soins, aliments, fertilisations) n'ont jamais de règlement.
  const [monnaiesVentes, devisesDossiers] = await Promise.all([
    chargerMonnaiesVentesBrutes(userId, [
      ...ventesElevage.map((v) => ({ sourceType: 'vente_produit' as const, id: v.id, factureId: v.factureId })),
      ...recoltesArbresPrix.map((r) => ({ sourceType: 'recolte_arbre' as const, id: r.id, factureId: r.factureId })),
      ...venteBois.map((b) => ({ sourceType: 'production_bois' as const, id: b.id, factureId: b.factureId })),
      ...recoltesPotagerVendues.map((r) => ({ sourceType: 'recolte' as const, id: r.id, factureId: r.factureId })),
    ], devise),
    chargerDevisesDossiers(userId, [
      ...depensesManuellesParModule.map(cleDossierDepense),
      ...achatsLots.map((l) => cleDossierDepenseSource('achat_animal', l.id)),
      ...achatsAnimaux.map((a) => cleDossierDepenseSource('achat_animal_individuel', a.id)),
      ...depensesOperations.map((o) => cleDossierDepenseSource('operation_arbre', o.id)),
      ...interventionsAvecCout.map((i) => cleDossierDepenseSource('intervention', i.id)),
      ...achatsArbres.map((a) => cleDossierDepenseSource('achat_arbre', a.id)),
      ...campagnesPlantation.map((c) => cleDossierDepenseSource('campagne_plantation', c.id)),
    ]),
  ])
  const monnaieDossier = (cle: string) => monnaieParCle(cle, devisesDossiers, devise)

  // Impayés de l'exercice : mêmes règles que l'écran Factures. La table
  // Facture porte les avoirs et les factures manuelles sans source métier ;
  // le helper impute les avoirs et dédoublonne facture↔vente. Chaque vente
  // manuelle garde la devise de son contexte figé (QA180 / ADV181).
  const encours = await chargerEncoursCompta(userId, startOfYear, endOfYear, devise)
  const impayeesExercice = encours.creances
  const facturesImpayeesParDevise = ventilerImpayeesParDevise(impayeesExercice.items, devise)

  // ========================================
  // CALCULS AGRÉGÉS
  // ========================================

  // Dépenses aliments et fertilisation (coûts analytiques calculés)
  const depensesAliments = consommationsAliments.reduce((sum, c) => {
    const prix = c.aliment.userStocks[0]?.coutUnitaire ?? c.aliment.userStocks[0]?.prix ?? c.aliment.prix ?? 0
    return sum + c.quantite * prix
  }, 0)
  const depensesFertilisation = fertilisations.reduce((sum, f) => sum + (f.quantite * (f.fertilisant.prix || 0)), 0)

  // Ticket cmvflua2x — revenus par module = ventilation de la SSOT, sur les
  // mêmes ventes et factures que la carte Revenus (src/lib/kpi/compta.ts).
  const ventilationRevenus = kpiCompta.revenusParModuleYtd
  const revenus = ventilationRevenus?.parModule ?? { elevage: 0, verger: 0, potager: 0, autre: 0 }
  const totalRevenus = revenus.elevage + revenus.verger + revenus.potager + revenus.autre

  // Ticket cmsx69cuc — les charges manuelles sont ventilées sur LEUR module
  // d'imputation (les valeurs hors liste tombant en « Autre »), et les
  // interventions culturales rejoignent leur module. Chaque ligne garde sa
  // devise (lot devise-totaux-api, tour 2).
  const lignesDepensesModules: Array<{ module: keyof Modules; montant: number; monnaie: Devise | null }> = [
    { module: 'elevage' as const, montant: depensesSoins._sum.cout || 0, monnaie: devise },
    { module: 'elevage' as const, montant: depensesAliments, monnaie: devise },
    ...achatsLots.map((l) => ({ module: 'elevage' as const, montant: l.prixAchatTotal || 0, monnaie: monnaieDossier(cleDossierDepenseSource('achat_animal', l.id)) })),
    ...achatsAnimaux.map((a) => ({ module: 'elevage' as const, montant: a.prixAchat || 0, monnaie: monnaieDossier(cleDossierDepenseSource('achat_animal_individuel', a.id)) })),
    ...depensesOperations.map((o) => ({ module: 'verger' as const, montant: o.cout || 0, monnaie: monnaieDossier(cleDossierDepenseSource('operation_arbre', o.id)) })),
    ...achatsArbres.map((a) => ({ module: 'verger' as const, montant: a.prixAchat || 0, monnaie: monnaieDossier(cleDossierDepenseSource('achat_arbre', a.id)) })),
    ...campagnesPlantation.map((c) => ({ module: 'verger' as const, montant: c.coutReel || 0, monnaie: monnaieDossier(cleDossierDepenseSource('campagne_plantation', c.id)) })),
    { module: 'potager' as const, montant: depensesFertilisation, monnaie: devise },
    ...depensesManuellesParModule.map((d) => ({ module: bucketModuleCompta(d.module), montant: d.montant || 0, monnaie: monnaieDossier(cleDossierDepense(d)) })),
    ...interventionsAvecCout.map((i) => ({
      module: (i.arbreId ? 'verger' : 'potager') as keyof Modules,
      montant: i.coutTotal || 0,
      monnaie: monnaieDossier(cleDossierDepenseSource('intervention', i.id)),
    })),
  ].filter((l) => l.montant !== 0)
  const depenses: Modules = { elevage: 0, verger: 0, potager: 0, autre: 0 }
  const depensesParModuleParDevise = grouperParModule(lignesDepensesModules, devise)
  if (depensesParModuleParDevise.length === 1) Object.assign(depenses, depensesParModuleParDevise[0].parModule)
  const totalDepenses = totalSiUneDevise(depensesParModuleParDevise)
  const depensesModulesMultiDevise = depensesParModuleParDevise.length > 1

  // ========================================
  // DEVISES (lot devise-totaux-api, 16/11/2026)
  // ========================================
  const revenusParDevise = kpiCompta.revenusYtdParDevise.map(({ monnaie, total, count }) => ({ monnaie, total, count }))
  const revenusParModuleParDevise = kpiCompta.revenusYtdParDevise.map(({ monnaie, total, count, parModule, composition }) =>
    ({ monnaie, total, count, parModule, composition }))
  const revenusMultiDevise = revenusParDevise.length > 1
  const depensesParDevise = kpiCompta.depensesYtdParDevise
  const beneficeParDevise = kpiCompta.beneficeYtdParDevise
  const benefice = totalSiUneDevise(beneficeParDevise)

  // ========================================
  // GRAPHIQUES
  // ========================================
  // Mensuel : mêmes écritures et mêmes bornes que les totaux (`getKpiCompta`).
  // Dès que l'exercice compte deux devises, aucun mois n'affiche de somme ;
  // chaque mois porte son détail par devise.
  const mensuelComptable = await chargerMensuelComptaParDevise(userId, year, asOf, devise)
  const mensuelMultiDevise = devisesPresentes(...mensuelComptable.flatMap((m) => [m.revenusParDevise, m.depensesParDevise])).size > 1
  const mensuel = MOIS_LABELS.map((label, i) => {
    const m = mensuelComptable[i]
    return {
      mois: label,
      revenus: mensuelMultiDevise ? null : m.revenus,
      revenusParDevise: m.revenusParDevise,
      depenses: mensuelMultiDevise ? null : m.depenses,
      depensesParDevise: m.depensesParDevise,
      benefice: mensuelMultiDevise ? null : totalSiUneDevise(soustraireParDevise(m.revenusParDevise, m.depensesParDevise)),
      beneficeParDevise: soustraireParDevise(m.revenusParDevise, m.depensesParDevise),
    }
  })

  // Revenus par catégorie : chaque écriture garde sa devise avant toute
  // agrégation (facture liée, miroir, vente manuelle) ; une part de catégorie
  // n'additionne jamais deux devises.
  const libelleCategorieVente = (categorie: string) =>
    categorie === 'legumes' ? 'Légumes' :
    categorie === 'animal_vivant' ? 'Animaux' :
    categorie === 'service' ? 'Services' :
    categorie === 'produits_ruche' ? 'Produits de la ruche' :
    categorie.charAt(0).toUpperCase() + categorie.slice(1)
  const libelleTypeElevage = (type: string) =>
    type === 'oeufs' ? 'Oeufs' :
    type === 'viande' ? 'Viande' :
    type === 'animal_vivant' ? 'Animaux' :
    type === 'miel' ? 'Miel' :
    type === 'cire' ? 'Cire' :
    type === 'propolis' ? 'Propolis' :
    type === 'pollen' ? 'Pollen' :
    type === 'gelee_royale' ? 'Gelée royale' :
    type === 'autre_ruche' ? 'Autre produit de la ruche' : type
  // Avoirs de l'exercice sur une facture qui porte du bois : la part « Bois »
  // suit le total et le module Verger, qui les déduisent déjà (FB-8Y5FFX).
  const partsAvoirsBois = (await chargerAvoirsBois(userId, { date: { gte: startOfYear, lte: endOfYear } }))
    .map((a) => ({ categorie: 'Bois', couleur: COLORS.bois, montant: -a.montant, monnaie: a.monnaie }))
  const partsCategorie: Array<{ categorie: string; montant: number; couleur: string; monnaie: Devise | null }> = [
    ...ventesElevage.map((v) => ({
      categorie: libelleTypeElevage(v.type),
      montant: v.prixTotal || 0,
      couleur: COLORS[v.type as keyof typeof COLORS] || COLORS.autre,
      monnaie: monnaieVenteBrute(monnaiesVentes, { sourceType: 'vente_produit', id: v.id }, devise),
    })),
    ...recoltesArbresPrix.map((r) => ({
      categorie: 'Fruits', montant: r.quantite * (r.prixKg || 0), couleur: COLORS.fruits,
      monnaie: monnaieVenteBrute(monnaiesVentes, { sourceType: 'recolte_arbre', id: r.id }, devise),
    })),
    ...recoltesPotagerVendues.map((r) => ({
      categorie: 'Légumes (récoltes)', montant: r.prixTotal || (r.quantite * (r.prixKg || 0)), couleur: COLORS.legumes,
      monnaie: monnaieVenteBrute(monnaiesVentes, { sourceType: 'recolte', id: r.id }, devise),
    })),
    ...venteBois.map((b) => ({
      categorie: 'Bois', montant: b.prixVente || 0, couleur: COLORS.bois,
      monnaie: monnaieVenteBrute(monnaiesVentes, { sourceType: 'production_bois', id: b.id }, devise),
    })),
    ...partsAvoirsBois,
    ...ventesManuellesParCategorie.map((v) => ({
      categorie: libelleCategorieVente(v.categorie),
      montant: v.montant || 0,
      couleur: COLORS[v.categorie as keyof typeof COLORS] || COLORS.autre,
      monnaie: monnaieVente(v, devise),
    })),
  ]
  // Une catégorie, une part : la viande vendue en direct et celle des
  // abattages, ou les animaux vendus et réservés, ne font pas deux parts.
  // Son montant est `null` dès que le graphique compte deux devises.
  const ventilerCategories = <T extends { categorie: string; couleur: string; montant: number; monnaie: Devise | null }>(lignes: T[]) => {
    const vues = [...new Set(lignes.map((r) => r.categorie))]
    const parts = vues.map((categorie) => {
      const l = lignes.filter((r) => r.categorie === categorie)
      return { categorie, couleur: l[0].couleur, parDevise: sommerParDevise(l, (r) => r.monnaie, (r) => r.montant, devise).filter((t) => t.total > 0) }
    }).filter((r) => r.parDevise.length > 0)
    const multi = new Set(parts.flatMap((r) => r.parDevise.map((t) => t.monnaie))).size > 1
    return parts.map((r) => ({
      categorie: r.categorie,
      montant: multi ? null : auCentime(r.parDevise.reduce((s, t) => s + t.total, 0)),
      montantParDevise: r.parDevise.map(({ monnaie, total }) => ({ monnaie, total })),
      couleur: r.couleur,
    }))
  }
  const revenusParCategorie = ventilerCategories(partsCategorie)

  // Dépenses par catégorie — mêmes charges que le total comptable, chacune
  // dans la devise de son dossier de règlement (sinon devise courante).
  const depensesParCategorie = ventilerCategories(depensesComptables.map((d) => ({
    categorie: libelleCategorieDepense(d.categorie),
    montant: d.montant,
    couleur: COLORS[d.categorie as keyof typeof COLORS] || COLORS.autre,
    monnaie: d.monnaie,
  }))).sort((a, b) =>
    a.montant === null || b.montant === null ? a.categorie.localeCompare(b.categorie, 'fr') : b.montant - a.montant)

  // Par module : revenus (SSOT) et dépenses (analytiques) ventilés par devise ;
  // en multi-devise, ni revenus, ni dépenses, ni bénéfice d'un module ne
  // s'additionnent.
  const MODULES_GRAPHIQUE = [
    ['Maraîchage', 'potager'], ['Verger', 'verger'], ['Élevage', 'elevage'], ['Autre', 'autre'],
  ] as const
  const parModule = MODULES_GRAPHIQUE.map(([module, cle]) => {
    const revenusParDeviseModule: TotalDevise[] = revenusParModuleParDevise.map((g) => ({ monnaie: g.monnaie, total: g.parModule[cle] }))
    const depensesParDeviseModule: TotalDevise[] = depensesParModuleParDevise.map((g) => ({ monnaie: g.monnaie, total: g.parModule[cle] }))
    const beneficeParDeviseModule = soustraireParDevise(revenusParDeviseModule, depensesParDeviseModule)
    return {
      module,
      revenus: revenusMultiDevise ? null : revenus[cle],
      revenusParDevise: revenusParDeviseModule,
      depenses: depensesModulesMultiDevise ? null : auCentime(depenses[cle]),
      depensesParDevise: depensesParDeviseModule,
      benefice: totalSiUneDevise(beneficeParDeviseModule),
      beneficeParDevise: beneficeParDeviseModule,
    }
  })

  // ========================================
  // ACTIVITÉ
  // ========================================
  const [dernieresVentes, dernieresDepenses, dernieresRecoltesPotager] = await Promise.all([
    prisma.venteProduit.findMany({
      where: { userId, annule: false },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, date: true, type: true, prixTotal: true, paye: true, factureId: true },
    }),
    prisma.depenseManuelle.findMany({
      where: { userId, auto: { not: true } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { ...SELECT_IDENTITE_DEPENSE, date: true, categorie: true, description: true, montant: true },
    }),
    prisma.recolte.findMany({
      where: { userId, statut: 'vendu', prixTotal: { not: null } },
      orderBy: { dateVente: 'desc' },
      take: 5,
      select: { id: true, dateVente: true, date: true, prixTotal: true, especeId: true, factureId: true },
    }),
  ])
  // Chaque transaction affichée porte sa devise (même règle que les totaux).
  const [monnaiesDernieresVentes, monnaiesDernieresDepenses] = await Promise.all([
    chargerMonnaiesVentesBrutes(userId, [
      ...dernieresVentes.map((v) => ({ sourceType: 'vente_produit' as const, id: v.id, factureId: v.factureId })),
      ...dernieresRecoltesPotager.map((r) => ({ sourceType: 'recolte' as const, id: r.id, factureId: r.factureId })),
    ], devise),
    chargerMonnaiesDepenses(userId, dernieresDepenses, devise),
  ])

  const dernieresTransactions = [
    ...dernieresVentes.map((v) => ({
      id: v.id,
      type: 'revenu' as const,
      date: v.date.toISOString(),
      description: v.type === 'oeufs' ? 'Vente oeufs' : `Vente ${v.type}`,
      montant: v.prixTotal,
      monnaie: monnaieVenteBrute(monnaiesDernieresVentes, { sourceType: 'vente_produit', id: v.id }, devise),
      module: 'elevage',
      paye: v.paye,
      source: 'vente_produit',
    })),
    ...dernieresRecoltesPotager.map((r) => ({
      id: r.id,
      type: 'revenu' as const,
      date: (r.dateVente || r.date).toISOString(),
      description: `Vente ${r.especeId}`,
      montant: r.prixTotal || 0,
      monnaie: monnaieVenteBrute(monnaiesDernieresVentes, { sourceType: 'recolte', id: r.id }, devise),
      module: 'potager',
      paye: true,
      source: 'recolte',
    })),
    ...dernieresDepenses.map((d) => ({
      id: d.id,
      type: 'depense' as const,
      date: d.date.toISOString(),
      description: d.description,
      montant: d.montant,
      monnaie: monnaiesDernieresDepenses.has(d.id) ? monnaiesDernieresDepenses.get(d.id)! : devise,
      module: 'autre',
      paye: true,
      source: 'depense_manuelle',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  // Factures impayées détail — même source que la carte (helper partagé).
  const facturesImpayees = impayeesExercice.items.slice(0, 10).map((i) => ({
    id: i.id,
    type: i.type,
    date: i.date,
    client: i.client || 'Non renseigné',
    montant: i.montant,
    source: i.source,
    description: i.description,
    numero: i.numero ?? null,
    monnaie: monnaieImpayee(i, devise),
  }))

  // Alertes stock (per-user)
  const alertesStockAliments = await prisma.userStockAliment.findMany({
    where: { userId, stock: { not: null }, stockMin: { not: null } },
    include: { aliment: { select: { id: true, nom: true } } },
  })
  const alertesStock = alertesStockAliments
    .filter((a) => a.stock !== null && a.stockMin !== null && a.stock! <= a.stockMin!)
    .map((a) => ({ id: a.aliment.id, nom: a.aliment.nom, stock: a.stock!, stockMin: a.stockMin!, module: 'elevage' }))

  // BUG #2 (audit compta 2026-05-15) — Audit de cohérence entre la SSOT
  // `getKpiCompta` et la ventilation par module. Ticket cmsx69cuc — l'écart
  // résiduel des dépenses est la VALORISATION INTERNE (soins, aliments,
  // fertilisations : coûts analytiques, jamais des charges comptables).
  // Lot devise-totaux-api : chaque montant a son voisin par devise ; les
  // totaux toutes devises confondues valent `null` en multi-devise.
  const depensesAnalytiques = auCentime((depensesSoins._sum.cout || 0) + depensesAliments + depensesFertilisation)
  const revenusSommeModulesParDevise: TotalDevise[] = revenusParModuleParDevise.map((g) => ({
    monnaie: g.monnaie, total: auCentime(CLES_MODULES.reduce((s, k) => s + g.parModule[k], 0)),
  }))
  const depensesSommeModulesParDevise: TotalDevise[] = depensesParModuleParDevise.map(({ monnaie, total }) => ({ monnaie, total }))
  const coherenceMultiDevise = devisesPresentes(revenusParDevise, revenusSommeModulesParDevise, depensesParDevise, depensesSommeModulesParDevise).size > 1
  const siUneDevise = (n: number | null) => (coherenceMultiDevise || n === null ? null : auCentime(n))
  const coherenceCheck = {
    revenusSsot: siUneDevise(kpiCompta.revenusYtd),
    revenusSsotParDevise: revenusParDevise,
    revenusSommeModules: siUneDevise(totalRevenus),
    revenusSommeModulesParDevise,
    revenusEcart: siUneDevise(totalSiUneDevise(soustraireParDevise(revenusParDevise, revenusSommeModulesParDevise))),
    revenusEcartParDevise: soustraireParDevise(revenusParDevise, revenusSommeModulesParDevise),
    depensesSsot: siUneDevise(kpiCompta.depensesYtd),
    depensesSsotParDevise: depensesParDevise,
    depensesSommeModules: siUneDevise(totalDepenses),
    depensesSommeModulesParDevise,
    depensesEcart: siUneDevise(totalSiUneDevise(soustraireParDevise(depensesParDevise, depensesSommeModulesParDevise))),
    depensesEcartParDevise: soustraireParDevise(depensesParDevise, depensesSommeModulesParDevise),
    avoirsExercice: revenusMultiDevise ? null : Math.abs(ventilationRevenus?.composition.avoirs ?? 0),
    avoirsExerciceParDevise: kpiCompta.revenusYtdParDevise.map((g) => ({ monnaie: g.monnaie, total: Math.abs(g.composition.avoirs) })),
    revenusComposition: ventilationRevenus?.composition ?? null,
    revenusCompositionParDevise: kpiCompta.revenusYtdParDevise.map((g) => ({ monnaie: g.monnaie, composition: g.composition })),
    depensesAnalytiques,
    // Coûts analytiques internes : jamais de règlement, devise courante.
    depensesAnalytiquesParDevise: [{ monnaie: devise, total: depensesAnalytiques }],
  }

  const commandesEnAttenteTotalParDevise = sommerParDevise(commandesEnAttente, c => monnaieCommande(c, devise), c => c.total, devise)
  return {
    stats: {
      // Totaux issus de la SSOT (cf. src/lib/kpi/compta.ts).
      revenus: totalSiUneDevise(revenusParDevise),
      revenusParDevise,
      depenses: totalSiUneDevise(depensesParDevise),
      depensesParDevise,
      benefice,
      beneficeParDevise,
      // La marge rapporte deux montants d'une même devise : aucune en multi-devise.
      margePercent: kpiCompta.margePercentYtd === null ? null : Math.round(kpiCompta.margePercentYtd * 10) / 10,
      // BUG #2 — sous-totaux non payés (infos ; le total `depenses` les inclut).
      depensesNonPayees: totalSiUneDevise(kpiCompta.depensesNonPayeesYtdParDevise),
      depensesNonPayeesParDevise: kpiCompta.depensesNonPayeesYtdParDevise,
      nbDepensesNonPayees: kpiCompta.nbDepensesNonPayees,
      revenusNonPayes: totalSiUneDevise(kpiCompta.revenusNonPayesYtdParDevise),
      revenusNonPayesParDevise: kpiCompta.revenusNonPayesYtdParDevise,
      nbRevenusNonPayes: kpiCompta.nbRevenusNonPayes,
      coherenceCheck,
      // Ventilations par module. Revenus : ventilation de la SSOT. Dépenses :
      // ventilation analytique (écart nommé par `coherenceCheck`).
      revenusParModule: revenusMultiDevise ? { elevage: null, verger: null, potager: null, autre: null } : revenus,
      revenusParModuleParDevise,
      depensesParModule: depensesModulesMultiDevise
        ? { elevage: null, verger: null, potager: null, autre: null }
        : { elevage: auCentime(depenses.elevage), verger: auCentime(depenses.verger), potager: auCentime(depenses.potager), autre: auCentime(depenses.autre) },
      depensesParModuleParDevise,
      // YTD vs YTD année dernière.
      revenusAnneePrecedente: totalSiUneDevise(kpiCompta.revenusN1YtdParDevise),
      revenusAnneePrecedenteParDevise: kpiCompta.revenusN1YtdParDevise,
      revenusAnneePrecedenteTotal: totalSiUneDevise(kpiCompta.revenusN1TotalParDevise),
      revenusAnneePrecedenteTotalParDevise: kpiCompta.revenusN1TotalParDevise,
      depensesAnneePrecedente: totalSiUneDevise(kpiCompta.depensesN1YtdParDevise),
      depensesAnneePrecedenteParDevise: kpiCompta.depensesN1YtdParDevise,
      depensesAnneePrecedenteTotal: totalSiUneDevise(kpiCompta.depensesN1TotalParDevise),
      depensesAnneePrecedenteTotalParDevise: kpiCompta.depensesN1TotalParDevise,
      comparisonMode: 'ytd-vs-ytd-n-1',
      facturesImpayees: impayeesExercice.items.length,
      facturesImpayeesTotal: facturesImpayeesParDevise.length > 1 ? null : impayeesExercice.total,
      facturesImpayeesParDevise,
      facturesImpayeesDevise: facturesImpayeesParDevise.length === 1 ? facturesImpayeesParDevise[0].monnaie : null,
      stocksBas: Number(stocksBasAliments[0]?.count || 0) + stocksBasGraines,
      // QA 2026-05-15 — Bug #5 : commandes boutique en attente de livraison.
      commandesEnAttente: commandesEnAttente.length,
      commandesEnAttenteTotal: totalSiUneDevise(commandesEnAttenteTotalParDevise),
      // Contexte de commande figé quand il existe ; sinon devise courante.
      commandesEnAttenteTotalParDevise,
    },
    charts: { mensuel, revenusParCategorie, depensesParCategorie, parModule },
    activity: { dernieresTransactions, facturesImpayees, alertesStock },
    meta: { year, devise, generatedAt: new Date().toISOString() },
  }
}

export type StatsExercice = Awaited<ReturnType<typeof calculerStatsExercice>>
