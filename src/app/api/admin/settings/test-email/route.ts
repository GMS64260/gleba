import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import { envoyerEmailTest } from "@/lib/mail"

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // Corps JSON optionnel
  }

  let destinataire: string | undefined
  if (typeof body === "object" && body !== null && "destinataire" in body) {
    const rawDest = (body as { destinataire?: unknown }).destinataire
    if (typeof rawDest === "string" && rawDest.trim() !== "") {
      destinataire = rawDest.trim()
    }
  }

  if (!destinataire) {
    destinataire = session.user.email ?? ""
  }

  if (!destinataire || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
    return NextResponse.json(
      { error: "Adresse email destinataire invalide" },
      { status: 400 }
    )
  }

  try {
    await envoyerEmailTest(destinataire)
    return NextResponse.json({
      message: `Email de test envoyé à ${destinataire}`,
    })
  } catch (err) {
    const messageErreur = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Échec de l'envoi : ${messageErreur}` },
      { status: 502 }
    )
  }
}
