/**
 * API Admin - Métriques d'utilisation
 * GET /api/admin/metrics?userId=xxx
 * Si pas de userId, retourne les métriques globales + compte démo
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdminApi } from "@/lib/auth-utils"

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
      where: { email: "demo@gleba.fr" },
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
    logins30d,
    logins7d,
    lastLogin,
    totalLogins,
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
    prisma.loginLog.count({
      where: { userId, success: true, createdAt: { gte: last30d } },
    }),
    prisma.loginLog.count({
      where: { userId, success: true, createdAt: { gte: last7d } },
    }),
    prisma.loginLog.findFirst({
      where: { userId, success: true },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.loginLog.count({ where: { userId, success: true } }),
  ])

  return {
    user,
    data: { cultures, planches, recoltes, arbres, animaux },
    activity: {
      totalLogins,
      logins7d,
      logins30d,
      lastLogin: lastLogin?.createdAt ?? null,
    },
  }
}

async function getGlobalMetrics() {
  const now = new Date()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeUsers,
    totalLogins30d,
    failedLogins30d,
    totalCultures,
    totalRecoltes,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.loginLog.count({
      where: { success: true, createdAt: { gte: last30d } },
    }),
    prisma.loginLog.count({
      where: { success: false, createdAt: { gte: last30d } },
    }),
    prisma.culture.count(),
    prisma.recolte.count(),
  ])

  return {
    totalUsers,
    activeUsers,
    totalLogins30d,
    failedLogins30d,
    totalCultures,
    totalRecoltes,
  }
}
