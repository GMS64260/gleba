import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { especeBaseId } from '@/lib/elevage/espece-base'
import { ciblesLaitAffectees, couvertureCollectes, ecrireEcartement } from '@/lib/elevage/attente-lait'

type Db = typeof prisma | Prisma.TransactionClient

/**
 * Vrai si le lot appartient au compte et accueille cette espèce de base.
 * Un nouveau rattachement exige un lot actif. `lotConserve` : l'animal reste
 * dans son lot actuel et seule son espèce change ; un lot réformé ou terminé
 * reste alors acceptable, seule la compatibilité d'espèce compte (relecture de
 * la PR #47, 2026-11-03 : corriger l'espèce d'un animal resté dans un lot
 * terminé renvoyait « Lot invalide »).
 */
export async function isAssignableAnimalLot(
  userId: string,
  rawLotId: unknown,
  especeAnimaleId: string,
  options: { lotConserve?: boolean } = {},
): Promise<boolean> {
  const lotId = typeof rawLotId === 'number' ? rawLotId : Number(rawLotId)
  if (!Number.isInteger(lotId) || lotId <= 0) return false

  const lot = await prisma.lotAnimaux.findFirst({
    where: {
      id: lotId,
      userId,
      ...(options.lotConserve ? {} : { statut: 'actif' }),
    },
    select: { id: true, especeAnimaleId: true },
  })

  // Les profils « Chèvre laitière », « Chèvre Alpine chamoisée », etc.
  // décrivent la même espèce biologique. L'UI propose déjà leurs lots en
  // comparant l'espèce de base ; l'API doit appliquer exactement la même
  // règle, sinon la création échoue après un choix pourtant affiché comme
  // valide (tickets cms1v73hn / cms1viq3c).
  return lot !== null && especeBaseId(lot.especeAnimaleId) === especeBaseId(especeAnimaleId)
}

/**
 * Vrai si la parcelle géoréférencée existe et appartient au user.
 * Sert au rattachement direct d'un animal à une parcelle (cartographie élevage).
 */
export async function isOwnedParcelle(userId: string, rawParcelleId: unknown): Promise<boolean> {
  if (rawParcelleId == null || rawParcelleId === '') return false
  const parcelle = await prisma.parcelleGeo.findFirst({
    where: { id: String(rawParcelleId), userId },
    select: { id: true },
  })
  return parcelle !== null
}

