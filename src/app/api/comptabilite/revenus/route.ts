/**
 * API Revenus unifiés
 * GET /api/comptabilite/revenus
 * Agrège tous les revenus de tous les modules
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { getKpiCompta } from '@/lib/kpi'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const module = searchParams.get('module') // potager, verger, elevage, autre
    const limit = parseInt(searchParams.get('limit') || '200')

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    // Récupérer toutes les sources de revenus
    const [
      ventesElevage,
      recoltesArbres,
      venteBois,
      venteAbattage,
      recoltesPotager,
      ventesManuelles,
      commandesBoutique,
      paiesLait,
    ] = await Promise.all([
      // VenteProduit (elevage)
      prisma.venteProduit.findMany({
        where: {
          userId,
          annule: { not: true },
          date: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { date: 'desc' },
      }),

      // RecolteArbre avec prix (verger fruits) — uniquement vendues
      prisma.recolteArbre.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixKg: { not: null },
        },
        orderBy: { dateVente: 'desc' },
        include: {
          arbre: { select: { nom: true, espece: true } },
        },
      }),

      // ProductionBois avec vente (verger bois)
      prisma.productionBois.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          arbre: { select: { nom: true } },
        },
      }),

      // Abattage avec vente
      prisma.abattage.findMany({
        where: {
          userId,
          annule: { not: true },
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
        },
        orderBy: { date: 'desc' },
        include: {
          animal: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
          lot: { select: { nom: true, especeAnimale: { select: { nom: true } } } },
        },
      }),

      // Recolte potager vendue
      prisma.recolte.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixTotal: { not: null },
        },
        orderBy: { dateVente: 'desc' },
      }),

      // VenteManuelle : on exclut les auto=true (réinjectées via leurs sources
      // brutes VenteProduit, Abattage, Recolte…) SAUF celles de la boutique,
      // qui n'ont pas de source brute réinjectée ici. Sans cette exception, une
      // commande confirmée était comptée dans le total (getKpiCompta) mais
      // absente de la liste des transactions (audit 2026-07, high #2). Les
      // inclure alimente aussi commandeIdsDejaComptees → pas de double ligne.
      prisma.venteManuelle.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          OR: [
            { auto: { not: true } },
            { auto: true, sourceType: 'commande_boutique' },
          ],
        },
        orderBy: { date: 'desc' },
      }),

      // CommandeBoutique livrées - revenus de la boutique en ligne
      prisma.commandeBoutique.findMany({
        where: {
          userId,
          statut: 'livree',
          createdAt: { gte: startOfYear, lte: endOfYear },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          lignes: { select: { nom: true, quantite: true, unite: true } },
        },
      }),

      // PaieLait (chèque laiterie) — revenu n°1 d'un éleveur laitier livreur.
      // La recette est aussi comptée dans getKpiCompta via une VenteManuelle
      // auto (sourceType 'paie_lait'), exclue de la liste plus bas → pas de
      // double ligne. Ajoutée à la liste ici pour être visible en transactions.
      prisma.paieLait.findMany({
        where: { userId, annee: year },
        orderBy: [{ mois: 'desc' }],
      }),
    ])

    // Transformer en format unifié
    type UnifiedRevenue = {
      id: string
      source: string
      sourceId: number
      module: string
      date: string
      description: string
      quantite: number | null
      unite: string | null
      prixUnitaire: number | null
      montant: number
      client: string | null
      paye: boolean | null
      categorie: string
    }

    const revenues: UnifiedRevenue[] = []

    // VenteProduit -> revenus
    ventesElevage.forEach(v => {
      revenues.push({
        id: `vente-${v.id}`,
        source: 'VenteProduit',
        sourceId: v.id,
        module: 'elevage',
        date: v.date.toISOString(),
        description: v.description || `Vente ${v.type}`,
        quantite: v.quantite,
        unite: v.unite,
        prixUnitaire: v.prixUnitaire,
        montant: v.prixTotal,
        client: v.client,
        paye: v.paye,
        categorie: v.type === 'oeufs' ? 'Oeufs' :
                   v.type === 'viande' ? 'Viande' :
                   v.type === 'animal_vivant' ? 'Animal vivant' :
                   v.type === 'lait' ? 'Lait' :
                   v.type === 'fromage' ? 'Fromage' : 'Autre élevage',
      })
    })

    // RecolteArbre -> revenus
    recoltesArbres.forEach(r => {
      revenues.push({
        id: `recolte-arbre-${r.id}`,
        source: 'RecolteArbre',
        sourceId: r.id,
        module: 'verger',
        date: (r.dateVente || r.date).toISOString(),
        description: `Récolte ${r.arbre?.espece || r.arbre?.nom || 'fruits'}`,
        quantite: r.quantite,
        unite: 'kg',
        prixUnitaire: r.prixKg,
        montant: r.quantite * (r.prixKg || 0),
        client: null,
        paye: null, // Pas de tracking paiement
        categorie: 'Fruits',
      })
    })

    // ProductionBois -> revenus
    venteBois.forEach(b => {
      // DEV1 Ticket 4 (audit QA 2026-05-14) : avant ce fix, `client` et
      // `paye` étaient hardcodés à null. La ligne affichée dans
      // /comptabilite/transactions présentait "Client : vide" + "Statut : N/A"
      // alors que le champ existe en BDD (b.clientNom) et que la vente est
      // de facto encaissée si une dateVente / factureId est set.
      const facturee = b.factureId != null || b.dateVente != null
      revenues.push({
        id: `bois-${b.id}`,
        source: 'ProductionBois',
        sourceId: b.id,
        module: 'verger',
        date: (b.dateVente || b.date).toISOString(),
        description: `Vente bois ${b.type} ${b.arbre?.nom || ''}`.trim(),
        quantite: b.volumeM3 || b.poidsKg,
        unite: b.volumeM3 ? 'm³' : 'kg',
        prixUnitaire: null,
        montant: b.prixVente || 0,
        client: b.clientNom ?? null,
        // Si dateVente est renseigné OU une facture a été créée, on
        // considère la transaction payée. Sinon, statut "à régler".
        paye: facturee,
        categorie: 'Bois',
      })
    })

    // Abattage -> revenus
    venteAbattage.forEach(a => {
      const nom = a.animal?.nom || a.lot?.nom ||
                  a.animal?.especeAnimale?.nom || a.lot?.especeAnimale?.nom || 'animal'
      revenues.push({
        id: `abattage-${a.id}`,
        source: 'Abattage',
        sourceId: a.id,
        module: 'elevage',
        date: a.date.toISOString(),
        description: `Vente viande ${nom}`,
        quantite: a.poidsCarcasse || a.quantite,
        unite: a.poidsCarcasse ? 'kg' : 'unité',
        prixUnitaire: null,
        montant: a.prixVente || 0,
        client: null,
        paye: null,
        categorie: 'Viande',
      })
    })

    // Recolte potager -> revenus
    recoltesPotager.forEach(r => {
      revenues.push({
        id: `recolte-potager-${r.id}`,
        source: 'Recolte',
        sourceId: r.id,
        module: 'potager',
        date: (r.dateVente || r.date).toISOString(),
        description: `Vente ${r.especeId}`,
        quantite: r.quantite,
        unite: 'kg',
        prixUnitaire: r.prixKg,
        montant: r.prixTotal || (r.quantite * (r.prixKg || 0)),
        client: r.clientNom,
        paye: true, // statut='vendu' implique payé
        categorie: 'Légumes',
      })
    })

    // VenteManuelle -> revenus
    // Bug feedback cmpkyeynq — Quand une VenteManuelle a été créée depuis
    // une CommandeBoutique livrée, son `clientNom` est souvent vide
    // (l'écran "/comptabilite/transactions" affichait alors "-" pour le
    // client alors que le nom était dans la commande source). On résout
    // par jointure pour les sourceType='commande_boutique'.
    const boutiqueClientById = new Map<number, string | null>(
      commandesBoutique.map(c => [c.id, c.clientNom])
    )
    ventesManuelles.forEach(v => {
      const fallbackClient =
        v.sourceType === 'commande_boutique' && v.sourceId != null
          ? boutiqueClientById.get(v.sourceId) ?? null
          : null
      revenues.push({
        id: `manuel-${v.id}`,
        source: 'VenteManuelle',
        sourceId: v.id,
        module: v.module || 'autre',
        date: v.date.toISOString(),
        description: v.description,
        quantite: v.quantite,
        unite: v.unite,
        prixUnitaire: v.prixUnitaire,
        montant: v.montant,
        client: v.clientNom || fallbackClient,
        paye: v.paye,
        categorie: v.categorie === 'legumes' ? 'Légumes' :
                   v.categorie === 'fruits' ? 'Fruits' :
                   v.categorie === 'transformation' ? 'Transformation' :
                   v.categorie === 'service' ? 'Service' : 'Autre',
      })
    })

    // CommandeBoutique livrées -> revenus
    //
    // DEV1 Ticket 3 (audit QA 2026-05-14) : pour chaque commande livrée,
    // une VenteManuelle existe déjà (créée par confirmCommandeBoutique ou
    // par le seed). Sans dédoublonnage, chaque CMD-XXXX apparaissait 2 fois
    // dans /comptabilite/transactions : 1 ligne module 'general' (depuis
    // VenteManuelle) + 1 ligne module 'boutique' (ici).
    //
    // Règle : on n'émet la ligne 'CommandeBoutique' QUE si aucune
    // VenteManuelle ne référence déjà cette commande
    // (sourceType='commande_boutique', sourceId=c.id).
    const commandeIdsDejaComptees = new Set(
      ventesManuelles
        .filter((v) => v.sourceType === 'commande_boutique' && v.sourceId != null)
        .map((v) => v.sourceId as number)
    )

    commandesBoutique.forEach(c => {
      if (commandeIdsDejaComptees.has(c.id)) return // déjà comptée via VenteManuelle
      if (c.venteManuelleId != null) return // safeguard supplémentaire

      const description = c.lignes.length > 0
        ? `Commande boutique ${c.numero} : ${c.lignes.slice(0, 3).map(l => `${l.quantite} ${l.unite} ${l.nom}`).join(', ')}${c.lignes.length > 3 ? '...' : ''}`
        : `Commande boutique ${c.numero}`
      revenues.push({
        id: `boutique-${c.id}`,
        source: 'CommandeBoutique',
        sourceId: c.id,
        module: 'boutique',
        date: c.createdAt.toISOString(),
        description,
        quantite: null,
        unite: null,
        prixUnitaire: null,
        montant: c.total,
        client: c.clientNom,
        paye: true, // commande livrée = encaissée
        categorie: 'Boutique en ligne',
      })
    })

    // PaieLait -> revenus. Affiché en TTC (montantHT × 1,055) pour rester
    // homogène avec les autres lignes (VenteProduit.prixTotal = TTC) et avec le
    // CA de getKpiCompta, qui compte la paie via sa VenteManuelle auto en TTC.
    // Sinon `stats.total` (somme des lignes) divergeait du CA de la TVA.
    paiesLait.forEach(p => {
      const montantTTC = Number(p.montantHT) * 1.055
      const litres = Number(p.litres)
      revenues.push({
        id: `paie-lait-${p.id}`,
        source: 'PaieLait',
        // sourceId synthétique aligné sur la VenteManuelle auto (annee*100+mois).
        sourceId: p.annee * 100 + p.mois,
        module: 'elevage',
        date: new Date(year, p.mois - 1, 1).toISOString(),
        description: `Paie du lait ${String(p.mois).padStart(2, '0')}/${p.annee}${p.laiterie ? ` — ${p.laiterie}` : ''}`,
        quantite: litres || null,
        unite: 'L',
        prixUnitaire: litres > 0 ? Math.round((montantTTC / litres) * 100) / 100 : null,
        montant: Math.round(montantTTC * 100) / 100,
        client: p.laiterie ?? null,
        paye: true,
        categorie: 'Lait',
      })
    })

    // Filtrer par module si spécifié
    let filtered = revenues
    if (module) {
      filtered = revenues.filter(r => r.module === module)
    }

    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Limiter
    const limited = filtered.slice(0, limit)

    // Total agrégé : on s'aligne sur la source unique de vérité (getKpiCompta).
    // L'ancien `filtered.reduce(...)` agrégeait les "sources brutes" potager
    // (recoltes vendues) + verger (recoltesArbres) + elevage (venteProduit) +
    // autres (venteManuelle) ; selon la couverture des doublons auto-compta,
    // le résultat divergeait du total exposé par /api/comptabilite/stats.
    // Désormais le total = VenteManuelle + LigneFacture (factures non
    // annulées), identique sur tous les écrans.
    const asOf = new Date()
    const kpiCompta = !module ? await getKpiCompta(userId, year, asOf) : null

    const stats = {
      // Bug R27 : le total doit être la SOMME DES LIGNES affichées (sources
      // brutes), sinon l'utilisateur additionne les transactions et n'obtient
      // pas le total (écart « fantôme » avec getKpiCompta qui agrège les
      // VenteManuelle, dont les écritures auto peuvent être désynchronisées).
      total: filtered.reduce((sum, r) => sum + r.montant, 0),
      count: filtered.length,
      parModule: {
        potager: filtered.filter(r => r.module === 'potager').reduce((sum, r) => sum + r.montant, 0),
        verger: filtered.filter(r => r.module === 'verger').reduce((sum, r) => sum + r.montant, 0),
        elevage: filtered.filter(r => r.module === 'elevage').reduce((sum, r) => sum + r.montant, 0),
        boutique: filtered.filter(r => r.module === 'boutique').reduce((sum, r) => sum + r.montant, 0),
        autre: filtered.filter(r => r.module === 'autre').reduce((sum, r) => sum + r.montant, 0),
      },
      parCategorie: Object.entries(
        filtered.reduce((acc, r) => {
          acc[r.categorie] = (acc[r.categorie] || 0) + r.montant
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
    console.error('GET /api/comptabilite/revenus error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
