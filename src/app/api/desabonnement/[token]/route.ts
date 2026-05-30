/**
 * Désabonnement / réabonnement public (sans authentification), par token.
 *
 * POST /api/desabonnement/[token]
 *   body JSON optionnel : { action: "unsubscribe" | "resubscribe" }
 *   défaut : "unsubscribe".
 *
 * Supporte aussi le clic "1-clic" des clients mail (RFC 8058) : un POST avec
 * le corps `List-Unsubscribe=One-Click` (form-urlencoded) déclenche le
 * désabonnement.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const ip = getClientIP(request)
  const limited = checkRateLimit(`unsubscribe:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 30,
  })
  if (limited) return limited

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, emailOptOut: true },
  })
  if (!user) {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 })
  }

  // Déterminer l'action : JSON {action} ou 1-clic List-Unsubscribe.
  let action: "unsubscribe" | "resubscribe" = "unsubscribe"
  const contentType = request.headers.get("content-type") || ""
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { action?: string }
      if (body.action === "resubscribe") action = "resubscribe"
    }
    // pour form-urlencoded (1-clic), on garde "unsubscribe"
  } catch {
    /* corps absent → désabonnement par défaut */
  }

  const optOut = action !== "resubscribe"
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailOptOut: optOut,
      emailOptOutAt: optOut ? new Date() : null,
    },
  })

  return NextResponse.json({
    success: true,
    email: user.email,
    emailOptOut: optOut,
  })
}
