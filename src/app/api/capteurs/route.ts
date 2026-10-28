/**
 * GET /api/capteurs — écran Paramètres > Capteurs : connecteurs (sans jeton),
 * capteurs du compte avec leur dernière valeur par grandeur, et cibles
 * proposées au rattachement. Tout est scopé au tenant (`getUserId`).
 */
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserId, requireAuthApi } from "@/lib/auth-utils"
import { ciblesDuCompte, cibleDuCapteur } from "@/lib/capteurs/rattachement"

export const dynamic = "force-dynamic"

/** Dernières valeurs cherchées sur 30 jours : au-delà, le capteur est muet et l'écran le dit. */
const JOURS_DERNIERES_VALEURS = 30

interface DerniereValeur {
  capteur_id: string
  grandeur: string
  valeur: number
  unite: string
  mesuree_a: Date
}

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = getUserId(session)

  const [connecteurs, capteurs, dernieres, cibles] = await Promise.all([
    prisma.connecteurCapteurs.findMany({
      where: { userId },
      select: {
        id: true, nom: true, type: true, jetonPrefixe: true, fuseau: true, actif: true,
        derniereReceptionA: true, createdAt: true, _count: { select: { capteurs: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.capteur.findMany({
      where: { userId },
      select: {
        id: true, connecteurId: true, identifiantExterne: true, nom: true, modele: true,
        plancheId: true, parcelleGeoId: true, arbreId: true, lotAnimauxId: true, animalId: true, objetJardinId: true,
        correspondances: true, clesInconnues: true, clesRecues: true, refus: true, avertissement: true, lat: true, lng: true,
        derniereVueA: true, batterie: true, rssi: true, snr: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.$queryRaw<DerniereValeur[]>`
      SELECT DISTINCT ON (m."capteur_id", m."grandeur")
             m."capteur_id", m."grandeur", m."valeur", m."unite", m."mesuree_a"
      FROM "mesures_capteurs" m
      JOIN "capteurs" c ON c."id" = m."capteur_id"
      WHERE c."user_id" = ${userId}
        AND m."mesuree_a" >= (now() AT TIME ZONE 'UTC') - make_interval(days => ${JOURS_DERNIERES_VALEURS}::int)
      ORDER BY m."capteur_id", m."grandeur", m."mesuree_a" DESC
    `,
    ciblesDuCompte(userId),
  ])

  const valeursParCapteur = new Map<string, Array<{ grandeur: string; valeur: number; unite: string; mesureeA: string }>>()
  for (const d of dernieres) {
    const liste = valeursParCapteur.get(d.capteur_id) ?? []
    liste.push({ grandeur: d.grandeur, valeur: d.valeur, unite: d.unite, mesureeA: d.mesuree_a.toISOString() })
    valeursParCapteur.set(d.capteur_id, liste)
  }

  return NextResponse.json({
    estProprietaire: session.user.estProprietaireExploitation !== false,
    connecteurs: connecteurs.map(({ _count, ...c }) => ({ ...c, nombreCapteurs: _count.capteurs })),
    capteurs: capteurs.map(({ plancheId, parcelleGeoId, arbreId, lotAnimauxId, animalId, objetJardinId, ...c }) => ({
      ...c,
      cible: cibleDuCapteur({ plancheId, parcelleGeoId, arbreId, lotAnimauxId, animalId, objetJardinId }),
      dernieresValeurs: valeursParCapteur.get(c.id) ?? [],
    })),
    cibles,
  })
}
