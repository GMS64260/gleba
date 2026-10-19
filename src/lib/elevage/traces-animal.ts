/**
 * Traces qu'un animal porte encore, et qui interdisent de le supprimer.
 *
 * Audit 2026-10-08 : `DELETE /api/elevage/animaux/[id]` supprimait sans rien
 * regarder. Les soins se détachaient du carnet sanitaire (`onDelete: SetNull`),
 * les mouvements de cheptel, saillies, statuts sanitaires et justificatifs
 * d'équarrissage partaient en cascade, et productions, ventes, abattages,
 * consommations, naissances et descendants perdaient leur animal : autant de
 * données du registre d'élevage et de la comptabilité.
 *
 * Règle (même esprit que `compterTracesPlanches` et la garde de suppression
 * d'un lot) : un animal se supprime seulement s'il ne porte AUCUNE saisie. Un
 * animal réel qui quitte le cheptel se déclare sorti (vente, abattage, décès) :
 * sa fiche et son historique restent au registre. La suppression sert à
 * effacer une fiche créée par erreur.
 *
 * Ne retient PAS l'animal, volontairement :
 * - le mouvement « Affectation initiale » que la création écrit d'elle-même
 *   quand l'animal naît sur une parcelle (`POST /api/elevage/animaux`) : il
 *   n'est que le reflet de la fiche, l'exiger rendrait indestructible toute
 *   fiche créée par erreur avec une parcelle. Tout autre mouvement compte ;
 * - l'historique des lots (`historique_lots_animaux`), écrit lui aussi
 *   automatiquement ;
 * - l'écriture d'achat (auto-compta), que la route supprime avec la fiche ;
 * - la fiche du petit de naissance d'où l'animal a été créé, qui se détache.
 */

import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

/** Motif du mouvement que la création d'un animal sur une parcelle écrit seule. */
export const MOTIF_AFFECTATION_INITIALE = 'Affectation initiale'

export interface TracesAnimal {
  soins: number
  /** Mouvements de cheptel, hors affectation initiale automatique. */
  mouvements: number
  /** Ponte, miel et lait rattachés à l'animal. */
  productions: number
  /** Mises bas enregistrées avec l'animal pour mère. */
  naissances: number
  /** Animaux qui l'ont pour mère ou pour père. */
  descendants: number
  saillies: number
  ventes: number
  abattages: number
  consommations: number
  pesees: number
  testsSante: number
  statutsSanitaires: number
  justificatifsEquarrissage: number
}

/**
 * Compte les traces d'un animal déjà vérifié comme appartenant au compte.
 * Les tables à clé étrangère sont comptées par `animalId` ; celles qui ont un
 * `userId` y sont aussi bornées.
 */
export async function compterTracesAnimal(
  tx: Tx,
  animalId: number,
  userId: string
): Promise<TracesAnimal> {
  const [
    soins,
    mouvementsTous,
    mouvementsInitiaux,
    oeufs,
    ruche,
    lait,
    naissances,
    descendants,
    saillies,
    ventes,
    abattages,
    consommations,
    pesees,
    testsSante,
    statutsSanitaires,
    justificatifsEquarrissage,
  ] = await Promise.all([
    tx.soinAnimal.count({ where: { userId, animalId } }),
    tx.mouvementCheptel.count({ where: { userId, animalId } }),
    tx.mouvementCheptel.count({
      where: { userId, animalId, parcelleAvantId: null, motif: MOTIF_AFFECTATION_INITIALE },
    }),
    tx.productionOeuf.count({ where: { userId, animalId } }),
    tx.productionRuche.count({ where: { userId, animalId } }),
    tx.collecteLait.count({ where: { userId, animalId } }),
    tx.naissanceAnimale.count({ where: { userId, mereId: animalId } }),
    tx.animal.count({ where: { userId, OR: [{ mereId: animalId }, { pereId: animalId }] } }),
    tx.saillie.count({ where: { userId, OR: [{ femelleId: animalId }, { maleId: animalId }] } }),
    tx.venteProduit.count({ where: { userId, animalId } }),
    tx.abattage.count({ where: { userId, animalId } }),
    tx.consommationAliment.count({ where: { userId, animalId } }),
    tx.pesee.count({ where: { userId, animalId } }),
    tx.testSanteElevage.count({ where: { userId, animalId } }),
    tx.statutSanitaireElevage.count({ where: { userId, animalId } }),
    tx.justificatifEquarrissageAnimal.count({ where: { animalId, justificatif: { userId } } }),
  ])

  return {
    soins,
    // Seule l'affectation initiale automatique est écartée, et une seule :
    // la création n'en écrit jamais plus d'une.
    mouvements: mouvementsTous - Math.min(mouvementsInitiaux, 1),
    productions: oeufs + ruche + lait,
    naissances,
    descendants,
    saillies,
    ventes,
    abattages,
    consommations,
    pesees,
    testsSante,
    statutsSanitaires,
    justificatifsEquarrissage,
  }
}

/** Libellés au singulier et au pluriel, dans l'ordre d'affichage. */
const LIBELLES: Array<[keyof TracesAnimal, string, string]> = [
  ['soins', 'soin', 'soins'],
  ['mouvements', 'mouvement de cheptel', 'mouvements de cheptel'],
  ['productions', 'production', 'productions'],
  ['naissances', 'naissance', 'naissances'],
  ['descendants', 'descendant', 'descendants'],
  ['saillies', 'saillie', 'saillies'],
  ['ventes', 'vente', 'ventes'],
  ['abattages', 'abattage', 'abattages'],
  ['consommations', "consommation d'aliment", "consommations d'aliment"],
  ['pesees', 'pesée', 'pesées'],
  ['testsSante', 'test de santé', 'tests de santé'],
  ['statutsSanitaires', 'statut sanitaire', 'statuts sanitaires'],
  ['justificatifsEquarrissage', "justificatif d'équarrissage", "justificatifs d'équarrissage"],
]

export function aDesTracesAnimal(traces: TracesAnimal): boolean {
  return LIBELLES.some(([cle]) => traces[cle] > 0)
}

/** Ce qui retient l'animal, en clair : « 3 soins, 1 mouvement de cheptel et 2 pesées ». */
export function decrireTracesAnimal(traces: TracesAnimal): string {
  const parties = LIBELLES.filter(([cle]) => traces[cle] > 0).map(
    ([cle, singulier, pluriel]) => `${traces[cle]} ${traces[cle] > 1 ? pluriel : singulier}`
  )
  if (parties.length <= 1) return parties.join('')
  return `${parties.slice(0, -1).join(', ')} et ${parties[parties.length - 1]}`
}

/**
 * Message de refus d'une suppression : ce qui retient l'animal et le geste à
 * faire à la place (déclarer la sortie, qui garde la fiche au registre).
 */
export function messageSuppressionAnimalRefusee(
  animal: { id: number; nom: string | null; identifiant: string | null; statut: string },
  traces: TracesAnimal
): string {
  const nom = animal.nom || animal.identifiant || `#${animal.id}`
  const debut = `L'animal « ${nom} » porte encore ${decrireTracesAnimal(traces)} : ces saisies restent au registre d'élevage, il ne peut pas être supprimé.`
  if (animal.statut !== 'actif') {
    return `${debut} Il est déjà sorti du cheptel : sa fiche reste au registre avec son historique, rien d'autre à faire.`
  }
  return `${debut} S'il a quitté l'exploitation, déclarez plutôt sa sortie depuis la liste des animaux (Vendre, Abattage ou Décès) : sa fiche et son historique sont conservés.`
}
