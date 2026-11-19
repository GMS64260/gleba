import type { Animal, Prisma } from '@prisma/client'
import { verifierAttenteViande } from '@/lib/elevage/attente-viande'
import { ErreurElevage } from '@/lib/elevage/erreurs'

type Db = Pick<Prisma.TransactionClient, 'venteProduit' | 'abattage'>

/**
 * Un animal ne redevient pas « actif » tant qu'une vente ou un abattage non
 * annulé le vise : remis actif à la main, il gardait sa vente (recette en
 * place) et pouvait être revendu ou abattu une seconde fois. La sortie se
 * défait par l'annulation de la vente ou de l'abattage, qui réactive la fiche.
 *
 * Rend le motif du refus, ou `null` si la fiche peut être réactivée.
 */
export async function refusRemiseActif(db: Db, userId: string, animalId: number): Promise<string | null> {
  const [vente, abattage] = await Promise.all([
    db.venteProduit.findFirst({
      where: { userId, animalId, type: 'animal_vivant', annule: { not: true } },
      select: { id: true },
    }),
    db.abattage.findFirst({ where: { userId, animalId, annule: false }, select: { id: true } }),
  ])
  if (vente) {
    return 'Cet animal est sorti par une vente toujours active : annulez la vente dans Élevage > Production > Ventes, la fiche redeviendra active.'
  }
  if (abattage) {
    return 'Cet animal est sorti par un abattage toujours actif : annulez l’abattage dans Élevage > Production > Abattages, la fiche redeviendra active.'
  }
  return null
}

/**
 * La fiche de référence d'une modification : relue DANS la transaction, ligne
 * verrouillée (`FOR UPDATE`), donc après toute requête concurrente déjà validée
 * et à l'abri des suivantes jusqu'à la fin de la transaction.
 *
 * C'est elle, et jamais la fiche lue avant la transaction, qui sert d'état
 * « avant » au redatage de l'historique, aux transitions de statut et à
 * `garantirAttenteViandeFiche`. Avec un instantané antérieur au verrou
 * (revues du 2026-11-13), un ancien formulaire ramenait dans l'attente viande
 * une date de sortie corrigée entre-temps : comparée à l'instantané périmé, la
 * requête semblait ne rien changer et n'était pas contrôlée.
 *
 * Fiche disparue entre-temps : 404, la transaction est annulée.
 */
export async function lireFicheSousVerrou(tx: Prisma.TransactionClient, userId: string, animalId: number): Promise<Animal> {
  await tx.$queryRaw`SELECT id FROM animaux WHERE id = ${animalId} AND user_id = ${userId} FOR UPDATE`
  const fiche = await tx.animal.findFirst({ where: { id: animalId, userId } })
  if (!fiche) throw new ErreurElevage('Animal non trouvé', 404)
  return fiche
}

/**
 * `refusRemiseActif` rejoué dans la transaction sur la fiche lue sous verrou :
 * le contrôle fait avant la transaction ne voit pas une vente ou un abattage
 * enregistré entre-temps (fiche lue « active », donc aucun contrôle).
 */
export async function garantirRemiseActifPossible(
  tx: Prisma.TransactionClient,
  userId: string,
  avant: Pick<Animal, 'id' | 'statut'>,
  statutDemande: unknown,
): Promise<void> {
  if (statutDemande !== 'actif' || avant.statut === 'actif') return
  const refus = await refusRemiseActif(tx, userId, avant.id)
  if (refus) throw new ErreurElevage(refus, 409, 'SORTIE_ACTIVE')
}

/**
 * Ce que la garde compare à l'état final : la fiche lue sous verrou dans la
 * transaction (`lireFicheSousVerrou`), avant les écritures.
 */
export type FicheAvantModification = {
  id: number
  statut: string | null
  dateSortie: Date | null
  dateArrivee: Date | null
}

/**
 * LA garde d'attente viande d'une fiche « abattue » à la main. Appelants :
 * PUT /api/elevage/animaux/[id], PATCH /api/elevage/animaux et l'outil
 * `update_animal` de l'assistant (`src/lib/chat/executor-elevage.ts`) ; un
 * abattage enregistré (POST /api/elevage/abattages) passe, lui, directement
 * par `verifierAttenteViande`.
 *
 * Elle s'appelle DANS la transaction, avec la fiche « avant » rendue par
 * `lireFicheSousVerrou` (jamais une lecture antérieure au verrou : la dérogation
 * « rien ne change » en dépend), APRÈS toutes les écritures (fiche,
 * redatage de l'entrée dans le premier lot, changement de lot), et juge l'état
 * FINAL relu en base : une fiche abattue dont le jour de sortie tombe dans
 * l'attente viande d'un soin individuel, ou d'un soin du lot où l'animal se
 * trouvait, est refusée et la transaction est annulée (`ErreurElevage` 409
 * `ATTENTE_VIANDE_ACTIVE`, le message nomme le soin et la fin d'attente).
 *
 * Évaluée avant les écritures, la garde se contournait (2026-11-13) : arrivée
 * reculée avant un soin collectif ET « abattu » dans la même requête (elle
 * lisait l'historique des lots pas encore redaté) ; date de sortie d'une fiche
 * déjà abattue ramenée dans l'attente ; arrivée d'une fiche déjà abattue
 * reculée ensuite.
 *
 * Elle ne rejoue le contrôle que si la requête touche ce qui le détermine
 * (passage à « abattu », jour de sortie, date d'arrivée) : une fiche abattue
 * reste corrigeable pour le reste (poids, notes), même saisie avant la garde.
 */
export async function garantirAttenteViandeFiche(
  tx: Prisma.TransactionClient,
  userId: string,
  avant: FicheAvantModification,
): Promise<void> {
  const apres = await tx.animal.findFirst({
    where: { id: avant.id, userId },
    select: { statut: true, dateSortie: true, dateArrivee: true },
  })
  if (!apres || apres.statut !== 'abattu') return
  const inchange = avant.statut === 'abattu'
    && (avant.dateSortie?.getTime() ?? null) === (apres.dateSortie?.getTime() ?? null)
    && (avant.dateArrivee?.getTime() ?? null) === (apres.dateArrivee?.getTime() ?? null)
  if (inchange) return
  const jourAbattage = apres.dateSortie && !Number.isNaN(apres.dateSortie.getTime()) ? apres.dateSortie : new Date()
  await verifierAttenteViande(tx, userId, { animalId: avant.id, lotId: null, date: jourAbattage })
}

/** Corps de la réponse 409 d'un refus métier d'élevage levé dans une transaction. */
export function corpsRefusElevage(erreur: ErreurElevage) {
  return { error: erreur.message, code: erreur.code, details: erreur.details }
}
