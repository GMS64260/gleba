/**
 * Salon de discussion — retrait d'un message
 * DELETE /api/communaute/salon/[id]   (auteur ou administrateur)
 *
 * Suppression définitive : le texte ne reste nulle part. Les autres membres le
 * voient disparaître au rafraîchissement suivant de leur fil.
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { MESSAGES_REFUS_DEMO, refusSiCompteDemo } from "@/lib/demo-garde"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error
  const acteurId = getActeurId(session)

  const refusDemo = await refusSiCompteDemo(acteurId, MESSAGES_REFUS_DEMO.salon)
  if (refusDemo) return refusDemo

  const { id } = await params

  const message = await prisma.messageSalon.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!message) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }

  const estAdmin = session.user.role === "ADMIN"
  if (message.userId !== acteurId && !estAdmin) {
    return NextResponse.json({ error: "Seul l'auteur ou l'équipe peut retirer ce message." }, { status: 403 })
  }

  // deleteMany : un double clic ou un retrait simultané par l'équipe ne lève pas d'erreur.
  await prisma.messageSalon.deleteMany({ where: { id } })

  return NextResponse.json({ success: true })
}
