/**
 * Effectif pondeur d'un lot : têtes du lot qui peuvent pondre.
 *
 * QA cmv5jfsol (2026-10-12) — une éclosion rattachée à un lot de pondeuses
 * (3 poussins du jour, dont 2 mâles) entrait aussitôt dans « pondeuses »,
 * dans le taux de ponte et dans la collecte attendue : l'effectif reconstitué
 * (`reconstituerEffectifsLots`) compte toutes les têtes présentes, ce qui est
 * juste pour le lot et faux pour la ponte.
 *
 * Règle : ne pondent pas
 *  - les nés dans le lot (naissances rattachées au lot, part encore anonyme)
 *    tant qu'ils n'ont pas l'âge d'entrée en ponte de l'espèce
 *    (`EspeceAnimale.dureeElevage`, « jours jusqu'à maturité », sinon
 *    `AGE_PONTE_DEFAUT_JOURS`) ;
 *  - les fiches nominatives rattachées au lot de sexe mâle ou trop jeunes.
 *
 * `dureeElevage` est le champ « Élevage (j) » de la fiche d'espèce, documenté
 * « jours jusqu'à maturité/abattage » : pour une espèce pondeuse ou mixte il
 * vaut âge d'entrée en ponte (150 pour la poule pondeuse du catalogue). Une
 * espèce mixte renseignée avec son âge d'abattage compte ses jeunes trop tôt.
 *
 * Limites assumées : passé l'âge de ponte, les mâles d'une naissance anonyme
 * comptent comme pondeuses tant qu'ils ne sont pas sortis (abattage, vente,
 * fiche nominative) — on ne sait pas quelles têtes anonymes sont parties, et
 * les retrancher ferait disparaître des poules quand ce sont les coqs qui
 * ont été sortis. Une mortalité de jeunes saisie par simple décrément du
 * compteur du lot est elle aussi invisible ici. Une fiche de petit supprimée
 * (`PetitNaissance.animalId` remis à null, compteur du lot non ré-incrémenté)
 * redevient une tête anonyme jeune pour cette règle alors que l'effectif
 * reconstitué ne la compte plus : une pondeuse de moins jusqu'à l'âge de ponte.
 *
 * Source unique pour /api/elevage/stats (taux de ponte, « N pondeuses »),
 * /api/elevage/lots (`effectifPondeuses` de la saisie de ponte) et
 * /api/elevage/taches (collecte attendue du calendrier) : la règle est
 * `effectifPondeuses()`, `effectifsPondeursLots()` l'enchaîne avec l'effectif
 * reconstitué pour un appelant qui n'en a pas déjà un.
 */
import prisma from '@/lib/prisma'
import { reconstituerEffectifsLots, type LotEffectifInput } from '@/lib/elevage/effectif'

/** Espèce dont les lots entrent dans l'effectif pondeur (même test que /stats et /taches). */
export function estEspecePondeuse(production: string | null | undefined): boolean {
  return production === 'oeufs' || production === 'mixte'
}

/** Âge d'entrée en ponte par défaut (poule : 18 à 22 semaines). */
export const AGE_PONTE_DEFAUT_JOURS = 150

const JOUR_MS = 86_400_000

export interface EspecePonteInput {
  dureeElevage: number | null
}

export interface LotPondeurInput {
  id: number
  especeAnimale: EspecePonteInput
}

export interface NaissancePonteInput {
  date: Date
  nombreVivants: number
  /** Petits de cette naissance déjà passés en fiche nominative. */
  fichesCreees: number
}

export interface NominatifPonteInput {
  sexe: string | null
  dateNaissance: Date | null
}

export function ageEntreePonteJours(espece: EspecePonteInput): number {
  return espece.dureeElevage != null && espece.dureeElevage > 0
    ? espece.dureeElevage
    : AGE_PONTE_DEFAUT_JOURS
}

function ageJours(naissance: Date, reference: Date): number {
  return Math.floor((reference.getTime() - naissance.getTime()) / JOUR_MS)
}

/**
 * Têtes anonymes d'une naissance rattachée au lot qui ne pondent pas encore
 * à la date de référence (règle pure, testable sans base).
 */
