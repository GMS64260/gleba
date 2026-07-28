/**
 * API Admin - Métriques d'utilisation
 * GET /api/admin/metrics?userId=xxx
 * Si pas de userId, retourne les métriques globales + compte démo
 *
 * L'activité est mesurée en jours actifs (table activity_days, cf.
 * /api/admin/usage) : la session JWT dure 30 jours, donc compter les
 * login_logs sous-estime — et l'impersonation admin y écrit des entrées
 * success=true (reason='impersonation') qui ne sont pas de vraies connexions.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdminApi } from "@/lib/auth-utils"

const DEMO_EMAIL = "demo@gleba.fr"

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { searchParams } = request.nextUrl
    const userId = searchParams.get("userId") || undefined

    // Si userId fourni, métriques pour cet utilisateur
    if (userId) {
      return NextResponse.json(await getUserMetrics(userId))
    }

    // Sinon métriques globales + démo
    const demoUser = await prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      select: { id: true },
    })

    const [global, demo] = await Promise.all([
      getGlobalMetrics(),
      demoUser ? getUserMetrics(demoUser.id) : null,
    ])

    return NextResponse.json({ global, demo })
  } catch (err) {
    console.error("GET /api/admin/metrics error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des métriques" },
      { status: 500 }
    )
  }
}

async function getUserMetrics(userId: string) {
  const now = new Date()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    user,
    cultures,
    planches,
    recoltes,
    arbres,
    animaux,
    activeDays30d,
    activeDays7d,
    lastActiveDay,
    activeDaysTotal,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, createdAt: true },
    }),
    prisma.culture.count({ where: { userId } }),
    prisma.planche.count({ where: { userId } }),
    prisma.recolte.count({ where: { userId } }),
    prisma.arbre.count({ where: { userId } }),
    prisma.animal.count({ where: { userId } }),
    prisma.activityDay.count({
      where: { userId, day: { gte: last30d } },
    }),
    prisma.activityDay.count({
      where: { userId, day: { gte: last7d } },
    }),
    prisma.activityDay.findFirst({
      where: { userId },
      orderBy: { day: "desc" },
      select: { day: true },
    }),
    prisma.activityDay.count({ where: { userId } }),
  ])

  return {
    user,
    data: { cultures, planches, recoltes, arbres, animaux },
    activity: {
      activeDaysTotal,
      activeDays7d,
      activeDays30d,
      lastActiveDay: lastActiveDay?.day ?? null,
    },
  }
}

async function getGlobalMetrics() {
  const now = new Date()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeUsers,
    actifs,
    failedLogins30d,
    totalCultures,
    totalRecoltes,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    // Utilisateurs distincts vus actifs, hors admins et compte démo
    // (mêmes exclusions que /api/admin/usage)
    prisma.$queryRaw<Array<{ activeUsers7d: number; activeUsers30d: number }>>`
      SELECT
        COUNT(DISTINCT a.user_id) FILTER (WHERE a.day >= ${last7d})::int AS "activeUsers7d",
        COUNT(DISTINCT a.user_id)::int AS "activeUsers30d"
      FROM activity_days a
      JOIN users u ON u.id = a.user_id
      WHERE a.day >= ${last30d}
        AND u.role::text <> 'ADMIN'
        AND u.email <> ${DEMO_EMAIL}
    `,
    prisma.loginLog.count({
      where: { success: false, createdAt: { gte: last30d } },
    }),
    prisma.culture.count(),
    prisma.recolte.count(),
  ])

  return {
    totalUsers,
    activeUsers,
    activeUsers7d: Number(actifs[0]?.activeUsers7d ?? 0),
    activeUsers30d: Number(actifs[0]?.activeUsers30d ?? 0),
    failedLogins30d,
    totalCultures,
    totalRecoltes,
  }
}
