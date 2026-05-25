import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { feedbackSchema } from "@/lib/validations"
import { sendMail, feedbackEmail } from "@/lib/mail"
import prisma from "@/lib/prisma"
import type { BugType } from "@prisma/client"

const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || ""

const TYPE_MAP: Record<"bug" | "evolution" | "autre", BugType> = {
  bug: "BUG",
  evolution: "EVOLUTION",
  autre: "AUTRE",
}

export async function POST(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

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

  const { type, message, url, userAgent, viewport } = result.data

  let bugReportId: string | null = null
  try {
    const bug = await prisma.bugReport.create({
      data: {
        userId: session!.user.id,
        type: TYPE_MAP[type],
        message,
        url: url ?? null,
        userAgent: userAgent ?? null,
        viewport: viewport ?? null,
      },
      select: { id: true },
    })
    bugReportId = bug.id
  } catch (err) {
    console.error("POST /api/feedback persist error:", err)
  }

  try {
    if (!FEEDBACK_EMAIL) {
      // Pas de destinataire configuré côté admin → on n'envoie pas de mail,
      // mais le feedback est tout de même persisté en base (cas auto-hébergé
      // où l'admin lit les rapports via l'UI admin).
      if (bugReportId) {
        return NextResponse.json({ success: true, id: bugReportId, mailError: false })
      }
      return NextResponse.json({ error: "FEEDBACK_EMAIL non configuré" }, { status: 503 })
    }

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

    if (!sent && !bugReportId) {
      console.error("POST /api/feedback error: SMTP non configuré et persistance échouée")
      return NextResponse.json({ error: "Service email indisponible" }, { status: 503 })
    }

    return NextResponse.json({ success: true, id: bugReportId })
  } catch (err) {
    console.error("POST /api/feedback mail error:", err)
    if (bugReportId) {
      return NextResponse.json({ success: true, id: bugReportId, mailError: true })
    }
    return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 })
  }
}
