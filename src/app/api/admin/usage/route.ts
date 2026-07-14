/**
 * API Admin - Courbes d'activité par utilisateur dans le temps
 * GET /api/admin/usage?days=90&bucket=week&top=8
 *
 * Métrique : jours actifs (table activity_days — 1 ligne par user et par
 * jour UTC où il a utilisé l'app, alimentée par touchActivity() et
 * backfillée depuis l'historique). Les anciennes stats de connexions
 * sous-comptaient : la session JWT dure 30 jours, un utilisateur quotidien
 * n'apparaissait qu'à la re-saisie de son mot de passe.
 *
 * Exclut le compte démo (demo@gleba.fr) et les comptes ADMIN. Le contenu
 * créé exclut les données d'exemple générées à l'inscription
 * (createSampleDataForUser). Retourne :
 *  - ranking : classement des utilisateurs les plus actifs
 *  - series  : jours actifs par période (bucket) pour le top N
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAdminApi } from "@/lib/auth-utils"

const DEMO_EMAIL = "demo@gleba.fr"
const VALID_BUCKETS = ["day", "week", "month"] as const
type Bucket = (typeof VALID_BUCKETS)[number]

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { searchParams } = request.nextUrl
    const days = clampInt(searchParams.get("days"), 90, 7, 730)
    const top = clampInt(searchParams.get("top"), 8, 1, 20)
    const bucketParam = searchParams.get("bucket") || "week"
    const bucket: Bucket = (VALID_BUCKETS as readonly string[]).includes(bucketParam)
      ? (bucketParam as Bucket)
      : "week"

    const now = new Date()
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const windowStart = startOfBucket(start, bucket)

    // 1. Comptes à exclure (démo + admins)
    const excluded = await prisma.user.findMany({
      where: { OR: [{ email: DEMO_EMAIL }, { role: "ADMIN" }] },
      select: { id: true, email: true, role: true },
    })
    const excludedIds = excluded.map((u) => u.id)
    const adminCount = excluded.filter((u) => u.role === "ADMIN").length
    const demoExcluded = excluded.some((u) => u.email === DEMO_EMAIL)

    // 2. Vrais utilisateurs (hors exclus)
    const users = await prisma.user.findMany({
      where: { id: { notIn: excludedIds.length ? excludedIds : ["__none__"] } },
      select: { id: true, email: true, name: true, createdAt: true, active: true },
    })
    const userIds = users.map((u) => u.id)

    if (userIds.length === 0) {
      return NextResponse.json({
        range: { days, bucket, start: windowStart.toISOString() },
        excluded: { demo: demoExcluded, adminCount },
        totalRealUsers: 0,
        ranking: [],
        series: { buckets: buildBuckets(windowStart, now, bucket), users: [] },
      })
    }

    // 3. Jours actifs : total + fenêtre + dernier jour (par user)
    const [totalDaysRows, windowDaysRows, lastDayRows, contentByUser] =
      await Promise.all([
        prisma.activityDay.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: true,
        }),
        prisma.activityDay.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, day: { gte: windowStart } },
          _count: true,
        }),
        prisma.activityDay.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _max: { day: true },
        }),
        getContentByUser(userIds),
      ])

    const totalDaysMap = toCountMap(totalDaysRows)
    const windowDaysMap = toCountMap(windowDaysRows)
    const lastDayMap = new Map<string, Date | null>()
    for (const r of lastDayRows) {
      if (r.userId) lastDayMap.set(r.userId, r._max.day ?? null)
    }

    // 4. Classement : les plus actifs sur la fenêtre, puis sur le total,
    //    puis au contenu créé
    const ranking = users
      .map((u) => {
        const activeDaysTotal = totalDaysMap.get(u.id) ?? 0
        const activeDaysInWindow = windowDaysMap.get(u.id) ?? 0
        const contentTotal = contentByUser.get(u.id) ?? 0
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active,
          createdAt: u.createdAt.toISOString(),
          activeDaysTotal,
          activeDaysInWindow,
          lastActivity: lastDayMap.get(u.id)?.toISOString() ?? null,
          contentTotal,
        }
      })
      .sort(
        (a, b) =>
          b.activeDaysInWindow - a.activeDaysInWindow ||
          b.activeDaysTotal - a.activeDaysTotal ||
          b.contentTotal - a.contentTotal
      )

    // 5. Séries temporelles : jours actifs par bucket pour le top N
    const topUsers = ranking.slice(0, top)
    const topIds = topUsers.map((u) => u.id)

    const buckets = buildBuckets(windowStart, now, bucket)
    const series = { buckets, users: [] as Array<{ id: string; email: string; name: string | null; values: number[] }> }

    if (topIds.length > 0) {
      const bucketSql = Prisma.raw(`'${bucket}'`) // bucket validé via whitelist
      const rows = await prisma.$queryRaw<
        Array<{ userId: string; bucket: string; n: number }>
      >`
        SELECT user_id AS "userId",
               to_char(date_trunc(${bucketSql}, day::timestamp), 'YYYY-MM-DD') AS bucket,
               count(*)::int AS n
        FROM activity_days
        WHERE day >= ${windowStart}
          AND user_id = ANY(${topIds})
        GROUP BY user_id, bucket
      `

      const idx = new Map(buckets.map((b, i) => [b, i]))
      const perUser = new Map<string, number[]>()
      for (const id of topIds) perUser.set(id, new Array(buckets.length).fill(0))
      for (const r of rows) {
        const arr = perUser.get(r.userId)
        const i = idx.get(r.bucket)
        if (arr && i !== undefined) arr[i] = Number(r.n)
      }

      series.users = topUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        values: perUser.get(u.id) ?? new Array(buckets.length).fill(0),
      }))
    }

    return NextResponse.json({
      range: { days, bucket, start: windowStart.toISOString() },
      excluded: { demo: demoExcluded, adminCount },
      totalRealUsers: users.length,
      ranking,
      series,
    })
  } catch (err) {
    console.error("GET /api/admin/usage error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des métriques d'utilisation" },
      { status: 500 }
    )
  }
}

/**
 * Contenu créé par user sur les principales tables métier, HORS données
 * d'exemple de l'inscription : on ignore les lignes créées dans les
 * 2 minutes suivant la création du compte (le seed s'exécute à
 * l'inscription). Les planches n'ont pas de created_at : on exclut les
 * deux planches du seed par leur nom.
 */
