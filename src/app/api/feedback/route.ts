import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { checkRateLimit } from "@/lib/rate-limit"
import { feedbackSchema } from "@/lib/validations"
import { sendMail, feedbackEmail } from "@/lib/mail"

const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || "guillaume.ossau64@gmail.com"

export async function POST(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  // Rate limit spécifique feedback : 5 par heure par utilisateur
  const rateLimitError = checkRateLimit(`feedback:${session!.user.id}`, {
    windowMs: 60 * 60 * 1000,
    max: 5,
  })
  if (rateLimitError) return rateLimitError

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 })
  }

  const result = feedbackSchema.safeParse(body)
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message)
    return NextResponse.json({ error: messages.join(", ") }, { status: 400 })
  }

  const { type, message } = result.data

  try {
    const email = feedbackEmail({
      userName: session!.user.name,
      userEmail: session!.user.email!,
      type,
      message,
    })

    const sent = await sendMail({
      to: FEEDBACK_EMAIL,
      subject: email.subject,
      html: email.html,
      replyTo: email.replyTo,
    })

    if (!sent) {
      console.error("POST /api/feedback error: SMTP non configuré")
      return NextResponse.json({ error: "Service email indisponible" }, { status: 503 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("POST /api/feedback error:", err)
    return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 })
  }
}
