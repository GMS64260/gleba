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
 *   - aliments/soins rattachés à un lot laitier → 100 % (lot clos pendant
 *     l'exercice : jusqu'à sa date de fin, cf. `jourFinLotClos`) ;
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
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'
import { poidsMoyenPieceKg, poidsSortieKg, sortieCaveDepuisVente } from '@/lib/elevage/cave-fromage'
import { jourCivilStocke } from '@/lib/jour-civil'

const estLaitier = (production?: string | null, productions?: string[] | null): boolean => {
  const p = (production || '').toLowerCase()
  if (p.includes('lait') || p.includes('mixte')) return true
  return (productions || []).some((x) => x.toLowerCase().includes('lait'))
}

/**
 * Jour civil de fin d'un lot clos, par ordre de fiabilité : la date de
 * réforme saisie à la clôture, sinon le dernier événement daté qui a soldé le
 * lot (abattage non annulé, sortie d'une fiche rattachée : vente, réforme,
 * mort). `null` sans date fiable : `updatedAt` bouge à toute modification et
 * les pertes d'un lot ne sont pas datées (`quantiteActuelle` baisse seulement).
 */
const jourFinLotClos = (lot: {
  dateReforme: Date | null
  abattages: { date: Date }[]
  animaux: { dateSortie: Date | null }[]
}): string | null => {
  if (lot.dateReforme) return jourCivilStocke(lot.dateReforme)
  const jours = [...lot.abattages.map((a) => a.date), ...lot.animaux.map((a) => a.dateSortie)]
    .map((d) => jourCivilStocke(d))
    .filter((j): j is string => j != null)
    .sort()
  return jours.at(-1) ?? null
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const anneeBrute = searchParams.get('annee') || String(new Date().getFullYear())
    const annee = Number(anneeBrute)
    if (!/^\d{4}$/.test(anneeBrute) || annee < 2000 || annee > 2200) return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
    const userId = session.user.id
    const debut = new Date(annee, 0, 1)
    const fin = new Date(annee, 11, 31, 23, 59, 59, 999)

    const [animaux, lots, lotsClos, collectes, fabrications, ventes, consommations, soins, paies] = await Promise.all([
      // Animaux présents pendant l'exercice : actifs, ou sortis (vendus,
      // réformés, morts) après son début. Une laitière vendue sans collecte
      // dans l'année garde ses consommations et soins affectés au lait ; seules
      // les têtes actives entrent dans le prorata des charges globales.
      prisma.animal.findMany({
        where: { userId, OR: [{ statut: 'actif' }, { dateSortie: { gte: debut } }] },
        select: { id: true, lotId: true, statut: true, especeAnimale: { select: { production: true, productions: true } } },
      }),
      prisma.lotAnimaux.findMany({
        where: { userId, statut: 'actif' },
        select: {
          id: true,
          quantiteInitiale: true,
          quantiteActuelle: true,
          especeAnimale: { select: { production: true, productions: true } },
        },
      }),
      // Lots clos (abattage, réforme, vente des fiches) dont la fin, explicite
      // ou datée par le dernier événement, tombe après le début de l'exercice.
      prisma.lotAnimaux.findMany({
        where: {
          userId,
          statut: { not: 'actif' },
          OR: [
            { dateReforme: { gte: debut } },
            { dateReforme: null, abattages: { some: { userId, annule: false, date: { gte: debut } } } },
            { dateReforme: null, animaux: { some: { userId, statut: { not: 'actif' }, dateSortie: { gte: debut } } } },
          ],
        },
        select: {
          id: true,
          dateReforme: true,
          especeAnimale: { select: { production: true, productions: true } },
          abattages: { where: { userId, annule: false }, orderBy: { date: 'desc' }, take: 1, select: { date: true } },
          animaux: {
            where: { userId, statut: { not: 'actif' }, dateSortie: { not: null } },
            orderBy: { dateSortie: 'desc' },
            take: 1,
            select: { dateSortie: true },
          },
        },
      }),
      prisma.collecteLait.findMany({
        where: { userId, date: { gte: debut, lte: fin } },
        select: { animalId: true, lotId: true, date: true, quantiteLitres: true, ecarteAttente: true, lotFromageId: true },
      }),
      prisma.lotFromage.findMany({
        where: { userId, dateFabrication: { gte: debut, lte: fin } },
        select: { typeFromage: true, volumeLaitUtiliseL: true, poidsTotalKg: true, nbPieces: true },
      }),
      prisma.venteProduit.findMany({
        where: { userId, annule: false, date: { gte: debut, lte: fin } },
        select: { type: true, quantite: true, unite: true, prixTotal: true, lotFromageId: true, lotFromage: { select: { typeFromage: true, nbPieces: true, poidsTotalKg: true } }, mouvementsFromage: { where: { userId }, select: { poidsKg: true } } },
      }),
      prisma.consommationAliment.findMany({
        where: { userId, date: { gte: debut, lte: fin } },
        select: { quantite: true, date: true, lotId: true, animalId: true, aliment: { select: { prix: true, userStocks: { where: { userId }, select: { prix: true, coutUnitaire: true }, take: 1 } } } },
      }),
      prisma.soinAnimal.findMany({
        where: { userId, fait: true, date: { gte: debut, lte: fin }, cout: { not: null } },
        select: { cout: true, date: true, animalId: true, lotId: true },
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
    // Revue du 2026-10-29 — un lot laitier clos pendant l'exercice tombait à
    // 0 € : seuls les lots actifs étaient lus. Comme une laitière sortie, il
    // garde ses consommations et soins, jusqu'à son jour de fin, sans entrer
    // dans le prorata des têtes présentes. Sans date fiable, rien ne change.
    const finLotsClos = new Map<number, string>()
    for (const l of lotsClos) {
      const jourFin = jourFinLotClos(l)
      if (jourFin == null) continue
      finLotsClos.set(l.id, jourFin)
      if (estLaitier(l.especeAnimale?.production, l.especeAnimale?.productions)) lotsLaitiers.add(l.id)
    }
    // Une collecte réellement saisie rend aussi sa cible laitière pour
    // l'affectation économique, quelle que soit la configuration de l'espèce,
    // et prouve la présence d'un lot clos jusqu'à ce jour-là.
    for (const collecte of collectes) {
      if (collecte.animalId != null) animauxLaitiers.add(collecte.animalId)
      if (collecte.lotId != null) {
        lotsLaitiers.add(collecte.lotId)
        const jourFin = finLotsClos.get(collecte.lotId)
        const jour = jourCivilStocke(collecte.date)
        if (jourFin != null && jour != null && jour > jourFin) finLotsClos.set(collecte.lotId, jour)
      }
    }
    // Charge d'un lot affectée au lait : lot laitier, et pour un lot clos,
    // datée au plus tard de son jour de fin.
    const lotAffecteAuLait = (lotId: number, date: Date): boolean => {
      if (!lotsLaitiers.has(lotId)) return false
      const jourFin = finLotsClos.get(lotId)
      if (jourFin == null) return true
      const jour = jourCivilStocke(date)
      return jour == null || jour <= jourFin
    }

    // Prorata têtes laitières (pour les charges globales sans lot ni animal)
    // Ticket cmsoga3zp — un animal nominatif rattaché à un lot est déjà compté
    // dans quantiteActuelle du lot : seuls les animaux hors lot s'ajoutent ici,
    // sinon chaque tête rattachée est comptée deux fois (ex: « 8/102 » au lieu
    // de 4/98 pour 4 chèvres du lot laitier).
    // Revue 2026-10-20 — effectif reconstitué du lot (écran Lots, fiches
    // rattachées comprises), pas le compteur stocké qui dérive.
    const effectifsLots = await reconstituerEffectifsLots(userId, lots)
    const effectifLot = (l: { id: number; quantiteActuelle: number }) =>
      effectifsLots.get(l.id)?.effectifCalcule ?? (l.quantiteActuelle || 0)
    const animauxHorsLot = animaux.filter((a) => a.statut === 'actif' && a.lotId == null)
    const tetesLaitieres =
      animauxHorsLot.filter((a) => animauxLaitiers.has(a.id)).length +
      lots.filter((l) => lotsLaitiers.has(l.id)).reduce((s, l) => s + effectifLot(l), 0)
    const tetesTotales =
      animauxHorsLot.length + lots.reduce((s, l) => s + effectifLot(l), 0)
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
      const prixKg = c.aliment?.userStocks?.[0]?.coutUnitaire ?? c.aliment?.userStocks?.[0]?.prix ?? c.aliment?.prix ?? 0
      const cout = Number(c.quantite) * prixKg
      if (c.animalId != null) {
        if (animauxLaitiers.has(c.animalId)) coutAlimentaire += cout
      } else if (c.lotId != null) {
        if (lotAffecteAuLait(c.lotId, c.date)) coutAlimentaire += cout
      } else coutAlimentaire += cout * partGlobaleLaitiere
      // lot non laitier → 0
    }

    // Coût sanitaire affecté
    let coutSanitaire = 0
    for (const s of soins) {
      const cout = Number(s.cout || 0)
      if (s.animalId != null) {
        if (animauxLaitiers.has(s.animalId)) coutSanitaire += cout
      } else if (s.lotId != null) {
        if (lotAffecteAuLait(s.lotId, s.date)) coutSanitaire += cout
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
      { volumeLait: number; kg: number; pieces: number; ca: number; kgVendus: number; poidsComplet: boolean; poidsEstime: boolean }
    >()
    for (const f of fabrications) {
      const t = f.typeFromage || 'Autre'
      const e = parType.get(t) || { volumeLait: 0, kg: 0, pieces: 0, ca: 0, kgVendus: 0, poidsComplet: true, poidsEstime: false }
      e.volumeLait += Number(f.volumeLaitUtiliseL)
      e.kg += Number(f.poidsTotalKg)
      e.pieces += f.nbPieces || 0
      parType.set(t, e)
    }
    for (const v of ventesFromage) {
      const t = v.lotFromage?.typeFromage || 'Autre'
      const e = parType.get(t) || { volumeLait: 0, kg: 0, pieces: 0, ca: 0, kgVendus: 0, poidsComplet: true, poidsEstime: false }
      e.ca += Number(v.prixTotal)
      // Le prix de vente porte sur le poids sorti, jamais sur toute la
      // fabrication (une partie peut encore être en cave).
      const pesee = v.mouvementsFromage?.reduce((s, m) => s + Number(m.poidsKg), 0) ?? 0
      const sortie = sortieCaveDepuisVente(v.quantite, v.unite)
      const moyen = v.lotFromage ? poidsMoyenPieceKg({ nbPieces: v.lotFromage.nbPieces, poidsTotalKg: Number(v.lotFromage.poidsTotalKg) }) : null
      const kg = pesee > 0 ? pesee : sortie.ok ? poidsSortieKg(sortie, moyen) : null
      if (pesee <= 0 && sortie.ok && sortie.nbPieces > 0 && moyen != null) e.poidsEstime = true
      if (kg == null || !Number.isFinite(kg) || kg <= 0) e.poidsComplet = false
      else e.kgVendus += kg
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
      kgVendus: e.poidsComplet ? Math.round(e.kgVendus * 1000) / 1000 : null,
      poidsVenduEstime: e.poidsEstime,
      prixMoyenKg: e.poidsComplet && e.kgVendus > 0 && e.ca > 0 ? Math.round((e.ca / e.kgVendus) * 100) / 100 : null,
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
          "Coûts affectés au lait : lots laitiers à 100 % (un lot clos jusqu'à sa date de fin), lots non laitiers à 0 %, charges globales au prorata des têtes laitières. La main-d'œuvre et les amortissements ne sont pas inclus.",
      },
    })
  } catch (err) {
    console.error('GET /api/elevage/economie-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
