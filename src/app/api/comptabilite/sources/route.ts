/**
 * API Sources de revenus - Réconciliation
 * GET /api/comptabilite/sources
 *
 * Retourne le breakdown détaillé des revenus par source (table source en base),
 * pour permettre à l'utilisateur de comprendre exactement ce qui contribue à son
 * chiffre d'affaires affiché en comptabilité.
 *
 * NB : ce endpoint est strictement en lecture. La logique de calcul reste celle
 * de /api/comptabilite/revenus (mêmes filtres, mêmes exclusions).
 */

import { chargerFacturesRevenus, whereVentesRevenus } from '@/lib/kpi/compta'
import { moduleDeVente } from '@/lib/comptabilite/ventilation-revenus'
import { bucketModuleCompta } from '@/lib/comptabilite/modules'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { monnaieFacture } from '@/lib/comptabilite/devise-reglement'
import { SELECT_CONTEXTE_FISCAL_VENTE, monnaieVente } from '@/lib/comptabilite/devise-vente'
import { deviseDuTerritoire } from '@/lib/territoires'

interface SourceBreakdown {
  module: string
  source: string
  label: string
  /** Devise figée des écritures du groupe ; `null` : devise historique inconnue. */
  monnaie: 'EUR' | 'XPF' | null
  count: number
  montant: number
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

    // Même périmètre et même filtre d'atelier que la liste des revenus
    // (`revenus/route.ts`) : le détail gardait le total de tous les ateliers
    // sous un filtre, et rangeait ventes et factures autrement qu'elle (D231).
    const moduleDemande = searchParams.get('module')
    const filtreBoutique = moduleDemande?.trim().toLowerCase() === 'boutique'
    const moduleFiltre = moduleDemande && moduleDemande !== 'all' && !filtreBoutique ? bucketModuleCompta(moduleDemande) : null

    // Cette vue part directement de la SSOT comptable : chaque VenteManuelle
    // et chaque facture valide apparaît une seule fois. Elle ne réagrège plus
    // les sources brutes, ce qui élimine les doubles comptes des ventes facturées.
    const [ventes, factures, exploitation] = await Promise.all([
      prisma.venteManuelle.findMany({
        where: whereVentesRevenus(userId, startOfYear, endOfYear),
        select: { montant: true, module: true, categorie: true, sourceType: true, auto: true, ...SELECT_CONTEXTE_FISCAL_VENTE },
      }),
      chargerFacturesRevenus(userId, startOfYear, endOfYear),
      prisma.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } }),
    ])
    const deviseCourante = exploitation?.devise === 'EUR' || exploitation?.devise === 'XPF'
      ? exploitation.devise
      : deviseDuTerritoire(exploitation?.territoire)

    const labels: Record<string, string> = {
      vente_produit: 'Ventes produits élevage',
      abattage: 'Ventes viande (abattages)',
      paie_lait: 'Paies du lait',
      reservation_elevage: 'Acomptes et cessions d’animaux',
      commande_boutique: 'Commandes boutique',
      recolte: 'Récoltes potager',
      recolte_arbre: 'Récoltes de fruits',
      production_bois: 'Ventes de bois',
      manuel: 'Saisies manuelles',
      facture: 'Factures',
    }
    const grouped = new Map<string, SourceBreakdown>()
    // Une ligne par devise : on n'additionne jamais EUR et XPF.
    const add = (module: string, source: string, monnaie: SourceBreakdown['monnaie'], montant: number) => {
      const key = `${module}:${source}:${monnaie ?? '?'}`
      const current = grouped.get(key) ?? {
        module,
        source,
        label: labels[source] ?? source,
        monnaie,
        count: 0,
        montant: 0,
      }
      current.count += 1
      current.montant += montant
      grouped.set(key, current)
    }
    // Boutique désigne le canal de vente, indépendamment de l'atelier d'imputation.
    const estVenteBoutique = (v: (typeof ventes)[number]) =>
      v.auto ? v.sourceType === 'commande_boutique' : v.module?.trim().toLowerCase() === 'boutique'
    for (const vente of ventes) {
      if (filtreBoutique && !estVenteBoutique(vente)) continue
      const moduleVente = moduleDeVente(vente)
      if (moduleFiltre && moduleVente !== moduleFiltre) continue
      add(moduleVente, vente.auto ? (vente.sourceType || 'auto') : 'manuel', monnaieVente(vente, deviseCourante), vente.montant)
    }
    if (!filtreBoutique) for (const facture of factures) {
      const moduleFacture = facture.moduleSource ?? 'autre'
      if (moduleFiltre && moduleFacture !== moduleFiltre) continue
      add(moduleFacture, 'facture', monnaieFacture(facture.emetteurSnapshot, facture.date), facture.type === 'avoir' ? -facture.totalTTC : facture.totalTTC)
    }
    const sources = [...grouped.values()].sort((a, b) => b.montant - a.montant)

    const totaux = new Map<SourceBreakdown['monnaie'], number>()
    for (const x of sources) totaux.set(x.monnaie, (totaux.get(x.monnaie) ?? 0) + x.montant)
    const parDevise = [...totaux].map(([monnaie, montant]) => ({ monnaie, total: Math.round(montant * 100) / 100 }))

    return NextResponse.json({
      year,
      sources,
      parDevise,
      devise: deviseCourante,
    })
  } catch (err) {
    console.error('GET /api/comptabilite/sources error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: 'Erreur interne du serveur' },
      { status: 500 },
    )
  }
}
