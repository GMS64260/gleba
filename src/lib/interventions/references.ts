import type { Prisma } from '@prisma/client'
import { resoudreIdPlanche } from '@/lib/planches/resolution'

/** Une référence fournie à l'écriture appartient à l'exploitation courante. */
export async function verifierReferencesIntervention(
  db: Prisma.TransactionClient,
  userId: string,
  refs: { cultureId?: number | null; arbreId?: number | null; plancheId?: string | null },
): Promise<{ ok: true; plancheId: string | null | undefined } | { ok: false; champ: string; error: string }> {
  if (refs.cultureId != null && !await db.culture.findFirst({
    where: { id: refs.cultureId, userId }, select: { id: true },
  })) return { ok: false, champ: 'cultureId', error: 'Culture introuvable pour votre exploitation.' }
  if (refs.arbreId != null && !await db.arbre.findFirst({
    where: { id: refs.arbreId, userId }, select: { id: true },
  })) return { ok: false, champ: 'arbreId', error: 'Arbre introuvable pour votre exploitation.' }
  const plancheId = refs.plancheId ? await resoudreIdPlanche(db, refs.plancheId, userId) : refs.plancheId
  if (refs.plancheId && !plancheId) return { ok: false, champ: 'plancheId', error: 'Planche introuvable pour votre exploitation.' }
  return { ok: true, plancheId }
}
