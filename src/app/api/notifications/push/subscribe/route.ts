import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"

export const dynamic = "force-dynamic"

function estSubscriptionValide(body: unknown): body is {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  if (!body || typeof body !== "object") return false
  const value = body as Record<string, unknown>
  const keys = value.keys
  if (typeof value.endpoint !== "string" || value.endpoint.length === 0 || value.endpoint.length > 2048) {
    return false
  }
  if (!value.endpoint.startsWith("https://")) return false
  if (!keys || typeof keys !== "object") return false
  const subscriptionKeys = keys as Record<string, unknown>
  return (
    typeof subscriptionKeys.p256dh === "string" &&
    subscriptionKeys.p256dh.length > 0 &&
    subscriptionKeys.p256dh.length <= 512 &&
    typeof subscriptionKeys.auth === "string" &&
    subscriptionKeys.auth.length > 0 &&
    subscriptionKeys.auth.length <= 512
  )
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }
  if (!estSubscriptionValide(body)) {
    return NextResponse.json({ error: "Subscription push invalide" }, { status: 400 })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: {
      userId: getActeurId(session),
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 2048) ?? null,
    },
    create: {
      userId: getActeurId(session),
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 2048) ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  const rawBody = await request.text()
  let body: unknown = {}
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
    }
  }
  const endpoint =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).endpoint === "string"
      ? (body as { endpoint: string }).endpoint
      : undefined
  if (endpoint !== undefined && (endpoint.length === 0 || endpoint.length > 2048)) {
    return NextResponse.json({ error: "Endpoint invalide" }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({
    // Un abonnement push appartient au navigateur d'une PERSONNE.
    where: { userId: getActeurId(session), ...(endpoint ? { endpoint } : {}) },
  })

  return NextResponse.json({ ok: true })
}
