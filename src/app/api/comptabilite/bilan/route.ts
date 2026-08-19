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
      comptable: true,
      date: { gte: startOfYear, lte: endOfYear },
    },
    _sum: { montant: true },
  })

  // Créances clients : factures non payées (totalTTC) + ventes manuelles non payées
  // QA cmsjivhbv — un avoir (type='avoir') a `statut='emise'` comme une facture,
  // et sommer `totalTTC` sans signe faisait GONFLER la créance (411 = 1 111,24 +
  // 143,00 + 14,30 au lieu de − 14,30). Un avoir réduit la créance : on somme
  // donc les factures avec leur signe (avoir = −1), comme le fait déjà la SSOT
  // (cf. lib/kpi/compta.ts). Les statuts "envoyee"/"partielle" n'existent pas
  // dans la machine à états des factures : on s'aligne sur "emise".
  const [facturesCreance, creancesVentes] = await Promise.all([
    prisma.facture.findMany({
      where: {
        userId,
        statut: "emise",
        date: { gte: startOfYear, lte: endOfYear },
      },
      select: { id: true, totalTTC: true, type: true, factureOrigineId: true },
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
  // QA cmswunx5s (écart 20,90 €) — un avoir sur une facture déjà PAYÉE n'est
  // pas une créance négative (c'est une dette envers le client) : on ne
  // déduit un avoir que si sa facture d'origine est encore une créance
  // ouverte, exactement comme construireImpayees (invariant « impayées ==
  // créances 411 » documenté dans lib/comptabilite/impayees.ts).
  const facturesOuvertes = new Set(
    facturesCreance.filter(f => f.type !== "avoir").map(f => f.id),
  )
  const creancesFacturesSignees = facturesCreance.reduce((sum, f) => {
    if (f.type === "avoir") {
      return f.factureOrigineId != null && facturesOuvertes.has(f.factureOrigineId)
        ? sum - f.totalTTC
        : sum
    }
    return sum + f.totalTTC
  }, 0)
  const creances = creancesFacturesSignees + (creancesVentes._sum.montant ?? 0)

  // ─── PASSIF ─────────────────────────────────────────────────────────
  // Résultat de l'exercice : KPI compta SSOT (YTD).
  const kpi = await getKpiCompta(userId, year, new Date())
  const resultatExercice = kpi.beneficeYtd

  // Dettes fournisseurs : dépenses non payées
  const dettesFournisseurs = await prisma.depenseManuelle.aggregate({
    where: {
      userId,
      paye: false,
      comptable: true,
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

  // BUG #10 (audit compta 2026-05-15) — Avant : le compte 47x servait
  // de variable d'ajustement silencieuse. Un éleveur ne saisissait pas
  // son capital → écart = −2 580,82 € absorbé sans alerte → faux bilan.
  //
  // Désormais on classifie l'écart pour que l'UI puisse afficher une
  // bannière différenciée :
  //  - OK            : |écart| < 1 € → tolérance d'arrondi
  //  - INFO          : 1 € ≤ |écart| < 100 €, capital saisi → arrondi
  //  - WARNING       : capital non saisi (1ère cause connue)
  //  - WARNING       : disponibilités à 0 (placeholder MVP)
  //  - ERROR         : |écart| ≥ 100 € malgré capital + dispos renseignées
  const seuilTolerance = 1
  const seuilError = 100
  const capitalSaisi = capital > 0
  const dispoSaisies = actif.disponibilites > 0
  let ecartSeverity: 'ok' | 'info' | 'warning' | 'error' = 'ok'
  const ecartReasons: string[] = []
  const ecartAbs = Math.abs(ecartEquilibrage)
  if (ecartAbs < seuilTolerance) {
    ecartSeverity = 'ok'
  } else if (!capitalSaisi || !dispoSaisies) {
    ecartSeverity = 'warning'
    if (!capitalSaisi) {
      ecartReasons.push('Capital social non renseigné — à saisir dans /parametres/exploitation.')
    }
    if (!dispoSaisies) {
      ecartReasons.push('Disponibilités banque à 0 — réconciliation bancaire manuelle requise (MVP).')
    }
  } else if (ecartAbs >= seuilError) {
    ecartSeverity = 'error'
    ecartReasons.push('Écart anormal : passif et actif divergent malgré une saisie complète. Vérifier les factures impayées et les dettes fournisseurs.')
  } else {
    ecartSeverity = 'info'
    ecartReasons.push('Écart d\'arrondi tolérable.')
  }

  return NextResponse.json({
    year,
    actif,
    passif: {
      ...passifSansEcart,
      ecartEquilibrage,
    },
    totalActif: Math.round(totalActif * 100) / 100,
    totalPassif: Math.round((totalPassifSansEcart + ecartEquilibrage) * 100) / 100,
    // BUG #10 : diagnostic d'équilibrage exposé à l'UI
    diagnostic: {
      ecart: ecartEquilibrage,
      ecartAbs: Math.round(ecartAbs * 100) / 100,
      severity: ecartSeverity,
      reasons: ecartReasons,
      capitalSaisi,
      dispoSaisies,
    },
  })
}
