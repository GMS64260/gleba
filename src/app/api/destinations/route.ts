/**
 * Référentiel partagé des destinations de récolte et de sortie de stock.
 */

import { NextResponse } from "next/server"

import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

export async function GET() {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const data = await prisma.destination.findMany({
      select: {
        id: true,
        description: true,
      },
      orderBy: { id: "asc" },
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("GET /api/destinations error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des destinations" },
      { status: 500 },
    )
  }
}
