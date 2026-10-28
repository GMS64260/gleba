import prisma from '@/lib/prisma'
import type { DbReglement } from './cibles-reglement'
import { entierCentimes } from './monnaie'
/** Les routes de lecture utilisent le même montant réglé, sans compter les miroirs deux fois. */
export async function chargerSoldesReglements(
  userId: string,
  cles: string[],
  db: DbReglement = prisma,
  borne?: Date,
) {
  const resultat = new Map<string, { dossierId: string; regleCentimes: number; devise: string }>()
  if (!cles.length) return resultat
  const aliases = await db.cibleReglement.findMany({
    where: { userId, cle: { in: [...new Set(cles)] } },
    include: {
      dossier: {
        include: {
          reglements: {
            where: {
              userId,
              ...(borne
                ? { date: { lte: borne }, OR: [{ annuleLe: null }, { annuleLe: { gt: borne } }] }
                : { annuleLe: null }),
            },
            select: { montantCentimes: true },
          },
        },
      },
    },
  })
  for (const a of aliases)
    resultat.set(a.cle, {
      dossierId: a.dossierId,
      devise: a.dossier.devise,
      regleCentimes: a.dossier.reglements.reduce(
        (n, r) => entierCentimes(n + entierCentimes(r.montantCentimes)),
        0,
      ),
    })
  return resultat
}
