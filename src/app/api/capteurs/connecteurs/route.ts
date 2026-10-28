/**
 * POST /api/capteurs/connecteurs — crée un connecteur et rend son jeton UNE
 * seule fois. Réservé au propriétaire : le jeton fait entrer des données dans
 * toute l'exploitation. Refusé sur le compte de démonstration partagé.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { getUserId, requireAuthApi } from "@/lib/auth-utils"
import { refusSiPasProprietaire } from "@/lib/exploitation/garde-session"
import { MESSAGES_REFUS_DEMO, refusSiCompteDemo } from "@/lib/demo-garde"
import { fuseauDuTerritoire, TYPES_CONNECTEUR_IDS } from "@/lib/capteurs/connecteurs"
import { genererJeton } from "@/lib/capteurs/jeton"

const MAX_CONNECTEURS = 10

const schema = z.object({
  nom: z.string().trim().min(1, "Nom requis").max(80),
  type: z.enum(TYPES_CONNECTEUR_IDS as [string, ...string[]]),
})

export async function POST(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error
  const refusRole = refusSiPasProprietaire(session)
  if (refusRole) return refusRole
  const userId = getUserId(session)
  const refusDemo = await refusSiCompteDemo(userId, MESSAGES_REFUS_DEMO.connecteurCapteurs)
  if (refusDemo) return refusDemo

  const lu = schema.safeParse(await request.json().catch(() => null))
  if (!lu.success) {
    return NextResponse.json({ error: lu.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
  }

  const nombre = await prisma.connecteurCapteurs.count({ where: { userId } })
  if (nombre >= MAX_CONNECTEURS) {
    return NextResponse.json({ error: `${MAX_CONNECTEURS} connecteurs au plus par exploitation.` }, { status: 409 })
  }

  const exploitation = await prisma.exploitation.findUnique({ where: { userId }, select: { territoire: true } })
  const { jeton, hash, prefixe } = genererJeton()
  const connecteur = await prisma.connecteurCapteurs.create({
    data: {
      userId,
      nom: lu.data.nom,
      type: lu.data.type,
      jetonHash: hash,
      jetonPrefixe: prefixe,
      fuseau: fuseauDuTerritoire(exploitation?.territoire),
    },
    select: { id: true, nom: true, type: true, jetonPrefixe: true, fuseau: true, actif: true, derniereReceptionA: true, createdAt: true },
  })

  return NextResponse.json({ connecteur: { ...connecteur, nombreCapteurs: 0 }, jeton }, { status: 201 })
}
