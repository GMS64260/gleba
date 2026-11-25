/**
 * API Dépenses unifiées
 * GET /api/comptabilite/depenses
 * Agrège toutes les dépenses de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { enrichirLignesReglements } from '@/lib/comptabilite/projection-reglements'
import { MODULES_COMPTA, bucketModuleCompta, ventilerParModule } from '@/lib/comptabilite/modules'
import { chargerSuiviDesDepenses, MIROIR_DEPENSE_PAR_SOURCE } from '@/lib/comptabilite/suivi-ecriture'
import { deviseCouranteExploitation } from '@/lib/comptabilite/devise-reglement'
import { chargerDevisesDossiers, cleDossierDepense, cleDossierDepenseSource } from '@/lib/comptabilite/devise-ecritures'
import { sommerParDevise } from '@/lib/comptabilite/totaux-devise'
import { libelleCategorieDepense } from '@/lib/comptabilite/stats-exercice'
import type { Devise } from '@/lib/territoires'

/**
 * Miroirs comptables automatiques dont aucune table d'origine n'est relue par
 * cette liste : ils y entrent tels quels. Tout autre miroir est représenté par
 * sa source (soin, aliment, intervention, achat…) ; il n'entre lui-même dans
 * la liste que si aucune ligne de l'exercice ne le représente (voir
 * `miroirsComptables`).
 */
