/**
 * Helpers serveur pour les signalements d'entrées communautaires (décision #3).
 * Résout, par refType, le nom + l'origine de l'entrée signalée (pour l'affichage
 * admin), et donne la base d'API de chaque référentiel (liens/actions de modération).
 */

import prisma from '@/lib/prisma'
import type { AvisRefType } from '@/lib/avis/types'

/** Base d'API du référentiel correspondant à chaque type signalable. */
export const SIGNALEMENT_API_BASE: Record<AvisRefType, string> = {
  ESPECE: '/api/especes',
  VARIETE: '/api/varietes',
  ITP: '/api/itps',
  PORTE_GREFFE: '/api/verger/porte-greffes',
  RACE: '/api/elevage/races',
}

export type EntreeSignalee = {
  nom: string
  userId: string | null
  partageCommunaute: boolean
} | null

/** Résout id→{nom, origine} pour un lot d'entrées d'un même refType. */
export async function resolveEntreesSignalees(
  refType: AvisRefType,
  ids: string[]
): Promise<Map<string, NonNullable<EntreeSignalee>>> {
  const uniq = [...new Set(ids)]
  const select = { id: true, nom: true, userId: true, partageCommunaute: true } as const
  let rows: Array<{ id: string; nom: string | null; userId: string | null; partageCommunaute: boolean }> = []

  switch (refType) {
    case 'ESPECE':
      rows = await prisma.espece.findMany({ where: { id: { in: uniq } }, select })
      break
    case 'VARIETE':
      rows = await prisma.variete.findMany({ where: { id: { in: uniq } }, select })
      break
    case 'ITP':
      rows = await prisma.iTP.findMany({ where: { id: { in: uniq } }, select })
      break
    case 'PORTE_GREFFE':
      rows = await prisma.porteGreffe.findMany({ where: { id: { in: uniq } }, select })
      break
    case 'RACE':
      rows = await prisma.raceAnimale.findMany({ where: { id: { in: uniq } }, select })
      break
  }

  const map = new Map<string, NonNullable<EntreeSignalee>>()
  for (const r of rows) {
    map.set(r.id, { nom: r.nom ?? r.id, userId: r.userId, partageCommunaute: r.partageCommunaute })
  }
  return map
}
