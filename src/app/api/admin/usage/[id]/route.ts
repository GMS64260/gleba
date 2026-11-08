/**
 * API Admin - Fiche d'usage d'un compte
 * GET /api/admin/usage/:id?days=90
 *
 * Complète la ligne de /api/admin/usage, chargée à l'ouverture de la fiche :
 *  - jours actifs des 53 dernières semaines (calendrier de présence) ;
 *  - saisies par semaine et par module sur la période ;
 *  - détail des saisies par type (cultures, récoltes, factures…).
 * Que des dates et des comptages, jamais de contenu.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdminApi } from "@/lib/auth-utils"
import {
  GROUPES_USAGE,
  SOURCES_USAGE,
  buildBuckets,
  clampInt,
  sqlSaisies,
  startOfBucket,
  type GroupeUsageId,
} from "@/lib/admin-usage"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const days = clampInt(request.nextUrl.searchParams.get("days"), 90, 7, 730)

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 })

    const now = new Date()
    const windowStart = startOfBucket(new Date(now.getTime() - days * 86_400_000), "week")
    const semaines = buildBuckets(windowStart, now, "week")
    // Calendrier : 53 semaines pleines, lundi en tête de colonne
    const calendrierDebut = startOfBucket(new Date(now.getTime() - 52 * 7 * 86_400_000), "week")
    const saisies = sqlSaisies([id])

    const [jours, parSource, hebdo] = await Promise.all([
      prisma.$queryRaw<Array<{ day: string }>>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day
        FROM activity_days
        WHERE user_id = ${id} AND day >= ${calendrierDebut}
        ORDER BY day
      `,
      prisma.$queryRaw<Array<{ source: string; total: number; periode: number; plus_recent: Date | null }>>`
        SELECT s.source,
               count(*)::int AS total,
               count(*) FILTER (WHERE s.created_at >= ${windowStart})::int AS periode,
               max(s.created_at) AS plus_recent
        FROM ${saisies} s
        GROUP BY s.source
      `,
      prisma.$queryRaw<Array<{ semaine: string; groupe: GroupeUsageId; n: number }>>`
        SELECT to_char(date_trunc('week', s.created_at), 'YYYY-MM-DD') AS semaine,
               s.groupe, count(*)::int AS n
        FROM ${saisies} s
        WHERE s.created_at >= ${windowStart}
        GROUP BY semaine, s.groupe
      `,
    ])

    const libelles = new Map(SOURCES_USAGE.map((s) => [s.table, s]))
    const sources = parSource
      .map((r) => {
        const def = libelles.get(r.source)
        return {
          source: r.source,
          libelle: def?.libelle ?? r.source,
          groupe: def?.groupe ?? "terrain",
          total: r.total,
          fenetre: r.periode,
          derniere: r.plus_recent ? new Date(r.plus_recent).toISOString() : null,
        }
      })
      .sort((a, b) => b.fenetre - a.fenetre || b.total - a.total)

    const idx = new Map(semaines.map((s, i) => [s, i]))
    const parGroupe = Object.fromEntries(GROUPES_USAGE.map((g) => [g.id, semaines.map(() => 0)])) as Record<
      GroupeUsageId,
      number[]
    >
    for (const r of hebdo) {
      const i = idx.get(r.semaine)
      if (i !== undefined && parGroupe[r.groupe]) parGroupe[r.groupe][i] = Number(r.n)
    }

    return NextResponse.json({
      calendrier: { debut: calendrierDebut.toISOString().slice(0, 10), jours: jours.map((j) => j.day) },
      sources,
      hebdo: { semaines, parGroupe },
    })
  } catch (err) {
    console.error("GET /api/admin/usage/[id] error:", err)
    return NextResponse.json({ error: "Erreur lors du chargement de la fiche d'usage" }, { status: 500 })
  }
}
