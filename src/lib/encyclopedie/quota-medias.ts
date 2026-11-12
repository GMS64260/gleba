/**
 * Quotas des photos proposées au référentiel public.
 *
 * SEC-03 (revue Codex du 2026-11-12) : chaque proposition stocke deux JPEG
 * sous `public/uploads/referentiel/membre`, hors du dossier et du quota du
 * compte. La route bornait la taille (8 Mo) et le débit (15 par minute), pas
 * le cumul : un compte, même gratuit, pouvait remplir le disque.
 *
 * La réservation se fait sous verrous consultatifs (exploitation puis acteur,
 * toujours dans cet ordre), AVANT l'écriture des fichiers, dans la
 * transaction qui crée la ligne : deux envois simultanés ne peuvent pas
 * franchir ensemble le dernier créneau. Les propositions rejetées ou validées
 * comptent dans le quota glissant : leurs fichiers restent sur le disque.
 */
import type { Prisma } from "@prisma/client"

export const LIMITES_CONTRIBUTIONS_MEDIAS = {
  /** Propositions en attente de modération, par personne. */
  enAttenteActeur: 10,
  /** Propositions en attente, tous membres de l'exploitation confondus. */
  enAttenteExploitation: 30,
  /** Propositions sur 30 jours glissants, quel que soit leur sort. */
  sur30JoursActeur: 60,
  sur30JoursExploitation: 150,
} as const

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Prend les verrous et contrôle les quotas. Rend le motif du refus, ou `null`
 * si la proposition peut être enregistrée dans cette même transaction.
 */
export async function reserverContributionMedia(
  tx: Prisma.TransactionClient,
  { exploitationId, acteurId }: { exploitationId: string; acteurId: string },
  maintenant = new Date(),
): Promise<string | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:medias-referentiel:exploitation:${exploitationId}`}))`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:medias-referentiel:acteur:${acteurId}`}))`

  const membres = await tx.membreExploitation.findMany({
    where: { proprietaireId: exploitationId, userId: { not: null }, revoqueLe: null },
    select: { userId: true },
  })
  const personnes = [...new Set([exploitationId, acteurId, ...membres.map((x) => x.userId).filter((id): id is string => Boolean(id))])]
  const depuis = new Date(maintenant.getTime() - TRENTE_JOURS_MS)
  const L = LIMITES_CONTRIBUTIONS_MEDIAS

  const [attenteActeur, attenteExploitation, recentesActeur, recentesExploitation] = await Promise.all([
    tx.mediaReferentiel.count({ where: { source: "MEMBRE", statut: "PROPOSE", contributeurId: acteurId } }),
    tx.mediaReferentiel.count({ where: { source: "MEMBRE", statut: "PROPOSE", contributeurId: { in: personnes } } }),
    tx.mediaReferentiel.count({ where: { source: "MEMBRE", contributeurId: acteurId, createdAt: { gte: depuis } } }),
    tx.mediaReferentiel.count({ where: { source: "MEMBRE", contributeurId: { in: personnes }, createdAt: { gte: depuis } } }),
  ])

  if (attenteActeur >= L.enAttenteActeur) {
    return `Vous avez déjà ${attenteActeur} photos en attente de modération (${L.enAttenteActeur} au plus). Attendez leur relecture avant d'en proposer d'autres.`
  }
  if (attenteExploitation >= L.enAttenteExploitation) {
    return `Votre exploitation a déjà ${attenteExploitation} photos en attente de modération (${L.enAttenteExploitation} au plus). Attendez leur relecture avant d'en proposer d'autres.`
  }
  if (recentesActeur >= L.sur30JoursActeur) {
    return `Vous avez proposé ${recentesActeur} photos ces 30 derniers jours (${L.sur30JoursActeur} au plus). Réessayez plus tard.`
  }
  if (recentesExploitation >= L.sur30JoursExploitation) {
    return `Votre exploitation a proposé ${recentesExploitation} photos ces 30 derniers jours (${L.sur30JoursExploitation} au plus). Réessayez plus tard.`
  }
  return null
}
