/**
 * Salon de discussion de la page Communauté
 * GET  /api/communaute/salon                          (fenêtre des derniers messages)
 * GET  /api/communaute/salon?avantLe=<iso>&avantId=<id> (page d'historique)
 * POST /api/communaute/salon                          (publier un message)
 *
 * Réservé aux comptes personnels connectés : le middleware refuse l'anonyme en
 * 401, la route refuse le compte de démonstration en 403 `COMPTE_DEMO`, en
 * lecture comme en écriture. Ses identifiants sont publics : un visiteur
 * anonyme y lirait les membres et parlerait au nom de « la démo ».
 *
 * Le client interroge la fenêtre toutes les quelques secondes. Le GET n'est
 * donc PAS passé au plafond par IP de `requireAuthApi` (100 requêtes / 15 min,
 * toutes routes confondues) : un onglet ouvert l'épuiserait en sept minutes et
 * bloquerait le reste de l'application. Il a son propre plafond par personne.
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { MESSAGES_REFUS_DEMO, refusSiCompteDemo } from "@/lib/demo-garde"
import { checkRateLimit } from "@/lib/rate-limit"
import { messageSalonSchema } from "@/lib/validations/salon"
import { nomAuteurSalon, TAILLE_PAGE_SALON, type MessageSalonVue } from "@/lib/communaute/salon"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

/** Lectures : une interrogation toutes les 5 s fait 12 / min ; marge pour plusieurs onglets. */
const PLAFOND_LECTURE = { windowMs: 60 * 1000, max: 60 }
/** Envois : un échange soutenu reste possible, une rafale de spam non. */
const PLAFOND_ENVOI = { windowMs: 60 * 1000, max: 10 }

const SELECTION = {
  id: true,
  contenu: true,
  createdAt: true,
  userId: true,
  user: { select: { name: true, role: true } },
} satisfies Prisma.MessageSalonSelect

type MessageLu = Prisma.MessageSalonGetPayload<{ select: typeof SELECTION }>

function versVue(m: MessageLu, acteurId: string, estAdmin: boolean): MessageSalonVue {
  const estMoi = m.userId === acteurId
  return {
    id: m.id,
    contenu: m.contenu,
    createdAt: m.createdAt.toISOString(),
    auteur: {
      nom: nomAuteurSalon(m.user.name),
      estMoi,
      equipe: m.user.role === "ADMIN",
    },
    supprimable: estMoi || estAdmin,
  }
}

export async function GET(request: Request) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const acteurId = getActeurId(session)

  const refusDemo = await refusSiCompteDemo(acteurId, MESSAGES_REFUS_DEMO.salon)
  if (refusDemo) return refusDemo

  const plafond = checkRateLimit(`salon-lecture:${acteurId}`, PLAFOND_LECTURE)
  if (plafond) return plafond

  // Curseur composé (date + id) : il reste valable si le message qui le porte
  // a été supprimé entre-temps, et départage deux messages de la même
  // milliseconde.
  const url = new URL(request.url)
  const avantLe = url.searchParams.get("avantLe")
  const avantId = url.searchParams.get("avantId")
  let where: Prisma.MessageSalonWhereInput | undefined
  if (avantLe !== null || avantId !== null) {
    const date = avantLe ? new Date(avantLe) : null
    if (!date || Number.isNaN(date.getTime()) || !avantId || avantId.length > 64) {
      return NextResponse.json({ error: "Curseur d'historique invalide" }, { status: 400 })
    }
    where = {
      OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: avantId } }],
    }
  }

  const lus = await prisma.messageSalon.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TAILLE_PAGE_SALON + 1,
    select: SELECTION,
  })

  const estAdmin = session.user.role === "ADMIN"
  const messages = lus
    .slice(0, TAILLE_PAGE_SALON)
    .reverse()
    .map((m) => versVue(m, acteurId, estAdmin))

  return NextResponse.json({ messages, plusAnciens: lus.length > TAILLE_PAGE_SALON })
}

export async function POST(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error
  const acteurId = getActeurId(session)

  const refusDemo = await refusSiCompteDemo(acteurId, MESSAGES_REFUS_DEMO.salon)
  if (refusDemo) return refusDemo

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }

  const parsed = messageSalonSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    )
  }

  // Après la validation : un envoi refusé pour sa forme ne consomme pas le quota.
  if (checkRateLimit(`salon-envoi:${acteurId}`, PLAFOND_ENVOI)) {
    return NextResponse.json(
      { error: "Vous envoyez des messages trop vite : patientez une minute avant le prochain." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  const cree = await prisma.messageSalon.create({
    data: { userId: acteurId, contenu: parsed.data.contenu },
    select: SELECTION,
  })

  return NextResponse.json(
    { message: versVue(cree, acteurId, session.user.role === "ADMIN") },
    { status: 201 }
  )
}
