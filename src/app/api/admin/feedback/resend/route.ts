import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import prisma from "@/lib/prisma"
import { requireAdminApi } from "@/lib/auth-utils"
import { sendMail, feedbackInviteEmail } from "@/lib/mail"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const BASE_URL = process.env.FEEDBACK_BASE_URL || "https://gleba.fr"
const DELAY_MS = 1500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(request: Request) {
  const { error } = await requireAdminApi(request)
  if (error) return error

  // Cible : utilisateurs USER actifs, hors démo, sans réponse
  const targets = await prisma.user.findMany({
    where: {
      role: "USER",
      active: true,
      email: { not: "demo@gleba.fr" },
      feedbackResponses: { none: {} },
    },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  })

  let sent = 0
  let failed = 0
  const errors: { email: string; error: string }[] = []

  for (let i = 0; i < targets.length; i++) {
    const user = targets[i]
    try {
      const existing = await prisma.feedbackToken.findFirst({
        where: { userId: user.id, usedAt: null },
        orderBy: { createdAt: "desc" },
      })
      const token =
        existing?.token ??
        (
          await prisma.feedbackToken.create({
            data: {
              userId: user.id,
              token: randomBytes(24).toString("base64url"),
            },
          })
        ).token

      const url = `${BASE_URL}/feedback/${token}`
      const mail = feedbackInviteEmail({ name: user.name, url })

      await sendMail({
        to: user.email,
        subject: mail.subject,
        html: mail.html,
        replyTo: mail.replyTo,
      })

      sent++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Resend failed for ${user.email}:`, msg)
      failed++
      errors.push({ email: user.email, error: msg })
    }

    if (i < targets.length - 1) await sleep(DELAY_MS)
  }

  return NextResponse.json({
    total: targets.length,
    sent,
    failed,
    errors: errors.slice(0, 10),
  })
}
