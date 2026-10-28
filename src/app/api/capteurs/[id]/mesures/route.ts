/**
 * GET /api/capteurs/[id]/mesures?grandeur=temperature_air&jours=7
 * Série d'une grandeur d'un capteur du compte : mesures brutes jusqu'à
 * 31 jours (10 000 points au plus, les plus récents, `tronque` le dit),
 * agrégats journaliers au-delà (min, max, moyenne, jours du lieu, calculés
 * chaque nuit : le jour en cours n'y est pas).
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserId, requireAuthApi } from "@/lib/auth-utils"
import { estGrandeur, GRANDEURS } from "@/lib/capteurs/grandeurs"

const JOURS_MAX = 365
const JOURS_MAX_BRUT = 31
const POINTS_MAX = 10000

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = getUserId(session)
  const { id } = await params

  const grandeur = request.nextUrl.searchParams.get("grandeur")
  if (!estGrandeur(grandeur)) return NextResponse.json({ error: "Grandeur inconnue" }, { status: 400 })
  const jours = Math.min(JOURS_MAX, Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("jours") ?? 7)) || 7))

  const capteur = await prisma.capteur.findFirst({ where: { id, userId }, select: { id: true } })
  if (!capteur) return NextResponse.json({ error: "Capteur introuvable" }, { status: 404 })

  const depuis = new Date(Date.now() - jours * 24 * 3600 * 1000)
  const { unite } = GRANDEURS[grandeur]

  if (jours <= JOURS_MAX_BRUT) {
    // Les plus récentes d'abord pour que le plafond coupe le passé, puis remises dans l'ordre.
    const mesures = await prisma.mesureCapteur.findMany({
      where: { capteurId: capteur.id, grandeur, mesureeA: { gte: depuis } },
      select: { mesureeA: true, valeur: true },
      orderBy: { mesureeA: "desc" },
      take: POINTS_MAX,
    })
    return NextResponse.json({
      grandeur,
      unite,
      type: "brut",
      tronque: mesures.length === POINTS_MAX,
      points: mesures.reverse().map((m) => ({ t: m.mesureeA.toISOString(), v: m.valeur })),
    })
  }

  const agregats = await prisma.mesureCapteurJour.findMany({
    where: { capteurId: capteur.id, grandeur, jour: { gte: depuis } },
    select: { jour: true, min: true, max: true, moyenne: true, nombre: true },
    orderBy: { jour: "asc" },
  })
  return NextResponse.json({
    grandeur,
    unite,
    type: "jour",
    jours: agregats.map((a) => ({ jour: a.jour.toISOString().slice(0, 10), min: a.min, max: a.max, moyenne: a.moyenne, nombre: a.nombre })),
  })
}
