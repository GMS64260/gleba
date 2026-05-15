/**
 * GET /api/comptabilite/bilan?year=YYYY
 *
 * PROMPT DEV 1 #5 — Vrai bilan PCG, distinct du compte de résultat.
 *
 * ACTIF (ressources) :
 *   - 215x  Immobilisations corporelles brutes (achats catégorie 'materiel')
 *           [MVP : pas d'amortissements, à enrichir avec une vraie fiche
 *            Immobilisation et amortissement linéaire]
 *   - 31x   Stocks de matières premières (semences, intrants…) — placeholder
 *   - 411   Créances clients (factures émises non payées + ventesManuelles non payées)
 *   - 512   Disponibilités banque — placeholder (besoin réconciliation manuelle)
 *
 * PASSIF (emplois) :
 *   - 101   Capital — placeholder (à saisir par l'exploitant)
 *   - 12    Résultat de l'exercice (compte de résultat = revenus - dépenses)
 *   - 401   Dettes fournisseurs (depenses non payées)
 *   - 4457  TVA collectée à reverser − 4456 TVA déductible
 *
 * Équilibre Actif = Passif est garanti via le résultat de l'exercice
 * qui fait pivot. L'écart résiduel apparaît en "écart non affecté"
 * (compte 47x compte d'attente).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { getKpiCompta } from "@/lib/kpi"
import { computeTvaPeriode } from "@/lib/kpi/tva"

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const year = parseInt(
    request.nextUrl.searchParams.get("year") || new Date().getFullYear().toString()
  )
  const userId = session.user.id
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59)

  // ─── ACTIF ──────────────────────────────────────────────────────────
  // Immobilisations brutes : DepenseManuelle catégorie='materiel'
  const immobilisations = await prisma.depenseManuelle.aggregate({
    where: {
      userId,
      categorie: "materiel",
      date: { gte: startOfYear, lte: endOfYear },
    },
    _sum: { montant: true },
  })

  // Créances clients : factures non payées (totalTTC) + ventes manuelles non payées
  const [creancesFactures, creancesVentes] = await Promise.all([
    prisma.facture.aggregate({
      where: {
        userId,
        statut: { in: ["emise", "envoyee", "partielle"] },
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { totalTTC: true },
    }),
    prisma.venteManuelle.aggregate({
      where: {
        userId,
        paye: false,
        date: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { montant: true },
    }),
  ])
  const creances =
    (creancesFactures._sum.totalTTC ?? 0) + (creancesVentes._sum.montant ?? 0)

  // ─── PASSIF ─────────────────────────────────────────────────────────
  // Résultat de l'exercice : KPI compta SSOT (YTD).
  const kpi = await getKpiCompta(userId, year, new Date())
  const resultatExercice = kpi.beneficeYtd

  // Dettes fournisseurs : dépenses non payées
  const dettesFournisseurs = await prisma.depenseManuelle.aggregate({
    where: {
      userId,
      paye: false,
      date: { gte: startOfYear, lte: endOfYear },
    },
    _sum: { montant: true },
  })

  // BUG #8 (audit compta 2026-05-15) — Avant : `Σ VenteManuelle.montantTVA
  // − Σ DepenseManuelle.montantTVA`. Bilan = 11,82 €, Rapports = 12,73 €,
  // écart 0,91 €. Cause : Rapports incluait les sources brutes (élevage,
  // récoltes, bois, abattages, aliments, fertilisations) avec TVA inférée,
  // pas le bilan.
  //
  // Désormais Bilan et Rapports utilisent le même helper
  // `computeTvaPeriode` → valeur identique sur les deux écrans.
  const tvaPeriode = await computeTvaPeriode(userId, startOfYear, endOfYear)
  const tvaAPayer = tvaPeriode.solde.tvaAPayer

  // Récupérer Exploitation pour le capital social.
  const exploitation = await prisma.exploitation.findUnique({
    where: { userId },
    select: { capitalSocial: true },
  })
  const capital = exploitation?.capitalSocial ? Number(exploitation.capitalSocial) : 0

  // ─── ASSEMBLAGE ─────────────────────────────────────────────────────
  const actif = {
    immobilisations: Math.round((immobilisations._sum.montant ?? 0) * 100) / 100,
    stocks: 0, // placeholder MVP
    creances: Math.round(creances * 100) / 100,
    disponibilites: 0, // placeholder MVP (nécessite réconciliation bancaire)
  }
  const totalActif = Object.values(actif).reduce((s, v) => s + v, 0)

  const passifSansEcart = {
    capital,
    resultatExercice: Math.round(resultatExercice * 100) / 100,
    dettesFournisseurs: Math.round((dettesFournisseurs._sum.montant ?? 0) * 100) / 100,
    tvaAPayer: Math.round(tvaAPayer * 100) / 100,
  }
  const totalPassifSansEcart = Object.values(passifSansEcart).reduce((s, v) => s + v, 0)
  // Écart d'équilibrage (compte 47x — souvent reflète disponibilités banque
  // non saisies, ou capital non renseigné).
  const ecartEquilibrage = Math.round((totalActif - totalPassifSansEcart) * 100) / 100

  return NextResponse.json({
    year,
    actif,
    passif: {
      ...passifSansEcart,
      ecartEquilibrage,
    },
    totalActif: Math.round(totalActif * 100) / 100,
    totalPassif: Math.round((totalPassifSansEcart + ecartEquilibrage) * 100) / 100,
  })
}
