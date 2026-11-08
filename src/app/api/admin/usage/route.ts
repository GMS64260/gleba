/**
 * API Admin - Usage détaillé par compte
 * GET /api/admin/usage?days=90&bucket=week&top=8
 *
 * Deux mesures, jamais de contenu :
 *  - présence : jours actifs (table activity_days, un jour UTC par compte au
 *    premier appel authentifié, consultation comprise) ;
 *  - usage : saisies datées dans les tables métier, regroupées par module
 *    (`src/lib/admin-usage.ts`, données d'exemple et miroirs comptables
 *    exclus).
 *
 * Exclut le compte démo et les comptes ADMIN. Retourne :
 *  - resume, segments, modules : vue d'ensemble de la période ;
 *  - tendance : comptes actifs, inscriptions et saisies par module, par période ;
 *  - ranking : une ligne par compte (présence, régularité, modules activés
 *    et réellement utilisés, assistant, connexions, équipe) ;
 *  - series : jours actifs par période pour le top N.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { DEMO_EMAIL } from "@/lib/demo"
import { Prisma } from "@prisma/client"
import { requireAdminApi } from "@/lib/auth-utils"
import {
  GROUPES_USAGE,
  SEGMENTS,
  buildBuckets,
  clampInt,
  classerSegment,
  joursEntre,
  lireModulesActifs,
  parseBucket,
  sqlSaisies,
  startOfBucket,
  type GroupeUsageId,
  type Segment,
} from "@/lib/admin-usage"

interface UsageGroupe {
  fenetre: number
  total: number
  derniere: string | null
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { searchParams } = request.nextUrl
    const days = clampInt(searchParams.get("days"), 90, 7, 730)
    const top = clampInt(searchParams.get("top"), 8, 1, 20)
    const bucket = parseBucket(searchParams.get("bucket"))

    const now = new Date()
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const windowStart = startOfBucket(start, bucket)
    const buckets = buildBuckets(windowStart, now, bucket)
    const bucketSql = Prisma.raw(`'${bucket}'`) // validé par liste blanche
    const range = { days, bucket, start: windowStart.toISOString() }

    // 1. Comptes à exclure (démo + admins)
    const excluded = await prisma.user.findMany({
      where: { OR: [{ email: DEMO_EMAIL }, { role: "ADMIN" }] },
      select: { id: true, email: true, role: true },
    })
    const excludedIds = excluded.map((u) => u.id)
    const adminCount = excluded.filter((u) => u.role === "ADMIN").length
    const demoExcluded = excluded.some((u) => u.email === DEMO_EMAIL)

    // 2. Vrais utilisateurs
    const users = await prisma.user.findMany({
      where: { id: { notIn: excludedIds.length ? excludedIds : ["__none__"] } },
      select: { id: true, email: true, name: true, createdAt: true, active: true },
    })
    const userIds = users.map((u) => u.id)

    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)
    const semainesFenetre = Math.max(1, Math.ceil((today.getTime() - windowStart.getTime() + 86_400_000) / (7 * 86_400_000)))

    if (userIds.length === 0) {
      return NextResponse.json({
        range,
        excluded: { demo: demoExcluded, adminCount },
        totalRealUsers: 0,
        resume: { actifsPeriode: 0, reguliers: 0, nouveauxInscrits: 0, assistant: 0, sansSaisie: 0, semainesFenetre },
        segments: Object.fromEntries(SEGMENTS.map((s) => [s.id, 0])),
        modules: GROUPES_USAGE.map((g) => ({ ...g, actives: g.module ? 0 : null, utilisateurs: 0, saisies: 0 })),
        tendance: {
          buckets,
          actifs: buckets.map(() => 0),
          inscriptions: buckets.map(() => 0),
          saisies: Object.fromEntries(GROUPES_USAGE.map((g) => [g.id, buckets.map(() => 0)])),
        },
        ranking: [],
        series: { buckets, users: [] },
      })
    }

    const saisies = sqlSaisies(userIds)

    const [presence, usageRows, prefs, assistantRows, connexionRows, pushRows, membres, actifsRows, saisiesBucketRows] =
      await Promise.all([
        // Présence : total, période, semaines actives, 4 dernières semaines glissantes
        prisma.$queryRaw<
          Array<{ userId: string; total: number; periode: number; semaines: number; semaines4: number; premier: Date; dernier: Date }>
        >`
          SELECT user_id AS "userId",
                 count(*)::int AS total,
                 count(*) FILTER (WHERE day >= ${windowStart})::int AS periode,
                 count(DISTINCT date_trunc('week', day::timestamp)) FILTER (WHERE day >= ${windowStart})::int AS semaines,
                 count(DISTINCT (current_date - day) / 7) FILTER (WHERE day > current_date - 28)::int AS semaines4,
                 min(day) AS premier,
                 max(day) AS dernier
          FROM activity_days
          WHERE user_id = ANY(${userIds})
          GROUP BY user_id
        `,
        // Saisies par compte et par groupe
        prisma.$queryRaw<Array<{ userId: string; groupe: GroupeUsageId; total: number; periode: number; plus_recent: Date | null }>>`
          SELECT s.user_id AS "userId", s.groupe,
                 count(*)::int AS total,
                 count(*) FILTER (WHERE s.created_at >= ${windowStart})::int AS periode,
                 max(s.created_at) AS plus_recent
          FROM ${saisies} s
          GROUP BY s.user_id, s.groupe
        `,
        prisma.userPreference.findMany({
          where: { userId: { in: userIds }, key: "modulesActifs" },
          select: { userId: true, value: true },
        }),
        // Assistant : nombre de questions posées (rôle user), jamais le contenu
        prisma.$queryRaw<Array<{ userId: string; periode: number; total: number; conversations: number; plus_recent: Date | null }>>`
          SELECT c.user_id AS "userId",
                 count(m.id) FILTER (WHERE m.created_at >= ${windowStart})::int AS periode,
                 count(m.id)::int AS total,
                 count(DISTINCT c.id) FILTER (WHERE c.created_at >= ${windowStart})::int AS conversations,
                 max(m.created_at) AS plus_recent
          FROM conversations c
          LEFT JOIN chat_messages m ON m.conversation_id = c.id AND m.role = 'user'
          WHERE c.user_id = ANY(${userIds})
          GROUP BY c.user_id
        `,
        // Connexions par saisie d’identifiants (impersonation exclue) : type d’appareil seulement
        prisma.$queryRaw<Array<{ userId: string; periode: number; mobile: number; plus_recent: Date | null }>>`
          SELECT user_id AS "userId",
                 count(*) FILTER (WHERE created_at >= ${windowStart})::int AS periode,
                 count(*) FILTER (WHERE created_at >= ${windowStart}
                                    AND user_agent ~* '(mobi|android|iphone|ipad)')::int AS mobile,
                 max(created_at) AS plus_recent
          FROM login_logs
          WHERE success = true AND reason = 'ok' AND user_id = ANY(${userIds})
          GROUP BY user_id
        `,
        prisma.$queryRaw<Array<{ userId: string; n: number; mobile: number }>>`
          SELECT user_id AS "userId", count(*)::int AS n,
                 count(*) FILTER (WHERE "userAgent" ~* '(mobi|android|iphone|ipad)')::int AS mobile
          FROM push_subscriptions
          WHERE user_id = ANY(${userIds})
          GROUP BY user_id
        `,
        prisma.membreExploitation.findMany({
          where: { accepteLe: { not: null }, revoqueLe: null },
          select: {
            proprietaireId: true,
            userId: true,
            proprietaire: { select: { name: true, email: true } },
          },
        }),
        prisma.$queryRaw<Array<{ bucket: string; n: number }>>`
          SELECT to_char(date_trunc(${bucketSql}, day::timestamp), 'YYYY-MM-DD') AS bucket,
                 count(DISTINCT user_id)::int AS n
          FROM activity_days
          WHERE day >= ${windowStart} AND user_id = ANY(${userIds})
          GROUP BY bucket
        `,
        prisma.$queryRaw<Array<{ bucket: string; groupe: GroupeUsageId; n: number }>>`
          SELECT to_char(date_trunc(${bucketSql}, s.created_at), 'YYYY-MM-DD') AS bucket,
                 s.groupe, count(*)::int AS n
          FROM ${saisies} s
          WHERE s.created_at >= ${windowStart}
          GROUP BY bucket, s.groupe
        `,
      ])

    // Index par compte
    const presenceMap = new Map(presence.map((r) => [r.userId, r]))
    const prefMap = new Map(prefs.map((p) => [p.userId, p.value]))
    const assistantMap = new Map(assistantRows.map((r) => [r.userId, r]))
    const connexionMap = new Map(connexionRows.map((r) => [r.userId, r]))
    const pushMap = new Map(pushRows.map((r) => [r.userId, r]))
    const usageMap = new Map<string, Partial<Record<GroupeUsageId, UsageGroupe>>>()
    for (const r of usageRows) {
      const u = usageMap.get(r.userId) ?? {}
      u[r.groupe] = { fenetre: r.periode, total: r.total, derniere: r.plus_recent?.toISOString() ?? null }
      usageMap.set(r.userId, u)
    }
    const nbMembres = new Map<string, number>()
    const membreDe = new Map<string, string>()
    for (const m of membres) {
      nbMembres.set(m.proprietaireId, (nbMembres.get(m.proprietaireId) ?? 0) + 1)
      if (m.userId) membreDe.set(m.userId, m.proprietaire.name || m.proprietaire.email)
    }

    // 3. Ligne par compte
    const ranking = users
      .map((u) => {
        const p = presenceMap.get(u.id)
        const usage = usageMap.get(u.id) ?? {}
        const groupes = Object.fromEntries(
          GROUPES_USAGE.map((g) => [g.id, usage[g.id] ?? { fenetre: 0, total: 0, derniere: null }])
        ) as Record<GroupeUsageId, UsageGroupe>
        const saisiesFenetre = GROUPES_USAGE.reduce((s, g) => s + groupes[g.id].fenetre, 0)
        const saisiesTotal = GROUPES_USAGE.reduce((s, g) => s + groupes[g.id].total, 0)
        const derniereSaisie =
          GROUPES_USAGE.map((g) => groupes[g.id].derniere)
            .filter((d): d is string => !!d)
            .sort()
            .at(-1) ?? null
        const a = assistantMap.get(u.id)
        const c = connexionMap.get(u.id)
        const push = pushMap.get(u.id)
        const segment: Segment = classerSegment({
          inscritDepuisJours: joursEntre(u.createdAt, now),
          joursActifsTotal: p?.total ?? 0,
          semainesActives4: p?.semaines4 ?? 0,
          joursDepuisDerniere: p ? joursEntre(new Date(p.dernier), today) : null,
        })
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          active: u.active,
          createdAt: u.createdAt.toISOString(),
          segment,
          activeDaysTotal: p?.total ?? 0,
          activeDaysInWindow: p?.periode ?? 0,
          activeWeeksInWindow: p?.semaines ?? 0,
          firstActivity: p ? new Date(p.premier).toISOString() : null,
          lastActivity: p ? new Date(p.dernier).toISOString() : null,
          modulesActifs: lireModulesActifs(prefMap.get(u.id)),
          usage: groupes,
          saisiesFenetre,
          contentTotal: saisiesTotal,
          derniereSaisie,
          assistant: {
            questionsFenetre: a?.periode ?? 0,
            questionsTotal: a?.total ?? 0,
            conversationsFenetre: a?.conversations ?? 0,
            derniere: a?.plus_recent ? new Date(a.plus_recent).toISOString() : null,
          },
          connexions: {
            fenetre: c?.periode ?? 0,
            mobile: c?.mobile ?? 0,
            derniere: c?.plus_recent ? new Date(c.plus_recent).toISOString() : null,
          },
          notifications: { appareils: push?.n ?? 0, mobile: push?.mobile ?? 0 },
          equipe: { membres: nbMembres.get(u.id) ?? 0, membreDe: membreDe.get(u.id) ?? null },
        }
      })
      .sort(
        (a, b) =>
          b.activeDaysInWindow - a.activeDaysInWindow ||
          b.saisiesFenetre - a.saisiesFenetre ||
          b.activeDaysTotal - a.activeDaysTotal
      )

    // 4. Vue d'ensemble
    const segments = Object.fromEntries(SEGMENTS.map((s) => [s.id, 0])) as Record<Segment, number>
    for (const r of ranking) segments[r.segment]++

    const modules = GROUPES_USAGE.map((g) => ({
      id: g.id,
      libelle: g.libelle,
      module: g.module,
      actives: g.module ? ranking.filter((r) => (r.modulesActifs as string[]).includes(g.id)).length : null,
      utilisateurs: ranking.filter((r) => r.usage[g.id].fenetre > 0).length,
      saisies: ranking.reduce((s, r) => s + r.usage[g.id].fenetre, 0),
    }))

    const actifsPeriode = ranking.filter((r) => r.activeDaysInWindow > 0)
    const resume = {
      actifsPeriode: actifsPeriode.length,
      reguliers: segments.regulier,
      nouveauxInscrits: users.filter((u) => u.createdAt >= windowStart).length,
      assistant: ranking.filter((r) => r.assistant.questionsFenetre > 0).length,
      sansSaisie: actifsPeriode.filter((r) => r.saisiesFenetre === 0).length,
      semainesFenetre,
    }

    const idx = new Map(buckets.map((b, i) => [b, i]))
    const actifs = buckets.map(() => 0)
    for (const r of actifsRows) {
      const i = idx.get(r.bucket)
      if (i !== undefined) actifs[i] = Number(r.n)
    }
    const inscriptions = buckets.map(() => 0)
    for (const u of users) {
      const i = idx.get(startOfBucket(u.createdAt, bucket).toISOString().slice(0, 10))
      if (i !== undefined) inscriptions[i]++
    }
    const saisiesParGroupe = Object.fromEntries(GROUPES_USAGE.map((g) => [g.id, buckets.map(() => 0)])) as Record<
      GroupeUsageId,
      number[]
    >
    for (const r of saisiesBucketRows) {
      const i = idx.get(r.bucket)
      if (i !== undefined && saisiesParGroupe[r.groupe]) saisiesParGroupe[r.groupe][i] = Number(r.n)
    }

    // 5. Courbes du top N
    const topUsers = ranking.slice(0, top)
    const topIds = topUsers.map((u) => u.id)
    const series = { buckets, users: [] as Array<{ id: string; email: string; name: string | null; values: number[] }> }
    if (topIds.length > 0) {
      const rows = await prisma.$queryRaw<Array<{ userId: string; bucket: string; n: number }>>`
        SELECT user_id AS "userId",
               to_char(date_trunc(${bucketSql}, day::timestamp), 'YYYY-MM-DD') AS bucket,
               count(*)::int AS n
        FROM activity_days
        WHERE day >= ${windowStart}
          AND user_id = ANY(${topIds})
        GROUP BY user_id, bucket
      `
      const perUser = new Map<string, number[]>()
      for (const id of topIds) perUser.set(id, buckets.map(() => 0))
      for (const r of rows) {
        const arr = perUser.get(r.userId)
        const i = idx.get(r.bucket)
        if (arr && i !== undefined) arr[i] = Number(r.n)
      }
      series.users = topUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        values: perUser.get(u.id) ?? buckets.map(() => 0),
      }))
    }

    return NextResponse.json({
      range,
      excluded: { demo: demoExcluded, adminCount },
      totalRealUsers: users.length,
      resume,
      segments,
      modules,
      tendance: { buckets, actifs, inscriptions, saisies: saisiesParGroupe },
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
