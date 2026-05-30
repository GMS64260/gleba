/**
 * API Admin - Courbes d'utilisation par utilisateur dans le temps
 * GET /api/admin/usage?days=90&bucket=week&top=8
 *
 * Exclut le compte démo (demo@gleba.fr) et les comptes ADMIN pour ne
 * garder que les vrais utilisateurs. Retourne :
 *  - ranking : classement des plus gros utilisateurs (connexions + contenu)
 *  - series  : connexions par période (bucket) pour le top N, prêtes à tracer
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

    // 3. Connexions totales + dans la fenêtre + dernière connexion (par user)
    const [totalLoginsRows, windowLoginsRows, lastLoginRows, contentByUser] =
      await Promise.all([
        prisma.loginLog.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, success: true },
          _count: true,
        }),
        prisma.loginLog.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, success: true, createdAt: { gte: windowStart } },
          _count: true,
        }),
        prisma.loginLog.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, success: true },
          _max: { createdAt: true },
        }),
        getContentByUser(userIds),
      ])

    const totalLoginsMap = toCountMap(totalLoginsRows)
    const windowLoginsMap = toCountMap(windowLoginsRows)
    const lastLoginMap = new Map<string, Date | null>()
    for (const r of lastLoginRows) {
      if (r.userId) lastLoginMap.set(r.userId, r._max.createdAt ?? null)
    }

    // 4. Classement (score = connexions totales + contenu créé)
    const ranking = users
      .map((u) => {
        const totalLogins = totalLoginsMap.get(u.id) ?? 0
        const loginsInWindow = windowLoginsMap.get(u.id) ?? 0
        const contentTotal = contentByUser.get(u.id) ?? 0
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active,
          createdAt: u.createdAt.toISOString(),
          totalLogins,
          loginsInWindow,
          lastLogin: lastLoginMap.get(u.id)?.toISOString() ?? null,
          contentTotal,
          score: totalLogins + contentTotal,
        }
      })
      .sort((a, b) => b.score - a.score || b.totalLogins - a.totalLogins)

    // 5. Séries temporelles : connexions par bucket pour le top N (les plus
    //    actifs sur la fenêtre, puis sur le total)
    const topUsers = [...ranking]
      .sort(
        (a, b) =>
          b.loginsInWindow - a.loginsInWindow ||
          b.totalLogins - a.totalLogins ||
          b.contentTotal - a.contentTotal
      )
      .slice(0, top)
    const topIds = topUsers.map((u) => u.id)

    const buckets = buildBuckets(windowStart, now, bucket)
    const series = { buckets, users: [] as Array<{ id: string; email: string; name: string | null; values: number[] }> }

    if (topIds.length > 0) {
      const bucketSql = Prisma.raw(`'${bucket}'`) // bucket validé via whitelist
      const rows = await prisma.$queryRaw<
        Array<{ userId: string; bucket: string; n: number }>
      >`
        SELECT user_id AS "userId",
               to_char(date_trunc(${bucketSql}, created_at), 'YYYY-MM-DD') AS bucket,
               count(*)::int AS n
        FROM login_logs
        WHERE success = true
          AND created_at >= ${windowStart}
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

/** Somme du contenu créé par user sur les principales tables métier. */
async function getContentByUser(userIds: string[]): Promise<Map<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegates: any[] = [
    prisma.culture,
    prisma.recolte,
    prisma.planche,
    prisma.note,
    prisma.venteProduit,
    prisma.animal,
    prisma.recolteArbre,
    prisma.facture,
  ]
  const map = new Map<string, number>()
  const results = await Promise.all(
    delegates.map((d) =>
      d.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _count: true })
    )
  )
  for (const rows of results) {
    for (const r of rows as Array<{ userId: string | null; _count: number }>) {
      if (r.userId) map.set(r.userId, (map.get(r.userId) ?? 0) + (r._count ?? 0))
    }
  }
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
