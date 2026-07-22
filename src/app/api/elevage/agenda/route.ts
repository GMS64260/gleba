/**
 * API Agenda élevage — échéances à venir, agrégées depuis les données déjà en
 * base (GAP P0 « agenda quotidien unifié », review caprin 2026-07-22).
 *
 * GET /api/elevage/agenda?jours=21
 * Regroupe ce qu'un éleveur doit anticiper mais qui était dispersé dans plusieurs
 * onglets : mises-bas attendues, tarissements, diagnostics de gestation à faire,
 * fins de délai d'attente lait/viande (contrainte sanitaire), soins planifiés /
 * en retard, aliments à réapprovisionner. Aucun modèle nouveau.
 *
 * Tout est scopé userId (multi-tenant).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

type Gravite = 'info' | 'attention' | 'urgent'
type Echeance = {
  id: string
  kind:
    | 'mise_bas'
    | 'tarissement'
    | 'diagnostic_gestation'
    | 'attente_lait'
    | 'attente_viande'
    | 'soin_planifie'
    | 'soin_retard'
    | 'stock_aliment'
  date: string | null
  joursRestants: number | null
  titre: string
  detail?: string
  gravite: Gravite
}

const DELAI_DIAGNOSTIC_J = 35 // une saillie « En attente » au-delà → diagnostic à faire

const jours = (from: Date, to: Date) =>
  Math.round((floorDay(to).getTime() - floorDay(from).getTime()) / 86_400_000)
const floorDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const nomAnimal = (a: { nom: string | null; identifiant: string | null; id: number } | null | undefined) =>
  a ? a.nom || a.identifiant || `#${a.id}` : '—'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const horizonJours = Math.min(90, Math.max(1, parseInt(searchParams.get('jours') || '21', 10) || 21))
    const now = new Date()
    const horizon = new Date(now.getTime() + horizonJours * 86_400_000)

    const [gestantes, enAttente, soinsAttente, soinsPlanifies, stocksBas] = await Promise.all([
      // Saillies gestantes : mise-bas + tarissement à venir
      prisma.saillie.findMany({
        where: { userId, statut: 'Gestante' },
        select: {
          id: true,
          dateMiseBasAttendue: true,
          dateTarissementPrevue: true,
          femelle: { select: { id: true, nom: true, identifiant: true } },
        },
      }),
      // Saillies en attente d'un diagnostic de gestation
      prisma.saillie.findMany({
        where: { userId, statut: 'En attente' },
        select: {
          id: true,
          date: true,
          femelle: { select: { id: true, nom: true, identifiant: true } },
        },
      }),
      // Soins faits avec délai d'attente encore actif (contrainte sanitaire)
      prisma.soinAnimal.findMany({
        where: {
          userId,
          fait: true,
          OR: [{ finAttenteLait: { gte: now } }, { finAttenteViande: { gte: now } }],
        },
        select: {
          id: true,
          finAttenteLait: true,
          finAttenteViande: true,
          animal: { select: { id: true, nom: true, identifiant: true } },
          lot: { select: { id: true, nom: true } },
        },
      }),
      // Soins planifiés (non faits) à échéance ou en retard
      prisma.soinAnimal.findMany({
        where: { userId, fait: false, datePrevue: { not: null, lte: horizon } },
        select: {
          id: true,
          type: true,
          datePrevue: true,
          animal: { select: { id: true, nom: true, identifiant: true } },
          lot: { select: { id: true, nom: true } },
        },
      }),
      // Aliments dont le stock est ≤ seuil mini (réappro)
      prisma.userStockAliment.findMany({
        where: { userId, stockMin: { not: null } },
        select: { alimentId: true, stock: true, stockMin: true, aliment: { select: { nom: true } } },
      }),
    ])

    const echeances: Echeance[] = []

    for (const s of gestantes) {
      if (s.dateMiseBasAttendue) {
        const jr = jours(now, s.dateMiseBasAttendue)
        // Une saillie restée « Gestante » ne doit pas polluer l'agenda à vie.
        // Au-delà de 30 jours de retard, elle relève d'une correction de donnée,
        // pas des prochaines échéances quotidiennes.
        if (jr <= horizonJours && jr >= -30) {
          echeances.push({
            id: `mb-${s.id}`,
            kind: 'mise_bas',
            date: s.dateMiseBasAttendue.toISOString(),
            joursRestants: jr,
            titre: `Mise-bas — ${nomAnimal(s.femelle)}`,
            detail: jr < 0 ? 'échéance dépassée' : `dans ${jr} j`,
            gravite: jr <= 3 ? 'urgent' : 'attention',
          })
        }
      }
      if (s.dateTarissementPrevue) {
        const jr = jours(now, s.dateTarissementPrevue)
        if (jr <= horizonJours && jr >= -3) {
          echeances.push({
            id: `tar-${s.id}`,
            kind: 'tarissement',
            date: s.dateTarissementPrevue.toISOString(),
            joursRestants: jr,
            titre: `Tarissement — ${nomAnimal(s.femelle)}`,
            detail: jr < 0 ? 'à programmer (dépassé)' : `dans ${jr} j`,
            gravite: jr <= 7 ? 'attention' : 'info',
          })
        }
      }
    }

    for (const s of enAttente) {
      const jr = jours(s.date, now) // âge de la saillie en jours
      if (jr >= DELAI_DIAGNOSTIC_J) {
        echeances.push({
          id: `diag-${s.id}`,
          kind: 'diagnostic_gestation',
          date: s.date.toISOString(),
          joursRestants: null,
          titre: `Diagnostic de gestation — ${nomAnimal(s.femelle)}`,
          detail: `sailli il y a ${jr} j, statut encore « En attente »`,
          gravite: 'attention',
        })
      }
    }

    for (const s of soinsAttente) {
      const cible = s.animal ? nomAnimal(s.animal) : s.lot ? (s.lot.nom || `Lot #${s.lot.id}`) : '—'
      if (s.finAttenteLait && s.finAttenteLait >= now) {
        const jr = jours(now, s.finAttenteLait)
        echeances.push({
          id: `att-lait-${s.id}`,
          kind: 'attente_lait',
          date: s.finAttenteLait.toISOString(),
          joursRestants: jr,
          titre: `Lait non commercialisable — ${cible}`,
          detail: `jusqu'au ${s.finAttenteLait.toLocaleDateString('fr-FR')}`,
          gravite: 'urgent',
        })
      }
      if (s.finAttenteViande && s.finAttenteViande >= now) {
        const jr = jours(now, s.finAttenteViande)
        echeances.push({
          id: `att-viande-${s.id}`,
          kind: 'attente_viande',
          date: s.finAttenteViande.toISOString(),
          joursRestants: jr,
          titre: `Viande non commercialisable — ${cible}`,
          detail: `jusqu'au ${s.finAttenteViande.toLocaleDateString('fr-FR')}`,
          gravite: 'attention',
        })
      }
    }

    for (const s of soinsPlanifies) {
      if (!s.datePrevue) continue
      const cible = s.animal ? nomAnimal(s.animal) : s.lot ? (s.lot.nom || `Lot #${s.lot.id}`) : '—'
      const jr = jours(now, s.datePrevue)
      const retard = jr < 0
      echeances.push({
        id: `soin-${s.id}`,
        kind: retard ? 'soin_retard' : 'soin_planifie',
        date: s.datePrevue.toISOString(),
        joursRestants: jr,
        titre: `${s.type} — ${cible}`,
        detail: retard ? `en retard de ${-jr} j` : `dans ${jr} j`,
        gravite: retard ? 'urgent' : 'info',
      })
    }

    for (const st of stocksBas) {
      if (st.stockMin == null) continue
      if (Number(st.stock) <= Number(st.stockMin)) {
        echeances.push({
          id: `stock-${st.alimentId}`,
          kind: 'stock_aliment',
          date: null,
          joursRestants: null,
          titre: `Réapprovisionner — ${st.aliment?.nom || st.alimentId}`,
          detail: `stock ${Math.round(Number(st.stock) * 10) / 10} ≤ seuil ${st.stockMin}`,
          gravite: 'attention',
        })
      }
    }

    // Tri : urgent d'abord, puis par date (les sans-date en fin), retards en tête.
    const rangGravite: Record<Gravite, number> = { urgent: 0, attention: 1, info: 2 }
    echeances.sort((a, b) => {
      if (rangGravite[a.gravite] !== rangGravite[b.gravite]) return rangGravite[a.gravite] - rangGravite[b.gravite]
      if (a.joursRestants == null) return 1
      if (b.joursRestants == null) return -1
      return a.joursRestants - b.joursRestants
    })

    const counts = {
      total: echeances.length,
      urgent: echeances.filter((e) => e.gravite === 'urgent').length,
      misesBas: echeances.filter((e) => e.kind === 'mise_bas').length,
      tarissements: echeances.filter((e) => e.kind === 'tarissement').length,
      attentes: echeances.filter((e) => e.kind === 'attente_lait' || e.kind === 'attente_viande').length,
      soins: echeances.filter((e) => e.kind === 'soin_planifie' || e.kind === 'soin_retard').length,
      diagnostics: echeances.filter((e) => e.kind === 'diagnostic_gestation').length,
      stock: echeances.filter((e) => e.kind === 'stock_aliment').length,
    }

    return NextResponse.json({ echeances, counts, horizonJours })
  } catch (err) {
    console.error('GET /api/elevage/agenda error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
