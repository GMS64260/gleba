/**
 * API Préférences utilisateur
 * GET /api/user/preferences - Récupère toutes les préférences du user
 * PUT /api/user/preferences - Met à jour une ou plusieurs préférences (body: { key: value, ... })
 *
 * Bug feedback testeur 2026-05-25 (cmplk8yoz) — Le toggle "Modules actifs"
 * revenait à ON après reload. Le PUT persistait bien, mais le GET suivant
 * renvoyait l'ancien état (réponse mise en cache navigateur/CDN). On force
 * le mode dynamique + `Cache-Control: no-store` pour garantir la lecture
 * temps réel.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const prefs = await prisma.userPreference.findMany({
    where: { userId: session!.user.id },
  })

  // Sérialise en objet { key: value, ... }
  const result: Record<string, unknown> = {}
  for (const p of prefs) {
    try {
      result[p.key] = JSON.parse(p.value)
    } catch {
      result[p.key] = p.value
    }
  }

  return NextResponse.json(result, { headers: NO_STORE })
}

export async function PUT(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const userId = session!.user.id
  const body = await request.json()

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }

  // Upsert chaque préférence
  await prisma.$transaction(
    Object.entries(body).map(([key, value]) =>
      prisma.userPreference.upsert({
        where: { userId_key: { userId, key } },
        update: { value: typeof value === "string" ? value : JSON.stringify(value) },
        create: { userId, key, value: typeof value === "string" ? value : JSON.stringify(value) },
      })
    )
  )

  // Retourne les prefs mises à jour
  const prefs = await prisma.userPreference.findMany({ where: { userId } })
  const result: Record<string, unknown> = {}
  for (const p of prefs) {
    try {
      result[p.key] = JSON.parse(p.value)
    } catch {
      result[p.key] = p.value
    }
  }
  return NextResponse.json(result, { headers: NO_STORE })
}