const MIROIRS_SANS_SOURCE_RELUE = ['caisse']

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const moduleDemande = searchParams.get('module')
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
      campagnes,
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

      // Arbre (achats) : même date que son miroir comptable (achat, sinon
      // plantation, sinon création) ; sans date, il manquait à la liste.
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
        orderBy: { dateAchat: 'desc' },
      }),

      prisma.campagnePlantation.findMany({
        where: { userId, coutReel: { gt: 0 }, OR: [
          { datePlantationReelle: { gte: startOfYear, lte: endOfYear } },
          { datePlantationReelle: null, datePlantationPrevue: { gte: startOfYear, lte: endOfYear } },
          { datePlantationReelle: null, datePlantationPrevue: null, createdAt: { gte: startOfYear, lte: endOfYear } },
        ] },
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
      // Exception : un miroir automatique SANS source relue plus haut n'a que
      // cette ligne. Les frais de marché d'une clôture de caisse étaient
      // comptés par les rapports et introuvables ici, donc impossibles à
      // régler (FB-7C4K9D).
      prisma.depenseManuelle.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          OR: [{ auto: { not: true } }, { auto: true, sourceType: { in: MIROIRS_SANS_SOURCE_RELUE } }],
        },
        orderBy: { date: 'desc' },
      }),
    ])

    // FB-U56YHR — un lot ou un animal acheté sans date d'arrivée est compté
    // dans les rapports à la date figée de son miroir comptable, mais le
    // filtre sur `dateArrivee` ne le laissait jamais entrer dans la liste.
    // On le reprend à la date de ce miroir : liste et rapports disent pareil.
    const miroirsSansDate = await prisma.depenseManuelle.findMany({
      where: {
        userId, auto: true, date: { gte: startOfYear, lte: endOfYear },
        sourceType: { in: ['achat_animal', 'achat_animal_individuel'] },
      },
      select: { sourceType: true, sourceId: true, date: true },
    })
    const dateMiroir = (type: string) => new Map(
      miroirsSansDate.filter((m) => m.sourceType === type && m.sourceId != null).map((m) => [m.sourceId!, m.date]),
    )
    const datesLots = dateMiroir('achat_animal')
    const datesAnimaux = dateMiroir('achat_animal_individuel')
    const [lotsSansDate, animauxSansDate] = await Promise.all([
      datesLots.size ? prisma.lotAnimaux.findMany({
        where: { userId, id: { in: [...datesLots.keys()] }, dateArrivee: null, prixAchatTotal: { not: null } },
        include: { especeAnimale: { select: { nom: true } } },
      }) : [],
      datesAnimaux.size ? prisma.animal.findMany({
        where: { userId, id: { in: [...datesAnimaux.keys()] }, dateArrivee: null, prixAchat: { not: null }, prixAchatInclusDansLot: false },
        include: { especeAnimale: { select: { nom: true } } },
      }) : [],
    ])
    achatsLots.push(...lotsSansDate)
    achatsAnimaux.push(...animauxSansDate)

    // Miroirs comptables automatiques de l'exercice : ce que les rapports, le
    // FEC et la TVA comptent (`comptable: true`). La liste montre d'ordinaire
    // leur source ; un miroir que plus aucune ligne ne représente (source
    // supprimée avec sa planche ou par « Vider mes données », ou datée d'un
    // autre exercice que son miroir) y entre tel quel plus bas, sans quoi l'exercice affichait
    // 770 € dans Rapports et aucune dépense ici (défaut D19 de l'équipe debug).
    const miroirsComptables = await prisma.depenseManuelle.findMany({
      where: {
        userId, date: { gte: startOfYear, lte: endOfYear },
        comptable: true, auto: true, sourceType: { notIn: MIROIRS_SANS_SOURCE_RELUE }, sourceId: { not: null },
      },
      orderBy: { date: 'desc' },
    })
    const cleMiroir = (sourceType: string, sourceId: number) => `${sourceType}:${sourceId}`
    const miroirParSource = new Map(miroirsComptables.map((m) => [cleMiroir(m.sourceType!, m.sourceId!), m]))

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
      /** Miroir comptable listé faute de ligne source sur l'exercice. */
      sourceAbsente?: boolean
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
      modeReglement?: string | null
      numeroPiece?: string | null
      tauxTVA?: number | null
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

    // Fertilisation -> dépenses (prix per-user avec fallback global).
    // Une fertilisation reprise d'une sauvegarde porte un miroir comptable
    // (`createDepenseFromFertilisation`) : la ligne suit alors ce miroir, son
    // montant figé et son caractère comptable, comme les rapports. Sans miroir
    // c'est un coût interne, valorisé au prix courant.
    fertilisations.forEach(f => {
      const userPrix = f.fertilisant.userStocks?.[0]?.prix ?? f.fertilisant.prix
      const miroir = miroirParSource.get(cleMiroir('fertilisation', f.id))
      const montant = miroir ? miroir.montant : f.quantite * (userPrix || 0)
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
          // Le montant d'un miroir est figé au prix du jour de sa création.
          prixUnitaire: miroir ? (f.quantite > 0 ? miroir.montant / f.quantite : null) : userPrix,
          montant,
          fournisseur: null,
          paye: null,
          categorie: 'Fertilisation',
          comptable: Boolean(miroir),
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
        date: (l.dateArrivee || datesLots.get(l.id) || l.createdAt).toISOString(),
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
        date: (a.dateArrivee || datesAnimaux.get(a.id) || a.createdAt).toISOString(),
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

    campagnes.forEach(c => expenses.push({
      id: `campagne-${c.id}`, source: 'CampagnePlantation', sourceId: c.id, module: 'verger',
      date: (c.datePlantationReelle ?? c.datePlantationPrevue ?? c.createdAt).toISOString(),
      description: `Campagne de plantation - ${c.nom}`, quantite: null, unite: null, prixUnitaire: null,
      montant: c.coutReel ?? 0, fournisseur: c.pepiniere, paye: null, categorie: 'Plantations', comptable: true,
    }))

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

    // Un miroir comptable que rien ne représente est listé tel quel : jamais
    // en plus de sa source (elle porterait deux fois le même montant).
    const sourcesListees = new Set(expenses.flatMap((e) =>
      MIROIR_DEPENSE_PAR_SOURCE[e.source] ? [cleMiroir(MIROIR_DEPENSE_PAR_SOURCE[e.source], e.sourceId)] : []))
    const miroirsSansLigne = miroirsComptables.filter((m) => !sourcesListees.has(cleMiroir(m.sourceType!, m.sourceId!)))
    const idsSansLigne = new Set(miroirsSansLigne.map((m) => m.id))
    depensesManuelles.push(...miroirsSansLigne)

    // DepenseManuelle -> dépenses
    depensesManuelles.forEach(d => {
      expenses.push({
        id: `depense-${d.id}`,
        source: 'DepenseManuelle',
        sourceId: d.id,
        // Une saisie manuelle se corrige ici ; un miroir automatique (frais
        // de marché) se corrige à sa source, le serveur refuse de le modifier.
        corrigeable: !d.auto,
        ...(idsSansLigne.has(d.id) ? { sourceAbsente: true } : {}),
        module: d.module || 'autre',
        date: d.date.toISOString(),
        description: d.description,
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: d.montant,
        fournisseur: d.fournisseurNom,
        paye: d.paye,
        modeReglement: d.modeReglement ?? null,
        numeroPiece: d.numeroPiece ?? null,
        tauxTVA: d.tauxTVA ?? null,
        categorie: libelleCategorieDepense(d.categorie),
        comptable: d.comptable,
      })
    })

    // Filtrer par module si spécifié. Le filtre suit la même règle que les
    // cartes de total (ticket cmsx69cuc) : demander « Autre » rend aussi les
    // écritures imputées à un module hors liste (`general`), sans quoi la
    // carte annoncerait un montant que le filtre ne sait pas montrer. Un
    // module hors des quatre postes (ex. `boutique`) reste filtré à l'exact.
    let filtered = expenses
    if (moduleDemande) {
      const demande = moduleDemande.trim().toLowerCase()
      filtered = (MODULES_COMPTA as readonly string[]).includes(demande)
        ? expenses.filter(e => bucketModuleCompta(e.module) === demande)
        : expenses.filter(e => e.module === moduleDemande)
    }

    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Devise figée d'une dépense (lot devise-totaux-api, tour 2) : celle de
    // son dossier de règlement, figée au premier règlement. Une dépense sans
    // dossier n'a pas de devise figée : pas de `monnaie`, la devise courante
    // s'applique. Les coûts analytiques (soins, aliments, fertilisations sans
    // miroir comptable) n'ont jamais de règlement.
    const exploitation = await prisma.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } })
    const devise = deviseCouranteExploitation(exploitation)
    const identitesManuelles = new Map(depensesManuelles.map((d) => [d.id, d]))
    const cleDossier = (e: UnifiedExpense): string | null =>
      e.source === 'DepenseManuelle'
        ? cleDossierDepense(identitesManuelles.get(e.sourceId) ?? { id: e.sourceId, auto: false, sourceType: null, sourceId: null, sourceRef: null })
        : MIROIR_DEPENSE_PAR_SOURCE[e.source]
          ? cleDossierDepenseSource(MIROIR_DEPENSE_PAR_SOURCE[e.source], e.sourceId)
          : null
    const devisesFigees = await chargerDevisesDossiers(userId, filtered.map(cleDossier).filter((c): c is string => c !== null))
    const monnaieFigee = (e: UnifiedExpense) => {
      const cle = cleDossier(e)
      return cle !== null && devisesFigees.has(cle) ? { monnaie: devisesFigees.get(cle)! } : {}
    }
    const monnaieLigne = (e: UnifiedExpense): Devise | null => {
      const cle = cleDossier(e)
      return cle !== null && devisesFigees.has(cle) ? devisesFigees.get(cle)! : devise
    }

    // Limiter
    const page = filtered.slice(0, limit)
    const suivi = await chargerSuiviDesDepenses(userId, page)
    const limited = (await enrichirLignesReglements(userId, 'depense', page.map((d) => ({ ...d, ...suivi.get(d.id) })), depensesManuelles))
      .map((l) => ({ ...l, ...monnaieFigee(l) }))

    // Calculer les stats
    const comptables = filtered.filter((e) => e.comptable)
    // Une devise, un groupe : jamais de somme EUR + XPF. Les totaux
    // historiques valent `null` dès que deux devises coexistent.
    const devisesLignes = sommerParDevise(filtered, monnaieLigne, () => 0, devise).map((g) => g.monnaie)
    const parDevise = devisesLignes.map((monnaie) => {
      const lignes = comptables.filter((e) => monnaieLigne(e) === monnaie)
      return {
        monnaie,
        count: filtered.filter((e) => monnaieLigne(e) === monnaie).length,
        total: Math.round(lignes.reduce((sum, e) => sum + e.montant, 0) * 100) / 100,
        totalAnalytique: Math.round(filtered.filter((e) => !e.comptable && monnaieLigne(e) === monnaie).reduce((sum, e) => sum + e.montant, 0) * 100) / 100,
        parModule: ventilerParModule(lignes, (e) => e.montant, (e) => e.module),
      }
    })
    const multiDevise = parDevise.length > 1
    const stats = {
      // Le total comptable est celui des rapports, du FEC et de la TVA : les
      // lignes `comptable`. Soins et aliments sont des consommations internes,
      // jamais ajoutées à la facture d'achat qui a approvisionné le stock. Une
      // fertilisation reprise d'une sauvegarde fait exception tant que son
      // miroir est comptable (décision ouverte, voir la note de comptabilité).
      total: multiDevise ? null : comptables.reduce((sum, e) => sum + e.montant, 0),
      totalComptable: multiDevise ? null : comptables.reduce((sum, e) => sum + e.montant, 0),
      totalAnalytique: multiDevise ? null : filtered.filter((e) => !e.comptable).reduce((sum, e) => sum + e.montant, 0),
      parDevise,
      count: filtered.length,
      // Ticket cmsx69cuc — la somme des quatre postes est désormais EGALE au
      // total comptable : les modules hors liste (`general`, `boutique`) sont
      // rangés en « Autre » au lieu d'être ignorés par les quatre filtres.
      parModule: multiDevise ? null : ventilerParModule(comptables, (e) => e.montant, (e) => e.module),
      // Une part par catégorie ET par devise (`monnaie`) : jamais de somme.
      parCategorie: [...comptables.reduce((acc, e) => {
        const monnaie = monnaieLigne(e)
        const cle = JSON.stringify([e.categorie, monnaie])
        const part = acc.get(cle) ?? { categorie: e.categorie, monnaie, montant: 0 }
        part.montant += e.montant
        return acc.set(cle, part)
      }, new Map<string, { categorie: string; monnaie: ReturnType<typeof monnaieLigne>; montant: number }>()).values()],
    }

    return NextResponse.json({
      data: limited,
      stats,
      meta: { year, module: moduleDemande, total: filtered.length },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/depenses error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