export function tetesNonPondeusesNaissance(
  naissance: NaissancePonteInput,
  agePonteJours: number,
  reference: Date,
): number {
  const anonymes = Math.max(0, naissance.nombreVivants - naissance.fichesCreees)
  if (anonymes === 0) return 0
  // Une naissance datée dans le futur (saisie anticipée) ne pond pas non plus.
  return ageJours(naissance.date, reference) < agePonteJours ? anonymes : 0
}

/** Une fiche nominative rattachée au lot pond-elle ? */
export function nominatifPondeur(
  animal: NominatifPonteInput,
  agePonteJours: number,
  reference: Date,
): boolean {
  if (animal.sexe === 'male') return false
  if (animal.dateNaissance && ageJours(animal.dateNaissance, reference) < agePonteJours) return false
  return true
}

/**
 * Nombre de têtes non pondeuses par lot (à retrancher de l'effectif
 * reconstitué). Aucune requête si la liste est vide.
 */
export async function calculerTetesNonPondeuses(
  userId: string,
  lots: LotPondeurInput[],
  reference: Date = new Date(),
): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  const lotIds = lots.map((l) => l.id)
  if (lotIds.length === 0) return result

  const [naissances, nominatifs] = await Promise.all([
    prisma.naissanceAnimale.findMany({
      where: { userId, lotId: { in: lotIds } },
      select: {
        lotId: true,
        date: true,
        nombreVivants: true,
        _count: { select: { petits: { where: { animalId: { not: null } } } } },
      },
    }),
    prisma.animal.findMany({
      where: { userId, lotId: { in: lotIds }, statut: 'actif' },
      select: { lotId: true, sexe: true, dateNaissance: true },
    }),
  ])

  const ageParLot = new Map(lots.map((l) => [l.id, ageEntreePonteJours(l.especeAnimale)]))
  const ajouter = (lotId: number, n: number) => {
    if (n > 0) result.set(lotId, (result.get(lotId) ?? 0) + n)
  }
  for (const n of naissances) {
    if (n.lotId == null) continue
    ajouter(
      n.lotId,
      tetesNonPondeusesNaissance(
        { date: n.date, nombreVivants: n.nombreVivants, fichesCreees: n._count.petits },
        ageParLot.get(n.lotId) ?? AGE_PONTE_DEFAUT_JOURS,
        reference,
      ),
    )
  }
  for (const a of nominatifs) {
    if (a.lotId == null) continue
    if (!nominatifPondeur(a, ageParLot.get(a.lotId) ?? AGE_PONTE_DEFAUT_JOURS, reference)) {
      ajouter(a.lotId, 1)
    }
  }
  return result
}

/** Effectif pondeur d'un lot : effectif reconstitué moins les non-pondeuses, jamais négatif. */
export function effectifPondeuses(effectifCalcule: number, tetesNonPondeuses: number | undefined): number {
  return Math.max(0, effectifCalcule - (tetesNonPondeuses ?? 0))
}

export interface EffectifPondeurLot {
  /** Effectif reconstitué du lot (`reconstituerEffectifsLots`). */
  effectifCalcule: number
  tetesNonPondeuses: number
  effectifPondeuses: number
}

/**
 * Effectif pondeur par lot, effectif reconstitué compris, pour un appelant qui
 * ne dispose pas déjà de `reconstituerEffectifsLots` (ex. /api/elevage/taches).
 * Les deux lectures sont indépendantes et lancées en parallèle.
 */
export async function effectifsPondeursLots(
  userId: string,
  lots: (LotEffectifInput & LotPondeurInput)[],
  reference: Date = new Date(),
): Promise<Map<number, EffectifPondeurLot>> {
  const result = new Map<number, EffectifPondeurLot>()
  if (lots.length === 0) return result
  const [effectifs, tetes] = await Promise.all([
    reconstituerEffectifsLots(userId, lots),
    calculerTetesNonPondeuses(userId, lots, reference),
  ])
  for (const lot of lots) {
    const effectifCalcule = effectifs.get(lot.id)?.effectifCalcule ?? lot.quantiteActuelle
    const tetesNonPondeuses = tetes.get(lot.id) ?? 0
    result.set(lot.id, {
      effectifCalcule,
      tetesNonPondeuses,
      effectifPondeuses: effectifPondeuses(effectifCalcule, tetesNonPondeuses),
    })
  }
  return result
}
