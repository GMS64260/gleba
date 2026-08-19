/**
 * Créances impayées — source unique de l'onglet Comptabilité > Factures >
 * Impayées.
 *
 * QA cmsqlqcuq / cmsqmbfxs : l'écran additionnait trois sources sans les
 * réconcilier, et affichait 2 365,48 € là où le Bilan affichait 1 223,44 €
 * pour les mêmes données. Deux défauts, tous deux corrigés ici :
 *
 *   1. Une `VenteProduit` déjà rattachée à une facture était comptée DEUX fois,
 *      une fois par sa facture et une fois par elle-même (la vente « Tomme de
 *      chèvre » à 1 111,24 €).
 *   2. Les avoirs étaient exclus de la liste mais jamais IMPUTÉS sur leur
 *      facture d'origine, alors que le Bilan les déduit déjà — cf. le
 *      commentaire de `src/app/api/comptabilite/bilan/route.ts` : « Un avoir
 *      réduit la créance : on somme donc les factures avec leur signe ».
 *
 * La fonction est pure et testable : l'écran l'appelle avec ce que renvoient
 * les trois routes, et le total qu'elle produit doit être STRICTEMENT égal au
 * champ `creances` de GET /api/comptabilite/bilan.
 */

export interface Impayee {
  id: number
  source: string
  date: string
  type: string
  description: string
  montant: number
  client: string | null
  numero?: string
}

/** Une facture telle que renvoyée par GET /api/comptabilite/factures. */
export interface FactureImpayee {
  id: number
  type?: string | null
  statut?: string | null
  date: string
  numero?: string
  objet?: string | null
  clientNom?: string | null
  totalTTC: number
  factureOrigineId?: number | null
}

/** Une vente de produit telle que renvoyée par GET /api/elevage/ventes. */
export interface VenteImpayee {
  id: number
  date: string
  type: string
  description?: string | null
  prixTotal: number
  client?: string | null
  factureId?: number | null
}

/** Une vente saisie à la main (GET /api/comptabilite/ventes-manuelles). */
export interface VenteManuelleImpayee {
  id: number
  date: string
  categorie: string
  description: string
  montant: number
  client?: string | null
}

/** Arrondi au centime : les montants nets passent par une soustraction. */
function centimes(n: number): number {
  return Math.round(n * 100) / 100
}

export function construireImpayees(sources: {
  factures?: FactureImpayee[]
  ventes?: VenteImpayee[]
  ventesManuelles?: VenteManuelleImpayee[]
}): { items: Impayee[]; total: number } {
  const factures = sources.factures ?? []
  const ventes = sources.ventes ?? []
  const ventesManuelles = sources.ventesManuelles ?? []

  // Un avoir réduit la créance de la facture qu'il corrige.
  const avoirsParOrigine = new Map<number, number>()
  for (const a of factures) {
    if (a.type !== 'avoir' || a.statut === 'annulee' || !a.factureOrigineId) continue
    avoirsParOrigine.set(a.factureOrigineId, (avoirsParOrigine.get(a.factureOrigineId) ?? 0) + a.totalTTC)
  }

  const items: Impayee[] = []
  const facturesRetenues = new Set<number>()

  for (const f of factures) {
    if (f.statut !== 'emise' || f.type === 'avoir') continue
    const net = centimes(f.totalTTC - (avoirsParOrigine.get(f.id) ?? 0))
    // Une facture intégralement soldée par avoir n'est plus une créance.
    if (net <= 0.005) continue
    facturesRetenues.add(f.id)
    items.push({
      id: f.id,
      source: 'Facture',
      date: f.date,
      type: 'facture',
      description: f.objet || `Facture ${f.numero ?? ''}`.trim(),
      montant: net,
      client: f.clientNom ?? null,
      numero: f.numero,
    })
  }

  for (const v of ventes) {
    // Déjà portée par sa facture : ne pas compter la créance deux fois.
    if (v.factureId != null && facturesRetenues.has(v.factureId)) continue
    items.push({
      id: v.id,
      source: 'VenteProduit',
      date: v.date,
      type: v.type,
      description: v.description || `Vente ${v.type}`,
      montant: v.prixTotal,
      client: v.client ?? null,
    })
  }

  for (const m of ventesManuelles) {
    items.push({
      id: m.id,
      source: 'VenteManuelle',
      date: m.date,
      type: m.categorie,
      description: m.description,
      montant: m.montant,
      client: m.client ?? null,
    })
  }

  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return { items, total: centimes(items.reduce((sum, i) => sum + i.montant, 0)) }
}
