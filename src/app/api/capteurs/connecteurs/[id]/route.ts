/**
 * PATCH  /api/capteurs/connecteurs/[id] — renommer, (dés)activer, changer le
 *        fuseau des jours (reconstruction immédiate des agrégats, seulement
 *        si toutes leurs mesures brutes sont encore disponibles), régénérer
 *        le jeton (l'ancien cesse aussitôt de fonctionner ; le nouveau est
 *        rendu une seule fois).
 * DELETE /api/capteurs/connecteurs/[id] — supprime le connecteur, ses
 *        capteurs et leurs mesures (cascade).
 * Réservés au propriétaire ; refusés sur le compte de démonstration.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { getUserId, requireAuthApi } from "@/lib/auth-utils"
import { refusSiPasProprietaire } from "@/lib/exploitation/garde-session"
import { MESSAGES_REFUS_DEMO, refusSiCompteDemo } from "@/lib/demo-garde"
import { genererJeton } from "@/lib/capteurs/jeton"
import { FUSEAUX_PROPOSES } from "@/lib/capteurs/connecteurs"
import { avecVerrouAgregats, HistoriqueNonReconstructibleError, reconstruireAgregatsConnecteur } from "@/lib/capteurs/agregats"

type Contexte = { params: Promise<{ id: string }> }

const schema = z.object({
  nom: z.string().trim().min(1).max(80).optional(),
  actif: z.boolean().optional(),
  fuseau: z.enum(FUSEAUX_PROPOSES as [string, ...string[]]).optional(),
  regenererJeton: z.literal(true).optional(),
})

async function garde(request: Request, contexte: Contexte) {
  const { error, session } = await requireAuthApi(request)
  if (error) return { ok: false as const, refus: error }
  const refusRole = refusSiPasProprietaire(session)
  if (refusRole) return { ok: false as const, refus: refusRole }
  const userId = getUserId(session)
  const refusDemo = await refusSiCompteDemo(userId, MESSAGES_REFUS_DEMO.connecteurCapteurs)
  if (refusDemo) return { ok: false as const, refus: refusDemo }
  const { id } = await contexte.params
  const connecteur = await prisma.connecteurCapteurs.findFirst({ where: { id, userId }, select: { id: true } })
  if (!connecteur) return { ok: false as const, refus: NextResponse.json({ error: "Connecteur introuvable" }, { status: 404 }) }
  return { ok: true as const, id: connecteur.id, userId }
}

export async function PATCH(request: Request, contexte: Contexte) {
  const g = await garde(request, contexte)
  if (!g.ok) return g.refus

  const lu = schema.safeParse(await request.json().catch(() => null))
  if (!lu.success) {
    return NextResponse.json({ error: lu.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
  }
  const nouveau = lu.data.regenererJeton ? genererJeton() : null
  const miseAJour = {
    where: { id: g.id },
    data: {
      ...(lu.data.nom !== undefined ? { nom: lu.data.nom } : {}),
      ...(lu.data.actif !== undefined ? { actif: lu.data.actif } : {}),
      ...(lu.data.fuseau !== undefined ? { fuseau: lu.data.fuseau } : {}),
      ...(nouveau ? { jetonHash: nouveau.hash, jetonPrefixe: nouveau.prefixe } : {}),
    },
    select: { id: true, nom: true, type: true, jetonPrefixe: true, fuseau: true, actif: true, derniereReceptionA: true, createdAt: true },
  } as const
  let connecteur
  try {
    connecteur = lu.data.fuseau !== undefined
      ? await avecVerrouAgregats(async (tx) => {
          // Relire après le verrou : un autre PATCH peut avoir changé le fuseau.
          const actuel = await tx.connecteurCapteurs.findFirst({
            where: { id: g.id, userId: g.userId }, select: { fuseau: true },
          })
          if (!actuel) return null
          const modifie = await tx.connecteurCapteurs.update(miseAJour)
          if (actuel.fuseau !== lu.data.fuseau) {
            await reconstruireAgregatsConnecteur(tx, g.id, actuel.fuseau)
          }
          return modifie
        })
      : await prisma.connecteurCapteurs.update(miseAJour)
  } catch (e) {
    if (!(e instanceof HistoriqueNonReconstructibleError)) throw e
    return NextResponse.json({ error: e.message }, { status: 409 })
  }
  if (!connecteur) return NextResponse.json({ error: "Connecteur introuvable" }, { status: 404 })
  return NextResponse.json({ connecteur, ...(nouveau ? { jeton: nouveau.jeton } : {}) })
}

export async function DELETE(request: Request, contexte: Contexte) {
  const g = await garde(request, contexte)
  if (!g.ok) return g.refus
  await prisma.connecteurCapteurs.delete({ where: { id: g.id } })
  return NextResponse.json({ ok: true })
}
