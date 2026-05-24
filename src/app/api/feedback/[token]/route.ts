import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { sendMail, feedbackSurveyEmail } from "@/lib/mail"

const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || ""

const BLOCKER_CODES = [
  "ux_confusing",
  "missing_features",
  "bugs_perf",
  "not_suited",
  "onboarding_unclear",
  "mobile_lacking",
  "docs_lacking",
  "no_time",
] as const

const MODULE_CODES = [
  "jardin",
  "verger",
  "elevage",
  "compta",
  "ia",
  "meteo",
] as const

const WILL_RETURN_VALUES = ["yes", "maybe", "no"] as const
const LANG_VALUES = ["fr", "en"] as const

function sanitizeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function sanitizeArray<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T[] {
  if (!Array.isArray(value)) return []
  const set = new Set(allowed)
  const result: T[] = []
  for (const v of value) {
    if (typeof v === "string" && set.has(v as T) && !result.includes(v as T)) {
      result.push(v as T)
    }
  }
  return result
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const ip = getClientIP(request)
  const rateLimitError = checkRateLimit(`feedback-survey:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 10,
  })
  if (rateLimitError) return rateLimitError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 }
    )
  }

  const b = body as Record<string, unknown>

  const lang = LANG_VALUES.includes(b.lang as (typeof LANG_VALUES)[number])
    ? (b.lang as "fr" | "en")
    : "fr"

  const rating = Number(b.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: "Note invalide" }, { status: 400 })
  }

  const blockers = sanitizeArray(b.blockers, BLOCKER_CODES)
  if (blockers.length === 0) {
    return NextResponse.json(
      { error: "Au moins un point bloquant doit être sélectionné" },
      { status: 400 }
    )
  }

  const modules = sanitizeArray(b.modules, MODULE_CODES)
  const willReturn = WILL_RETURN_VALUES.includes(
    b.willReturn as (typeof WILL_RETURN_VALUES)[number]
  )
    ? (b.willReturn as string)
    : null
  const whatBlocked = sanitizeText(b.whatBlocked, 2000)
  const missing = sanitizeText(b.missing, 2000)
  const comment = sanitizeText(b.comment, 4000)

  const record = await prisma.feedbackToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  if (!record) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 })
  }
  if (record.usedAt) {
    return NextResponse.json(
      { error: "Lien déjà utilisé" },
      { status: 409 }
    )
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.feedbackResponse.create({
        data: {
          tokenId: record.id,
          userId: record.userId,
          lang,
          rating,
          blockers,
          whatBlocked,
          missing,
          modules,
          willReturn,
          comment,
        },
      })
      await tx.feedbackToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      })
    })
  } catch (err) {
    console.error("POST /api/feedback/[token] db error:", err)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 }
    )
  }

  // Email asynchrone : on n'attend pas la fin pour répondre au client.
  // Si FEEDBACK_EMAIL n'est pas configuré (cas auto-hébergement par défaut),
  // on saute simplement la notification — le feedback est déjà persisté.
  if (FEEDBACK_EMAIL) {
    const email = feedbackSurveyEmail({
      userName: record.user.name,
      userEmail: record.user.email,
      lang,
      rating,
      blockers,
      whatBlocked,
      missing,
      modules,
      willReturn,
      comment,
    })
    sendMail({
      to: FEEDBACK_EMAIL,
      subject: email.subject,
      html: email.html,
      replyTo: email.replyTo,
    }).catch((err) =>
      console.error("Feedback notification email failed:", err)
    )
  }

  return NextResponse.json({ success: true })
}
