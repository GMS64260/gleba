import { INCREMENT_VERSION } from '@/lib/api/version-fiche'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

/** Refus d'un mouvement de cheptel (ressource d'un autre compte, introuvable). */
export class ErreurMouvementCheptel extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export const mouvementSchema = z
  .object({
    animalId: z.coerce.number().int().positive().nullable().optional(),
    lotId: z.coerce.number().int().positive().nullable().optional(),
    parcelleAvantId: z.string().nullable().optional(),
    parcelleApresId: z.string().nullable().optional(),
    date: z.coerce.date(),
    motif: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => Boolean(d.animalId) !== Boolean(d.lotId), {
    message: 'Renseignez un animal ou un lot, pas les deux.',
  })

export type CibleMouvement = { animalId: number | null; lotId: number | null }

/**
 * Sérialise les mouvements d'une même bête ou d'un même lot : sans ce verrou,
 * deux saisies concurrentes recalculaient chacune la position sans voir l'autre.
 */
export async function verrouillerCible(tx: Prisma.TransactionClient, userId: string, cible: CibleMouvement) {
  if (cible.animalId) await tx.$queryRaw`SELECT id FROM animaux WHERE id = ${cible.animalId} AND user_id = ${userId} FOR UPDATE`
  else if (cible.lotId) await tx.$queryRaw`SELECT id FROM lots_animaux WHERE id = ${cible.lotId} AND user_id = ${userId} FOR UPDATE`
}

/**
 * Revue Codex ELEV-05 (2026-11-12). Toute écriture de `parcelleGeoId` journalise
 * un mouvement : le journal fait foi. La position courante est la destination
 * du mouvement le plus récent par date (à date égale, le dernier saisi) ; sans
 * mouvement, `repli`. Avant, un POST antidaté écrasait la position, et la
 * suppression du seul mouvement A→B laissait la bête sans parcelle.
 */
export async function recalerPosition(tx: Prisma.TransactionClient, userId: string, cible: CibleMouvement, repli: string | null) {
  const dernier = await tx.mouvementCheptel.findFirst({
    where: { userId, ...(cible.animalId ? { animalId: cible.animalId } : { lotId: cible.lotId }) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { parcelleApresId: true },
  })
  const parcelleGeoId = dernier ? dernier.parcelleApresId : repli
  // La parcelle figure dans les formulaires de l'animal et du lot : leur version avance.
  if (cible.animalId) await tx.animal.updateMany({ where: { id: cible.animalId, userId }, data: { parcelleGeoId, ...INCREMENT_VERSION } })
  else if (cible.lotId) await tx.lotAnimaux.updateMany({ where: { id: cible.lotId, userId }, data: { parcelleGeoId, ...INCREMENT_VERSION } })
}

/**
 * Déplacement d'un animal ou d'un lot : journal ET emplacement courant, pour
 * `POST /api/elevage/mouvements-cheptel` comme pour l'assistant (revue Codex
 * ASS-11, 2026-11-12 : l'outil écrivait `parcelleGeoId` sans mouvement, la
 * carte changeait sans trace dans l'historique).
 *
 * L'appelant fournit la transaction qui porte ses autres écritures : le journal
 * et la position ne se séparent jamais. Chaque ressource citée doit appartenir
 * à l'exploitation (`ErreurMouvementCheptel`, 404 sinon).
 */
export async function creerMouvementCheptel(
  tx: Prisma.TransactionClient,
  userId: string,
  d: z.infer<typeof mouvementSchema>,
  /** `verifierOrigine` : refuser (409) si l'origine annoncée n'est plus la position réelle. */
  options: { verifierOrigine?: boolean } = {},
) {
  if (d.animalId) {
    const a = await tx.animal.findFirst({ where: { id: d.animalId, userId }, select: { id: true } })
    if (!a) throw new ErreurMouvementCheptel('Animal introuvable', 404)
  }
  if (d.lotId) {
    const l = await tx.lotAnimaux.findFirst({ where: { id: d.lotId, userId }, select: { id: true } })
    if (!l) throw new ErreurMouvementCheptel('Lot introuvable', 404)
  }
  if (d.parcelleAvantId) {
    const p = await tx.parcelleGeo.findFirst({ where: { id: d.parcelleAvantId, userId }, select: { id: true } })
    if (!p) throw new ErreurMouvementCheptel('Parcelle origine introuvable', 404)
  }
  if (d.parcelleApresId) {
    const p = await tx.parcelleGeo.findFirst({ where: { id: d.parcelleApresId, userId }, select: { id: true } })
    if (!p) throw new ErreurMouvementCheptel('Parcelle destination introuvable', 404)
  }

  const cible = { animalId: d.animalId ?? null, lotId: d.lotId ?? null }
  await verrouillerCible(tx, userId, cible)
  // Formulaire resté ouvert : l'origine qu'il annonce n'est plus la position
  // réelle. Le mouvement s'écrivait « aucune parcelle → aucune parcelle » et
  // la sortie perdait sa parcelle de départ (équipe debug, D223). Un mouvement
  // antidaté complète l'historique : il n'est pas contrôlé.
  if (options.verifierOrigine) {
    const dernier = await tx.mouvementCheptel.findFirst({
      where: { userId, ...(cible.animalId ? { animalId: cible.animalId } : { lotId: cible.lotId }) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { date: true },
    })
    if (!dernier || dernier.date.getTime() <= d.date.getTime()) {
      const fiche = cible.animalId
        ? await tx.animal.findFirst({ where: { id: cible.animalId, userId }, select: { parcelleGeoId: true } })
        : await tx.lotAnimaux.findFirst({ where: { id: cible.lotId!, userId }, select: { parcelleGeoId: true } })
      // Une bête sans position connue garde une origine libre (premier mouvement saisi).
      const positionReelle = fiche?.parcelleGeoId ?? null
      if (positionReelle !== null && (d.parcelleAvantId ?? null) !== positionReelle) {
        throw new ErreurMouvementCheptel("La position a changé depuis l'ouverture de cet écran (autre onglet ou autre membre). Rechargez la page avant d'enregistrer ce déplacement : rien n'a été enregistré.", 409)
      }
    }
  }
  const mouvement = await tx.mouvementCheptel.create({
    data: {
      userId,
      animalId: cible.animalId,
      lotId: cible.lotId,
      parcelleAvantId: d.parcelleAvantId ?? null,
      parcelleApresId: d.parcelleApresId ?? null,
      date: d.date,
      motif: d.motif ?? null,
      notes: d.notes ?? null,
    },
  })
  // Un mouvement antidaté complète l'historique sans déplacer la bête :
  // la position reste celle du mouvement le plus récent (ELEV-05).
  await recalerPosition(tx, userId, cible, d.parcelleApresId ?? null)
  return mouvement
}