export async function enregistrerChangementLot(
  db: Db,
  userId: string,
  animalId: number,
  ancienLotId: number | null,
  nouveauLotId: number | null,
  dateEffet = new Date(),
  motif = 'Modification de la fiche animal'
) {
  if (ancienLotId === nouveauLotId) return
  await db.$executeRaw(Prisma.sql`
    UPDATE "historique_lots_animaux"
    SET "date_fin" = ${dateEffet}
    WHERE "user_id" = ${userId} AND "animal_id" = ${animalId} AND "date_fin" IS NULL
  `)
  if (nouveauLotId != null) {
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "historique_lots_animaux"
        ("id", "user_id", "animal_id", "lot_id", "date_debut", "motif")
      VALUES (${randomUUID()}, ${userId}, ${animalId}, ${nouveauLotId}, ${dateEffet}, ${motif})
    `)
  }
}

/** Motifs de la première ligne d'historique, écrite avec la fiche. */
export const MOTIFS_AFFECTATION_INITIALE = [
  'Affectation à la création de l’animal',
  'Reprise de l’affectation existante',
] as const

/**
 * La date d'arrivée corrigée redate l'entrée de l'animal dans son premier lot.
 *
 * L'historique d'appartenance est daté à la création de la fiche (date
 * d'arrivée, à défaut le jour de la saisie). Corriger ensuite l'arrivée (fiche
 * créée aujourd'hui pour un animal arrivé il y a un mois) laissait l'historique
 * commencer au jour de la saisie : la fiche affichait l'alerte d'un soin de lot
 * antérieur, mais la garde d'abattage, qui lit l'historique, ne rattachait pas
 * ce soin et laissait passer l'abattage pendant le délai d'attente viande.
 *
 * Seule la PREMIÈRE ligne est redatée, si elle vient de la création de la fiche
 * et que la nouvelle date ne dépasse pas sa fin : un changement de lot daté par
 * l'éleveur n'est jamais réécrit.
 *
 * Redater l'appartenance change aussi la couverture des collectes de lait par
 * les soins collectifs (revue du 2026-11-15) : un soin de lot antérieur à
 * l'ancienne arrivée couvre désormais les collectes individuelles de l'animal,
 * ou l'inverse. L'écartement (`ecarteAttente`) est donc ajusté ici, dans la
 * transaction de l'appelant, d'après la couverture sanitaire lue AVANT et APRÈS
 * le redatage (`couvertureCollectes`, même règle que `resyncEcartementLait`).
 * Tous les appelants (PUT/PATCH des fiches, outil `update_animal`) en héritent.
 *
 * Un écartement peut aussi être manuel (saisie de collecte, sans soin) et la
 * base n'en garde pas la provenance. Le redatage ne touche donc qu'à ce qu'il
 * change (revue ADV-39) : il écarte une collecte que la nouvelle date fait
 * couvrir, et ne réintègre QUE celle qu'un soin couvrait avant et ne couvre
 * plus. Une collecte écartée sans soin couvrant, de l'animal, de son lot ou
 * d'un voisin du périmètre, reste écartée.
 *
 * Fenêtre recalculée : du plus tôt des deux débuts jusqu'à la fin d'attente lait
 * la plus tardive des soins datés avant le plus tard des deux (seuls ces soins
 * changent d'applicabilité), et au moins jusqu'au plus tard des deux débuts
 * (le tank du lot où l'animal se trouve un jour donné en dépend aussi).
 */
export async function redaterAffectationInitiale(
  db: Prisma.TransactionClient,
  userId: string,
  animalId: number,
  dateArrivee: Date,
) {
  const premiere = await db.$queryRaw<{ id: string; dateDebut: Date; dateFin: Date | null; motif: string | null }[]>(Prisma.sql`
    SELECT "id", "date_debut" AS "dateDebut", "date_fin" AS "dateFin", "motif"
    FROM "historique_lots_animaux"
    WHERE "user_id" = ${userId} AND "animal_id" = ${animalId}
    ORDER BY "date_debut" ASC, "created_at" ASC
    LIMIT 1
    FOR UPDATE
  `)
  const ligne = premiere?.[0]
  if (!ligne || ligne.dateDebut.getTime() === dateArrivee.getTime()) return
  // Mêmes conditions que l'UPDATE ci-dessous (qui les garde par sécurité) :
  // évite de lire la couverture pour une ligne qui ne sera pas redatée.
  if (!(MOTIFS_AFFECTATION_INITIALE as readonly string[]).includes(ligne.motif ?? '')) return
  if (ligne.dateFin && ligne.dateFin < dateArrivee) return

  const debut = new Date(Math.min(ligne.dateDebut.getTime(), dateArrivee.getTime()))
  const finRedatage = new Date(Math.max(ligne.dateDebut.getTime(), dateArrivee.getTime()))
  const dernierSoin = await db.soinAnimal.aggregate({
    where: {
      userId,
      fait: true,
      finAttenteLait: { not: null, gte: debut },
      // Un jour de marge : un soin horodaté le dernier jour compte en jour civil.
      date: { lt: new Date(finRedatage.getTime() + 86_400_000) },
    },
    _max: { finAttenteLait: true },
  })
  const finMax = dernierSoin._max.finAttenteLait
  const fin = finMax && finMax > finRedatage ? finMax : finRedatage
  // Le redatage ne change que des dates : les cibles sont les mêmes avant et après.
  const cibles = await ciblesLaitAffectees(db, userId, animalId, null)
  // Un jour de marge de chaque côté : dates horodatées lues en jour civil de
  // Paris, collectes stockées à minuit UTC.
  const fenetreMin = new Date(debut.getTime() - 86_400_000)
  const fenetreMax = new Date(fin.getTime() + 86_400_000)
  const avant = await couvertureCollectes(db, userId, cibles, fenetreMin, fenetreMax)

  const modifiees = await db.$executeRaw(Prisma.sql`
    UPDATE "historique_lots_animaux"
    SET "date_debut" = ${dateArrivee}
    WHERE "id" = ${ligne.id} AND "user_id" = ${userId}
    AND "motif" IN (${Prisma.join([...MOTIFS_AFFECTATION_INITIALE])})
    AND ("date_fin" IS NULL OR "date_fin" >= ${dateArrivee})
  `)
  if (!modifiees) return

  const apres = await couvertureCollectes(db, userId, cibles, fenetreMin, fenetreMax)
  const couverteAvant = new Set(avant.filter((c) => c.couverte).map((c) => c.id))
  const aEcarter = apres.filter((c) => c.couverte && !c.ecarteAttente).map((c) => c.id)
  // Réintégrer seulement ce que le redatage découvre : jamais un écartement
  // manuel (aucun soin ne le couvrait avant), ni une collecte encore couverte.
  const aReintegrer = apres
    .filter((c) => c.ecarteAttente && !c.couverte && couverteAvant.has(c.id))
    .map((c) => c.id)
  await ecrireEcartement(db, userId, aEcarter, aReintegrer)
}

/**
 * Règle comptable du prix d'achat d'un animal rattaché à un lot, partagée par
 * la fiche animal (PATCH) et la composition groupée d'un lot : le prix
 * individuel n'est « inclus dans le lot » que si l'animal ET le lot ont un prix
 * d'achat, et un animal payé seul ne peut entrer dans un lot payé en bloc sans
 * que l'on dise lequel des deux prix fait foi.
 */
export function regleAchatInclusLot(args: {
  prixAchat: number | null
  inclusDemande: boolean
  lotCible: number | null
  lotPorteAchat: boolean
}): { inclus: boolean; erreur: string | null } {
  const inclus = args.lotCible === null ? false : args.inclusDemande
  const prixPositif = Number(args.prixAchat || 0) > 0
  if (inclus && (!prixPositif || !args.lotPorteAchat)) {
    return {
      inclus,
      erreur: "Le prix ne peut être inclus dans le lot que si l'animal et le lot ont tous deux un prix d'achat.",
    }
  }
  if (prixPositif && args.lotPorteAchat && !inclus) {
    return {
      inclus,
      erreur: "Ce lot possède déjà un prix d'achat total. Cochez « prix inclus dans le lot » ou retirez l'un des deux prix.",
    }
  }
  return { inclus, erreur: null }
}
