/**
 * API Admin - Logs de connexion
 * GET /api/admin/logs?page=1&limit=50&email=demo@gleba.fr
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdminApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const email = searchParams.get("email") || undefined

    const where = email ? { email } : {}

    const [logs, total] = await Promise.all([
      prisma.loginLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { name: true, role: true },
          },
        },
      }),
      prisma.loginLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error("GET /api/admin/logs error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des logs" },
      { status: 500 }
    )
  }
}