async function getContentByUser(userIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ userId: string; total: number }>>`
    SELECT t.user_id AS "userId", sum(t.n)::int AS total FROM (
      SELECT c.user_id, count(*) AS n FROM cultures c
        JOIN users u ON u.id = c.user_id
        WHERE c.created_at > u.created_at + interval '2 minutes' GROUP BY c.user_id
      UNION ALL SELECT r.user_id, count(*) FROM recoltes r
        JOIN users u ON u.id = r.user_id
        WHERE r.created_at > u.created_at + interval '2 minutes' GROUP BY r.user_id
      UNION ALL SELECT n2.user_id, count(*) FROM notes n2
        JOIN users u ON u.id = n2.user_id
        WHERE n2.created_at > u.created_at + interval '2 minutes' GROUP BY n2.user_id
      UNION ALL SELECT v.user_id, count(*) FROM ventes_produits v
        JOIN users u ON u.id = v.user_id
        WHERE v.created_at > u.created_at + interval '2 minutes' GROUP BY v.user_id
      UNION ALL SELECT a.user_id, count(*) FROM animaux a
        JOIN users u ON u.id = a.user_id
        WHERE a.created_at > u.created_at + interval '2 minutes' GROUP BY a.user_id
      UNION ALL SELECT ra.user_id, count(*) FROM recoltes_arbres ra
        JOIN users u ON u.id = ra.user_id
        WHERE ra.created_at > u.created_at + interval '2 minutes' GROUP BY ra.user_id
      UNION ALL SELECT f.user_id, count(*) FROM factures f
        JOIN users u ON u.id = f.user_id
        WHERE f.created_at > u.created_at + interval '2 minutes' GROUP BY f.user_id
      UNION ALL SELECT p.user_id, count(*) FROM planches p
        WHERE p.nom NOT IN ('Planche A', 'Planche B') GROUP BY p.user_id
    ) t
    WHERE t.user_id = ANY(${userIds})
    GROUP BY t.user_id
  `
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.userId, Number(r.total))
  return map
}

function toCountMap(rows: Array<{ userId: string | null; _count: number }>): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) if (r.userId) m.set(r.userId, r._count ?? 0)
  return m
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = raw ? parseInt(raw, 10) : NaN
  if (Number.isNaN(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** Aligne une date sur le début de son bucket (UTC), façon date_trunc Postgres. */
function startOfBucket(d: Date, bucket: Bucket): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  if (bucket === "month") {
    x.setUTCDate(1)
  } else if (bucket === "week") {
    // ISO : lundi = début de semaine (getUTCDay : 0=dim..6=sam)
    const day = x.getUTCDay()
    const diff = (day + 6) % 7
    x.setUTCDate(x.getUTCDate() - diff)
  }
  return x
}

/** Liste continue des buckets (clés YYYY-MM-DD) entre start et end inclus. */
function buildBuckets(start: Date, end: Date, bucket: Bucket): string[] {
  const out: string[] = []
  const cur = startOfBucket(start, bucket)
  const last = startOfBucket(end, bucket)
  let guard = 0
  while (cur <= last && guard < 5000) {
    out.push(cur.toISOString().slice(0, 10))
    if (bucket === "month") cur.setUTCMonth(cur.getUTCMonth() + 1)
    else if (bucket === "week") cur.setUTCDate(cur.getUTCDate() + 7)
    else cur.setUTCDate(cur.getUTCDate() + 1)
    guard++
  }
  return out
}
