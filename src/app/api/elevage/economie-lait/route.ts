/**
 * API Économie du lait & du fromage (PROMPT 22).
 * GET /api/elevage/economie-lait?annee=2026
 *
 * Comble le trou de `analyse-couts` (calibrée œuf/viande) pour le cœur d'une
 * ferme laitière : marge sur coût alimentaire (MCA), coût de revient du litre,
 * rendement fromager et coût de revient du kg de fromage, marge par type de
 * fromage.
 *
 * Affectation des coûts au lait (décision produit, cf. feuille de route vault
 * 2026-07-20) — méthode transparente, renvoyée dans `methode` :
 *   - aliments/soins rattachés à un lot laitier → 100 % ;
 *   - aliments/soins rattachés à un lot non laitier → 0 % ;
 *   - aliments/soins globaux (sans lot ni animal) → au prorata des têtes
 *     laitières dans le cheptel (`partGlobaleLaitiere`).
 *
 * Aucune migration : dérivé des collectes, fabrications, ventes, consommations
 * et soins existants.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { indicateursEconomieLait } from '@/lib/elevage/economie-lait'

const estLaitier = (production?: string | null, productions?: string[] | null): boolean => {
  const p = (production || '').toLowerCase()
  if (p.includes('lait') || p.includes('mixte')) return true
  return (productions || []).some((x) => x.toLowerCase().includes('lait'))
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || `${new Date().getFullYear()}`, 10) || new Date().getFullYear()
    const userId = session.user.id
    const debut = new Date(annee, 0, 1)
    const fin = new Date(annee, 11, 31, 23, 59, 59)

    const [animaux, lots, collectes, fabrications, ventes, consommations, soins, paies] = await Promise.all([
      prisma.animal.findMany({
        where: { userId, statut: 'actif' },
        select: { id: true, especeAnimale: { select: { production: true, productions: true } } },
      }),
      prisma.lotAnimaux.findMany({
        where: { userId, statut: 'actif' },
        select: {
          id: true,
          quantiteActuelle: true,
          especeAnimale: { select: { production: true, productions: true } },
        },
      }),
      prisma.collecteLait.findMany({
        where: { userId, date: { gte: debut, lte: fin } },
        select: { quantiteLitres: true, ecarteAttente: true, lotFromageId: true },
      }),
      prisma.lotFromage.findMany({
        where: { userId, dateFabrication: { gte: debut, lte: fin } },
        select: { typeFromage: true, volumeLaitUtiliseL: true, poidsTotalKg: true, nbPieces: true },
      }),
      prisma.venteProduit.findMany({
        where: { userId, annule: false, date: { gte: debut, lte: fin } },
        select: { type: true, quantite: true, unite: true, prixTotal: true, lotFromageId: true, lotFromage: { select: { typeFromage: true } } },
      }),
      prisma.consommationAliment.findMany({
        where: { userId, date: { gte: debut, lte: fin } },
        select: { quantite: true, lotId: true, aliment: { select: { prix: true } } },
      }),
      prisma.soinAnimal.findMany({
        where: { userId, fait: true, date: { gte: debut, lte: fin }, cout: { not: null } },
        select: { cout: true, animalId: true, lotId: true },
      }),
      // PROMPT 26 — paie du lait (lait livré à la laiterie), revenu majeur d'une
      // ferme laitière livreuse, jusqu'ici absent de la valorisation.
      prisma.paieLait.findMany({
        where: { userId, annee },
        select: { montantHT: true, litres: true },
      }),
    ])

    // Ensembles laitiers
    const animauxLaitiers = new Set(
      animaux.filter((a) => estLaitier(a.especeAnimale?.production, a.especeAnimale?.productions)).map((a) => a.id)
    )
    const lotsLaitiers = new Set(
      lots.filter((l) => estLaitier(l.especeAnimale?.production, l.especeAnimale?.productions)).map((l) => l.id)
    )

    // Prorata têtes laitières (pour les charges globales sans lot ni animal)
    const tetesLaitieres =
      animauxLaitiers.size + lots.filter((l) => lotsLaitiers.has(l.id)).reduce((s, l) => s + (l.quantiteActuelle || 0), 0)
    const tetesTotales =
      animaux.length + lots.reduce((s, l) => s + (l.quantiteActuelle || 0), 0)
    const partGlobaleLaitiere = tetesTotales > 0 ? tetesLaitieres / tetesTotales : 0

    // Production
    const litresProduits = collectes.reduce((s, c) => s + Number(c.quantiteLitres), 0)
    const litresEcartes = collectes.filter((c) => c.ecarteAttente).reduce((s, c) => s + Number(c.quantiteLitres), 0)

    // Transformation (fabrications de l'année)
    const litresTransformes = fabrications.reduce((s, f) => s + Number(f.volumeLaitUtiliseL), 0)
    const kgFromage = fabrications.reduce((s, f) => s + Number(f.poidsTotalKg), 0)

    // Ventes
    const ventesFromage = ventes.filter((v) => v.lotFromageId != null)
    const ventesLaitCru = ventes.filter(
      (v) => v.lotFromageId == null && (v.type || '').toLowerCase().includes('lait')
    )
    const caFromage = ventesFromage.reduce((s, v) => s + Number(v.prixTotal), 0)
    const caLaitCru = ventesLaitCru.reduce((s, v) => s + Number(v.prixTotal), 0)
    const litresVendusCru = ventesLaitCru
      .filter((v) => (v.unite || '').toLowerCase().startsWith('l'))
      .reduce((s, v) => s + Number(v.quantite), 0)

    // Lait livré à la laiterie (paie mensuelle). Exprimé en TTC (× 1,055) pour
    // rester homogène avec caLaitCru/caFromage (issus de VenteProduit.prixTotal,
    // traité en TTC) dans la valorisation — sinon la marge mélangeait HT et TTC.
    const caLaitLivre = paies.reduce((s, p) => s + Number(p.montantHT), 0) * 1.055
    const litresLivres = paies.reduce((s, p) => s + Number(p.litres), 0)

    // Coût alimentaire affecté
    let coutAlimentaire = 0
    for (const c of consommations) {
      const prixKg = c.aliment?.prix || 0
      const cout = Number(c.quantite) * prixKg
      if (c.lotId == null) coutAlimentaire += cout * partGlobaleLaitiere
      else if (lotsLaitiers.has(c.lotId)) coutAlimentaire += cout
      // lot non laitier → 0
    }

    // Coût sanitaire affecté
    let coutSanitaire = 0
    for (const s of soins) {
      const cout = Number(s.cout || 0)
      if (s.animalId != null) {
        if (animauxLaitiers.has(s.animalId)) coutSanitaire += cout
      } else if (s.lotId != null) {
        if (lotsLaitiers.has(s.lotId)) coutSanitaire += cout
      } else {
        coutSanitaire += cout * partGlobaleLaitiere
      }
    }

    const indic = indicateursEconomieLait({
      litresProduits,
      litresTransformes,
      litresVendusCru,
      litresEcartes,
      caLaitCru,
      caFromage,
      caLaitLivre,
      coutAlimentaire,
      coutSanitaire,
      kgFromage,
    })

    // Rendement & marge par type de fromage
    const parType = new Map<
      string,
      { volumeLait: number; kg: number; pieces: number; ca: number }
    >()
    for (const f of fabrications) {
      const t = f.typeFromage || 'Autre'
      const e = parType.get(t) || { volumeLait: 0, kg: 0, pieces: 0, ca: 0 }
      e.volumeLait += Number(f.volumeLaitUtiliseL)
      e.kg += Number(f.poidsTotalKg)
      e.pieces += f.nbPieces || 0
      parType.set(t, e)
    }
    for (const v of ventesFromage) {
      const t = v.lotFromage?.typeFromage || 'Autre'
      const e = parType.get(t) || { volumeLait: 0, kg: 0, pieces: 0, ca: 0 }
      e.ca += Number(v.prixTotal)
      parType.set(t, e)
    }
    const fromages = Array.from(parType.entries()).map(([type, e]) => ({
      type,
      volumeLaitL: Math.round(e.volumeLait * 10) / 10,
      kg: Math.round(e.kg * 100) / 100,
      pieces: e.pieces,
      rendementKgParL: e.volumeLait > 0 ? Math.round((e.kg / e.volumeLait) * 1000) / 1000 : null,
      litresParKg: e.kg > 0 ? Math.round((e.volumeLait / e.kg) * 100) / 100 : null,
      ca: Math.round(e.ca * 100) / 100,
      prixMoyenKg: e.kg > 0 && e.ca > 0 ? Math.round((e.ca / e.kg) * 100) / 100 : null,
    }))

    return NextResponse.json({
      annee,
      production: {
        litresProduits: Math.round(litresProduits * 10) / 10,
        litresTransformes: Math.round(litresTransformes * 10) / 10,
        litresVendusCru: Math.round(litresVendusCru * 10) / 10,
        litresLivres: Math.round(litresLivres * 10) / 10,
        litresEcartes: Math.round(litresEcartes * 10) / 10,
        kgFromage: Math.round(kgFromage * 100) / 100,
      },
      couts: {
        alimentaire: Math.round(coutAlimentaire * 100) / 100,
        sanitaire: Math.round(coutSanitaire * 100) / 100,
      },
      valorisation: {
        laitCru: Math.round(caLaitCru * 100) / 100,
        laitLivre: Math.round(caLaitLivre * 100) / 100,
        fromage: Math.round(caFromage * 100) / 100,
      },
      indicateurs: indic,
      fromages: fromages.sort((a, b) => b.ca - a.ca),
      methode: {
        partGlobaleLaitiere: Math.round(partGlobaleLaitiere * 1000) / 1000,
        tetesLaitieres,
        tetesTotales,
        note:
          "Coûts affectés au lait : lots laitiers à 100 %, lots non laitiers à 0 %, charges globales au prorata des têtes laitières. La main-d'œuvre et les amortissements ne sont pas inclus.",
      },
    })
  } catch (err) {
    console.error('GET /api/elevage/economie-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
