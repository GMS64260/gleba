/** Transactions : mêmes ventes et factures signées que le calcul comptable. */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { chargerFacturesRevenus, whereVentesRevenus } from '@/lib/kpi/compta'
import { moduleDeVente, ventilerRevenusParDevise } from '@/lib/comptabilite/ventilation-revenus'
import { deviseCouranteExploitation, monnaieFacture } from '@/lib/comptabilite/devise-reglement'
import { monnaieVente } from '@/lib/comptabilite/devise-vente'
import type { Devise } from '@/lib/territoires'
import { sommerParDevise, totalSiUneDevise } from '@/lib/comptabilite/totaux-devise'
import { chargerSuiviDesLignes } from '@/lib/comptabilite/suivi-ecriture'
import { enrichirLignesReglements } from '@/lib/comptabilite/projection-reglements'
import { MODELES_STOCK_COMMERCIAL } from '@/lib/commercial/stock-types'
import { bucketModuleCompta } from '@/lib/comptabilite/modules'

// Les miroirs gardent l'accès à leur atelier ; leur montant et leur date font foi.
const SOURCES: Record<string, { source: string; prefixe: string; categorie: string }> = {
  recolte: { source: MODELES_STOCK_COMMERCIAL.recolte, prefixe: 'recolte-potager', categorie: 'Légumes' },
  recolte_arbre: { source: MODELES_STOCK_COMMERCIAL.fruit, prefixe: 'recolte-arbre', categorie: 'Fruits' },
  production_bois: { source: MODELES_STOCK_COMMERCIAL.bois, prefixe: 'bois', categorie: 'Bois' },
  vente_produit: { source: 'VenteProduit', prefixe: 'vente', categorie: 'Élevage' },
  abattage: { source: 'Abattage', prefixe: 'abattage', categorie: 'Viande' },
  paie_lait: { source: 'PaieLait', prefixe: 'paie-lait', categorie: 'Lait' },
}
const CATEGORIES: Record<string, string> = {
  legumes: 'Légumes', fruits: 'Fruits', bois: 'Bois', oeufs: 'Œufs', viande: 'Viande', lait: 'Lait',
  fromage: 'Fromage', produits_ruche: 'Produits de la ruche', transformation: 'Transformation',
  animal_vivant: 'Animaux vivants', service: 'Services', epicerie: 'Épicerie', autre: 'Autre',
}
interface Revenu {
  id: string; source: string; sourceId: number; corrigeable: boolean; module: string; date: string;
  description: string; quantite: number | null; unite: string | null; prixUnitaire: number | null;
  montant: number; client: string | null; paye: boolean | null; categorie: string;
  modeReglement?: string | null; numeroPiece?: string | null; tauxTVA?: number | null;
  factureId?: number | null; reglementsDisponibles?: boolean;
  /** Devise figée de la pièce ; `null` : devise historique inconnue. */
  monnaie: Devise | null;
}
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const params = request.nextUrl.searchParams
    const maintenant = new Date()
    const year = params.has('year') ? Number(params.get('year')) : maintenant.getFullYear()
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
    const userId = session.user.id
    const debut = new Date(year, 0, 1)
    // Exercice entier, comme Transactions > Dépenses : borner l'année en cours à
    // « maintenant » faisait disparaître une vente datée de demain (revue du 2026-10-29).
    const fin = new Date(year, 11, 31, 23, 59, 59, 999)
    const [ventes, factures, exploitation] = await Promise.all([
      prisma.venteManuelle.findMany({ where: whereVentesRevenus(userId, debut, fin), orderBy: { date: 'desc' } }),
      chargerFacturesRevenus(userId, debut, fin),
      prisma.exploitation.findUnique({ where: { userId }, select: { devise: true, territoire: true } }),
    ])
    const moduleDemande = params.get('module')
    const filtreBoutique = moduleDemande?.trim().toLowerCase() === 'boutique'
    const moduleFiltre = moduleDemande && !filtreBoutique ? bucketModuleCompta(moduleDemande) : null
    // Boutique désigne le canal de vente, indépendamment de l'atelier
    // d'imputation. Garder les mêmes sources pour les lignes et les totaux.
    const ventesRetenues = filtreBoutique ? ventes.filter(v =>
      v.auto ? v.sourceType === 'commande_boutique' : v.module?.trim().toLowerCase() === 'boutique',
    ) : ventes
    const facturesRetenues = filtreBoutique ? [] : factures
    const deviseCourante = deviseCouranteExploitation(exploitation)
    // Certains anciens miroirs boutique n'ont pas le nom de leur commande.
    const commandesSansNom = ventesRetenues.filter(v => v.auto && v.sourceType === 'commande_boutique' && v.sourceId != null && !v.clientNom)
    const commandes = commandesSansNom.length ? await prisma.commandeBoutique.findMany({
      where: { userId, id: { in: commandesSansNom.map(v => v.sourceId!) } }, select: { id: true, clientNom: true },
    }) : []
    const clientsCommandes = new Map(commandes.map(c => [c.id, c.clientNom]))
    // Seul point de résolution de la devise d'une vente : sa ligne et les
    // totaux par devise lisent la même valeur (QA180 / ADV181).
    const deviseVente = (v: (typeof ventes)[number]) => monnaieVente(v, deviseCourante)
    const lignes: Revenu[] = ventesRetenues.map(v => {
      const origine = v.auto && v.sourceId != null && v.sourceType ? SOURCES[v.sourceType] : null
      return {
        id: origine ? `${origine.prefixe}-${v.sourceId}` : `manuel-${v.id}`,
        source: origine?.source ?? 'VenteManuelle', sourceId: origine ? v.sourceId! : v.id,
        corrigeable: !v.auto, module: moduleDeVente(v), date: v.date.toISOString(),
        description: v.description, quantite: v.quantite, unite: v.unite, prixUnitaire: v.prixUnitaire,
        montant: v.montant, client: v.clientNom || (v.sourceType === 'commande_boutique' && v.sourceId != null ? clientsCommandes.get(v.sourceId) ?? null : null), paye: v.paye,
        categorie: CATEGORIES[v.categorie] ?? origine?.categorie ?? v.categorie, modeReglement: v.modeReglement,
        numeroPiece: v.numeroPiece, tauxTVA: v.tauxTVA, monnaie: deviseVente(v),
      }
    })
    for (const f of facturesRetenues) lignes.push({
      id: `facture-${f.id}`, source: 'Facture', sourceId: f.id, factureId: f.id,
      corrigeable: false, module: f.moduleSource ?? 'autre', date: f.date.toISOString(),
      description: `${f.type === 'avoir' ? 'Avoir' : 'Facture'} ${f.numero}${f.objet ? ` · ${f.objet}` : ''}`,
      quantite: null, unite: null, prixUnitaire: null, montant: (f.type === 'avoir' ? -1 : 1) * f.totalTTC,
      client: f.clientNom, paye: f.type === 'avoir' ? null : f.statut === 'payee',
      categorie: f.type === 'avoir' ? 'Avoirs' : 'Factures', reglementsDisponibles: f.type !== 'avoir',
      // Seule la devise figée sort : l'instantané émetteur (RIB, adresse) reste
      // côté serveur (lot devise-totaux-api).
      monnaie: monnaieFacture(f.emetteurSnapshot, f.date),
    })
    const filtrees = (moduleFiltre ? lignes.filter(l => l.module === moduleFiltre) : lignes)
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    const limite = Math.min(1000, Math.max(1, Number(params.get('limit')) || 200))
    const page = filtrees.slice(0, limite)
    const suivi = await chargerSuiviDesLignes(userId, page)
    const data = await enrichirLignesReglements(userId, 'vente', page.map(l => ({ ...l, ...suivi.get(l.id) })), ventes)
    // Totaux par devise sur tout le périmètre (avant pagination) : une pièce
    // garde sa devise figée, jamais celle, courante, de la ferme.
    const parDevise = ventilerRevenusParDevise(
      moduleFiltre ? ventesRetenues.filter(v => moduleDeVente(v) === moduleFiltre) : ventesRetenues,
      moduleFiltre ? facturesRetenues.filter(f => (f.moduleSource ?? 'autre') === moduleFiltre) : facturesRetenues,
      deviseVente,
      f => monnaieFacture(f.emetteurSnapshot, f.date),
      deviseCourante,
    ).map(({ monnaie, count, total, parModule }) => ({ monnaie, count, total, parModule }))
    // Contrat (lot devise-totaux-api) : chaque total a un voisin `…ParDevise`
    // et vaut `null` dès que deux devises coexistent.
    const multiDevise = parDevise.length > 1
    const parModuleVisible = (pm: Record<string, number>) =>
      Object.fromEntries(Object.entries(pm).map(([m, montant]) => [m, !moduleFiltre || m === moduleFiltre ? montant : 0]))
    const categories = [...new Set(filtrees.map(l => l.categorie))].map(categorie => ({
      categorie,
      parDevise: sommerParDevise(filtrees.filter(l => l.categorie === categorie), l => l.monnaie, l => l.montant, deviseCourante),
    }))
    const categoriesMultiDevise = new Set(categories.flatMap(c => c.parDevise.map(t => t.monnaie))).size > 1
    return NextResponse.json({ data, stats: {
      total: totalSiUneDevise(parDevise), count: filtrees.length,
      totalParDevise: parDevise.map(({ monnaie, total, count }) => ({ monnaie, total, count })),
      parModule: multiDevise
        ? { potager: null, verger: null, elevage: null, autre: null }
        : parModuleVisible(parDevise[0].parModule),
      parModuleParDevise: parDevise.map(({ monnaie, total, count, parModule }) => ({ monnaie, total, count, parModule: parModuleVisible(parModule) })),
      parDevise,
      parCategorie: categories.map(({ categorie, parDevise: pd }) => ({
        categorie,
        montant: categoriesMultiDevise ? null : totalSiUneDevise(pd),
        montantParDevise: pd,
      })),
    }, meta: { year, module: moduleDemande, total: filtrees.length } })
  } catch (err) {
    console.error('GET /api/comptabilite/revenus error:', err)
    return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
  }
}
