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
import { getActeurId } from "@/lib/exploitation/garde-session"
import { estEmailDemo } from "@/lib/demo"

export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const prefs = await prisma.userPreference.findMany({
    // Préférences de la PERSONNE (thème, notifications, modules visibles) :
    // un membre ne lit ni n'écrase celles du propriétaire.
    where: { userId: getActeurId(session) },
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

  const userId = getActeurId(session)

  // Le compte de démonstration est PARTAGÉ : ses réglages sont figés
  // (2026-09-09). Constat : un visiteur a activé le briefing automatique le
  // 06/09 à 11:36:00 — un briefing généré à chaque visite ensuite, pour des
  // prospects qui n'avaient rien demandé —, un autre a changé `modulesActifs`
  // le 05/09, et `notifPrefs` s'est retrouvé tout à `true`, ce qui a mis les
  // 7 parcelles de la démo dans le scan météo périodique et pesé sur Open-Meteo.
  // Le réglage d'un visiteur devenait le décor du suivant, donc la démo ne
  // montrait plus la même chose à tout le monde. Vérifié en base plutôt que
  // depuis la session : `session.user` ne porte que id, role et impersonatedBy,
  // et c'est déjà par l'id que `linkAccount` (auth.ts) protège ce compte.
  const compte = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (estEmailDemo(compte?.email)) {
    return NextResponse.json(
      {
        error:
          "Le compte de démonstration est partagé : ses réglages sont figés pour que chaque visiteur voie la même ferme. Créez un compte gratuit pour conserver vos préférences.",
      },
      { status: 403, headers: NO_STORE }
    )
  }

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
