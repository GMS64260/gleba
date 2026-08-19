/**
 * API Dépenses unifiées
 * GET /api/comptabilite/depenses
 * Agrège toutes les dépenses de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { MODULES_COMPTA, bucketModuleCompta, ventilerParModule } from '@/lib/comptabilite/modules'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const module = searchParams.get('module')
    const limit = parseInt(searchParams.get('limit') || '200')

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    // Récupérer toutes les sources de dépenses
    const [
      soinsAnimaux,
      operationsArbres,
      consommationsAliments,
      fertilisations,
      achatsLots,
      achatsAnimaux,
      achatsArbres,
      interventions,
      depensesManuelles,
    ] = await Promise.all([
      // SoinAnimal
      prisma.soinAnimal.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          cout: { not: null },
          fait: true,
        },
        orderBy: { date: 'desc' },
        include: {
          animal: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
          lot: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
        },
      }),

      // OperationArbre
      prisma.operationArbre.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          cout: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          arbre: { select: { nom: true, espece: true } },
        },
      }),

      // ConsommationAliment
      prisma.consommationAliment.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
        include: {
          aliment: {
            select: {
              nom: true,
              prix: true,
              userStocks: {
                where: { userId },
                select: { prix: true, coutUnitaire: true },
                take: 1,
              },
            },
          },
          lot: { select: { nom: true } },
        },
      }),

      // Fertilisation
      prisma.fertilisation.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
        include: {
          fertilisant: {
            include: {
              userStocks: {
                where: { userId },
                select: { prix: true },
                take: 1,
              },
            },
          },
        },
      }),

      // LotAnimaux (achats)
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
          prixAchatTotal: { not: null },
        },
        orderBy: { dateArrivee: 'desc' },
        include: {
          especeAnimale: { select: { nom: true } },
        },
      }),

      // Animal (achats individuels)
      prisma.animal.findMany({
        where: {
          userId,
          dateArrivee: { gte: startOfYear, lte: endOfYear },
          prixAchat: { not: null },
          prixAchatInclusDansLot: false,
        },
        orderBy: { dateArrivee: 'desc' },
        include: {
          especeAnimale: { select: { nom: true } },
        },
      }),

      // Arbre (achats)
      prisma.arbre.findMany({
        where: {
          userId,
          prixAchat: { not: null },
          OR: [
            { dateAchat: { gte: startOfYear, lte: endOfYear } },
            { datePlantation: { gte: startOfYear, lte: endOfYear }, dateAchat: null },
          ],
        },
        orderBy: { dateAchat: 'desc' },
      }),

      // Intervention (travaux culturaux : intrants + main d'oeuvre)
      // Ticket cmsx69cuc — cette source manquait à la liste. Son miroir
      // comptable (DepenseManuelle auto, sourceType='intervention') est exclu
      // plus bas comme tous les miroirs, mais aucune ligne ne le remplaçait :
      // l'« Apport compost » de 9,50 € comptait dans le KPI et le Compte de
      // résultat sans apparaître NULLE PART dans Transactions, et le total
      // comptable de l'écran était faux d'autant.
      prisma.intervention.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          coutTotal: { not: null },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          type: true,
          description: true,
          coutTotal: true,
          coutMainOeuvre: true,
          intrantCout: true,
          intrantNom: true,
          fait: true,
          arbreId: true,
          plancheId: true,
        },
      }),

      // DepenseManuelle (exclure auto=true pour eviter le double comptage
      // avec les sources brutes SoinAnimal, ConsommationAliment, Intervention, etc.)
      prisma.depenseManuelle.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          auto: { not: true },
        },
        orderBy: { date: 'desc' },
      }),
    ])

    // Transformer en format unifié
    type UnifiedExpense = {
      id: string
      source: string
      sourceId: number
      /**
       * Écriture saisie à la main, donc corrigeable et supprimable depuis cet
       * écran (2026-08-13). Toute autre ligne est dérivée d'un objet métier :
       * elle se corrige à sa source, jamais ici. Calculé côté serveur pour que
       * l'écran n'ait pas à redéduire la règle.
       */
      corrigeable?: boolean
      module: string
      date: string
      description: string
      quantite: number | null
      unite: string | null
      prixUnitaire: number | null
      montant: number
      fournisseur: string | null
      paye: boolean | null
      categorie: string
      comptable: boolean
    }

    const expenses: UnifiedExpense[] = []

    // SoinAnimal -> dépenses
    soinsAnimaux.forEach(s => {
      const nom = s.animal?.nom || s.lot?.nom ||
                  s.animal?.especeAnimale?.nom || s.lot?.especeAnimale?.nom || ''
      expenses.push({
        id: `soin-${s.id}`,
        source: 'SoinAnimal',
        sourceId: s.id,
        module: 'elevage',
        date: s.date.toISOString(),
        description: `${s.type} ${nom}`.trim(),
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: s.cout || 0,
        fournisseur: null,
        paye: null,
        categorie: 'Soins animaux',
        comptable: false,
      })
    })

    // OperationArbre -> dépenses
    // QA cmsnnud2q — une opération RÉALISÉE avec un coût crée un miroir
    // DepenseManuelle auto `comptable` (createDepenseFromOperationArbre,
    // comptable @default(true)), compté par le KPI du dashboard. La classer
    // ici en analytique faisait diverger le « Total comptable » de la liste
    // du KPI d'exactement ce montant. Même règle que le miroir : comptable
    // si l'opération est faite et coûte réellement.
    operationsArbres.forEach(o => {
      expenses.push({
        id: `operation-${o.id}`,
        source: 'OperationArbre',
        sourceId: o.id,
        module: 'verger',
        date: o.date.toISOString(),
        description: `${o.type} ${o.arbre?.nom || o.arbre?.espece || ''}`.trim(),
        quantite: o.quantite,
        unite: o.unite,
        prixUnitaire: null,
        montant: o.cout || 0,
        fournisseur: null,
        paye: null,
        categorie: 'Opérations arbres',
        comptable: o.fait !== false && (o.cout ?? 0) > 0,
      })
    })

    // ConsommationAliment -> dépenses (prix per-user avec fallback global)
    consommationsAliments.forEach(c => {
      const userPrix = c.aliment.userStocks?.[0]?.coutUnitaire
        ?? c.aliment.userStocks?.[0]?.prix
        ?? c.aliment.prix
      const montant = c.quantite * (userPrix || 0)
      if (montant > 0) {
        expenses.push({
          id: `aliment-${c.id}`,
          source: 'ConsommationAliment',
          sourceId: c.id,
          module: 'elevage',
          date: c.date.toISOString(),
          description: `Aliment ${c.aliment.nom} ${c.lot?.nom || ''}`.trim(),
          quantite: c.quantite,
          unite: 'kg',
          prixUnitaire: userPrix,
          montant,
          fournisseur: null,
          paye: null,
          categorie: 'Aliments',
          comptable: false,
        })
      }
    })

    // Fertilisation -> dépenses (prix per-user avec fallback global)
    fertilisations.forEach(f => {
      const userPrix = f.fertilisant.userStocks?.[0]?.prix ?? f.fertilisant.prix
      const montant = f.quantite * (userPrix || 0)
      if (montant > 0) {
        expenses.push({
          id: `fertilisation-${f.id}`,
          source: 'Fertilisation',
          sourceId: f.id,
          module: 'potager',
          date: f.date.toISOString(),
          description: `${f.fertilisant.id} sur planche ${f.plancheId}`,
          quantite: f.quantite,
          unite: 'kg',
          prixUnitaire: userPrix,
          montant,
          fournisseur: null,
          paye: null,
          categorie: 'Fertilisation',
          comptable: false,
        })
      }
    })

    // LotAnimaux achats -> dépenses
    achatsLots.forEach(l => {
      expenses.push({
        id: `lot-${l.id}`,
        source: 'LotAnimaux',
        sourceId: l.id,
        module: 'elevage',
        date: (l.dateArrivee || l.createdAt).toISOString(),
        description: `Achat lot ${l.nom || l.especeAnimale.nom} (${l.quantiteInitiale})`,
        quantite: l.quantiteInitiale,
        unite: 'unité',
        prixUnitaire: l.prixAchatTotal ? l.prixAchatTotal / l.quantiteInitiale : null,
        montant: l.prixAchatTotal || 0,
        fournisseur: l.provenance,
        paye: null,
        categorie: 'Achats animaux',
        comptable: true,
      })
    })

    // Animal achats -> dépenses
    achatsAnimaux.forEach(a => {
      expenses.push({
        id: `animal-${a.id}`,
        source: 'Animal',
        sourceId: a.id,
        module: 'elevage',
        date: (a.dateArrivee || a.createdAt).toISOString(),
        description: `Achat ${a.nom || a.especeAnimale.nom}`,
        quantite: 1,
        unite: 'unité',
        prixUnitaire: a.prixAchat,
        montant: a.prixAchat || 0,
        fournisseur: a.provenance,
        paye: null,
        categorie: 'Achats animaux',
        comptable: true,
      })
    })

    // Arbre achats -> dépenses
    achatsArbres.forEach(a => {
      expenses.push({
        id: `arbre-${a.id}`,
        source: 'Arbre',
        sourceId: a.id,
        module: 'verger',
        date: (a.dateAchat || a.datePlantation || a.createdAt).toISOString(),
        description: `Achat ${a.nom}${a.fournisseur ? ` (${a.fournisseur})` : ''}`,
        quantite: 1,
        unite: 'unité',
        prixUnitaire: a.prixAchat,
        montant: a.prixAchat || 0,
        fournisseur: a.fournisseur,
        paye: null,
        categorie: 'Achats arbres',
        comptable: true,
      })
    })

    // Intervention -> dépenses (miroir de createDepenseFromIntervention :
    // même montant, même module, même règle « comptable »).
    interventions.forEach(i => {
      const montant = i.coutTotal || 0
      if (montant <= 0) return
      const libelle = i.description
        || `${i.type}${i.intrantNom ? ` - ${i.intrantNom}` : ''}`
      expenses.push({
        id: `intervention-${i.id}`,
        source: 'Intervention',
        sourceId: i.id,
        module: i.arbreId ? 'verger' : 'potager',
        date: i.date.toISOString(),
        description: libelle,
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant,
        fournisseur: null,
        paye: null,
        categorie:
          i.coutMainOeuvre && i.coutMainOeuvre > 0 && !i.intrantCout
            ? "Main d'oeuvre"
            : 'Intrants',
        // Une intervention PLANIFIÉE n'est pas une dépense réelle : c'est déjà
        // la règle du miroir comptable (audit compta 2026-06 #9).
        comptable: i.fait !== false,
      })
    })

    // DepenseManuelle -> dépenses
    depensesManuelles.forEach(d => {
      expenses.push({
        id: `depense-${d.id}`,
        source: 'DepenseManuelle',
        sourceId: d.id,
        // La requête ci-dessus exclut déjà `auto`, toute ligne restante est
        // une saisie manuelle.
        corrigeable: true,
        module: d.module || 'autre',
        date: d.date.toISOString(),
        description: d.description,
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: d.montant,
        fournisseur: d.fournisseurNom,
        paye: d.paye,
        categorie: d.categorie === 'materiel' ? 'Matériel' :
                   d.categorie === 'carburant' ? 'Carburant' :
                   d.categorie === 'main_oeuvre' ? 'Main d\'oeuvre' :
                   d.categorie === 'abonnement' ? 'Abonnement' : 'Autre',
        comptable: d.comptable,
      })
    })

    // Filtrer par module si spécifié. Le filtre suit la même règle que les
    // cartes de total (ticket cmsx69cuc) : demander « Autre » rend aussi les
    // écritures imputées à un module hors liste (`general`), sans quoi la
    // carte annoncerait un montant que le filtre ne sait pas montrer. Un
    // module hors des quatre postes (ex. `boutique`) reste filtré à l'exact.
    let filtered = expenses
    if (module) {
      const demande = module.trim().toLowerCase()
      filtered = (MODULES_COMPTA as readonly string[]).includes(demande)
        ? expenses.filter(e => bucketModuleCompta(e.module) === demande)
        : expenses.filter(e => e.module === module)
    }

    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Limiter
    const limited = filtered.slice(0, limit)

    // Calculer les stats
    const comptables = filtered.filter((e) => e.comptable)
    const stats = {
      // Le total comptable n'additionne jamais une consommation interne à la
      // facture d'achat qui a approvisionné le stock.
      total: comptables.reduce((sum, e) => sum + e.montant, 0),
      totalComptable: comptables.reduce((sum, e) => sum + e.montant, 0),
      totalAnalytique: filtered.filter((e) => !e.comptable).reduce((sum, e) => sum + e.montant, 0),
      count: filtered.length,
      // Ticket cmsx69cuc — la somme des quatre postes est désormais EGALE au
      // total comptable : les modules hors liste (`general`, `boutique`) sont
      // rangés en « Autre » au lieu d'être ignorés par les quatre filtres.
      parModule: ventilerParModule(comptables, (e) => e.montant, (e) => e.module),
      parCategorie: Object.entries(
        comptables.reduce((acc, e) => {
          acc[e.categorie] = (acc[e.categorie] || 0) + e.montant
          return acc
        }, {} as Record<string, number>)
      ).map(([categorie, montant]) => ({ categorie, montant })),
    }

    return NextResponse.json({
      data: limited,
      stats,
      meta: { year, module, total: filtered.length },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/depenses error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
