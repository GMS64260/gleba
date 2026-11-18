/**
 * Date d'exécution d'une étape de culture.
 *
 * QA cmsp66tdm : cliquer une tâche « Semis Mâche planifiée au 15/08 » le 11/08
 * marquait le semis fait tout en conservant la date du 15/08 — le registre
 * affichait donc un fait daté dans le futur. Aucun des chemins de complétion
 * (PATCH unitaire, action en masse) n'écrivait de date d'exécution.
 *
 * Règle retenue, la plus prudente : une étape marquée faite ne peut pas porter
 * une date future. On ramène alors la date au jour courant ; une date déjà
 * passée ou du jour n'est pas touchée, pour ne pas réécrire l'historique des
 * tâches en retard (le décompte de retard reste celui de `taches-potager`).
 *
 * Friction 2026-08-20, corollaire de cette règle : le recalage écrasait la date
 * du PLAN, et rien ne la restituait quand l'étape était décochée. Un compte
 * réel a ainsi perdu les dates de semis et de plantation d'une culture de
 * fleurs planifiée pour l'année suivante — remplacées par l'horodatage du clic,
 * à la seconde, sans trace de la valeur d'origine. La date prévisionnelle est
 * désormais mémorisée avant recalage (`Culture.date*Plan`) et rendue au retour
 * en arrière. Toute écriture de ces trois champs passe par ce module : c'est ce
 * qui garantit que les quatre chemins de complétion (PATCH rapide, formulaire
 * complet, action en masse, saisie de récolte) racontent la même histoire.
 */

import type { Prisma } from '@prisma/client'
import { jourCivilStocke, jourLocalISO } from '@/lib/jour-civil'

/** Champ de date porté par chaque jalon d'avancement. */
export const CHAMP_DATE_ETAPE = {
  semisFait: 'dateSemis',
  plantationFaite: 'datePlantation',
  recolteFaite: 'dateRecolte',
} as const

/** Champ mémorisant la date de plan pendant le recalage d'exécution. */
export const CHAMP_PLAN_ETAPE = {
  semisFait: 'dateSemisPlan',
  plantationFaite: 'datePlantationPlan',
  recolteFaite: 'dateRecoltePlan',
} as const

export type ChampEtape = keyof typeof CHAMP_DATE_ETAPE
export type ChampDateEtape = (typeof CHAMP_DATE_ETAPE)[ChampEtape]
export type ChampPlanEtape = (typeof CHAMP_PLAN_ETAPE)[ChampEtape]

/** Les trois étapes, dans l'ordre du cycle. */
export const ETAPES: readonly ChampEtape[] = [
  'semisFait',
  'plantationFaite',
  'recolteFaite',
] as const

/** Ce que ce module a besoin de lire sur une culture pour décider. */
export type EtatEtapes = Partial<
  Record<ChampDateEtape | ChampPlanEtape, Date | null>
>

/** Les six champs de dates à charger avant d'appeler ce module. */
export const SELECT_ETAPES = {
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  dateSemisPlan: true,
  datePlantationPlan: true,
  dateRecoltePlan: true,
} as const

/** Numéro de journée civile LOCALE (le conteneur tourne en Europe/Paris). */
export function jourCivilLocal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * Date à écrire quand l'étape passe à « fait », ou `null` s'il n'y a rien à
 * corriger. La comparaison se fait en journées civiles locales : comparer des
 * instants UTC bruts recalerait à tort une date du jour stockée à 00:00.
 *
 * @param datePlanifiee date prévisionnelle actuellement stockée
 * @param maintenant instant de référence (injectable pour les tests)
 */
export function dateExecutionARecaler(
  datePlanifiee: Date | null | undefined,
  maintenant: Date = new Date(),
): Date | null {
  if (!datePlanifiee) return maintenant
  if (jourCivilLocal(datePlanifiee) > jourCivilLocal(maintenant)) return maintenant
  return null
}

/**
 * Écritures à appliquer quand une étape passe à FAITE : recalage éventuel de la
 * date d'exécution, et mémorisation de la date de plan si elle est écrasée.
 *
 * La mémorisation est faite UNE SEULE FOIS. Sans ce garde-fou, cocher, décocher
 * puis recocher aurait mémorisé la date d'exécution du premier passage comme
 * date de plan : le plan aurait fondu à chaque aller-retour.
 */
export function ecrituresPassageAFait(
  etat: EtatEtapes,
  champEtape: ChampEtape,
  maintenant: Date = new Date(),
): Partial<Record<ChampDateEtape | ChampPlanEtape, Date | null>> {
  const champDate = CHAMP_DATE_ETAPE[champEtape]
  const champPlan = CHAMP_PLAN_ETAPE[champEtape]
  const datePlanifiee = etat[champDate] ?? null
  const recalage = dateExecutionARecaler(datePlanifiee, maintenant)
  if (!recalage) return {}
  const memoire =
    etat[champPlan] == null && datePlanifiee != null
      ? { [champPlan]: datePlanifiee }
      : {}
  return { [champDate]: recalage, ...memoire }
}

/**
 * Écritures à appliquer quand une étape repasse à NON FAITE : la date de plan
 * mémorisée reprend sa place et la mémoire est libérée.
 *
 * Rend un objet vide quand il n'y a rien à restituer — étape jamais recalée, ou
 * culture antérieure à la mémorisation. On ne devine alors AUCUNE date : une
 * date d'exécution laissée en place est un moindre mal devant une date inventée.
 */
export function ecrituresRetourANonFait(
  etat: EtatEtapes,
  champEtape: ChampEtape,
): Partial<Record<ChampDateEtape | ChampPlanEtape, Date | null>> {
  const champPlan = CHAMP_PLAN_ETAPE[champEtape]
  const plan = etat[champPlan] ?? null
  if (plan == null) return {}
  return { [CHAMP_DATE_ETAPE[champEtape]]: plan, [champPlan]: null }
}

/**
 * Une date d'étape fournie explicitement par l'appelant REDÉFINIT le plan : la
 * mémoire n'a plus d'objet et doit être libérée, sinon un retour en arrière
 * ultérieur ressusciterait une date que l'utilisateur a lui-même remplacée.
 */
export function ecrituresDatePlanRedefinie(
  champEtape: ChampEtape,
): Partial<Record<ChampPlanEtape, null>> {
  return { [CHAMP_PLAN_ETAPE[champEtape]]: null }
}

/**
 * Recette-3 (2026-11-15, culture97) : changer l'ITP d'une culture dont les
 * trois étapes étaient faites réécrivait leurs dates sur le nouveau plan —
 * semis au 30/11/2026, récolte au 15/02/2027 — alors que des récoltes étaient
 * enregistrées les 13 et 15/11/2026. Le PUT, le PATCH et l'outil assistant
 * acceptaient tous une date d'étape faite dans le futur dès lors qu'elle était
 * fournie explicitement : seul le recalage du passage à « fait » protégeait.
 *
 * Garde commune aux trois chemins : dans l'état FINAL, une étape faite n'est
 * pas datée après le jour civil courant (Europe/Paris, fuseau du processus),
 * et une récolte faite n'est pas datée après la première récolte enregistrée.
 * Elle ne s'applique qu'à une étape dont le drapeau ou le jour change : une
 * donnée ancienne incohérente ne bloque pas l'édition d'un autre champ.
 */

/** Ce que la garde lit d'une culture, avant et après l'écriture. */
export type EtatDatesEtapes = Partial<Record<ChampEtape, boolean | null>> &
  Partial<Record<ChampDateEtape, Date | string | null>>

export type ErreurDateEtape = { error: string; champ: ChampDateEtape }

const MESSAGE_ETAPE_FUTURE: Record<ChampEtape, string> = {
  semisFait: 'La date du semis réalisé ne peut pas être dans le futur.',
  plantationFaite: 'La date de la plantation réalisée ne peut pas être dans le futur.',
  recolteFaite: 'La date de la récolte réalisée ne peut pas être dans le futur.',
}

function jourFrancais(jourIso: string): string {
  const [a, m, j] = jourIso.split('-')
  return `${j}/${m}/${a}`
}

/**
 * Règle pure : erreur à renvoyer (400) ou `null`. `premiereRecolte` est la date
 * de la première récolte enregistrée de la culture (ou `null`).
 */
export function erreurDatesEtapesFaites(
  avant: EtatDatesEtapes,
  apres: EtatDatesEtapes,
  premiereRecolte: Date | null,
  maintenant: Date = new Date(),
): ErreurDateEtape | null {
  const aujourdhui = jourLocalISO(maintenant)
  for (const champEtape of ETAPES) {
    if (!apres[champEtape]) continue
    const champDate = CHAMP_DATE_ETAPE[champEtape]
    const jour = jourCivilStocke(apres[champDate])
    const change =
      Boolean(avant[champEtape]) !== Boolean(apres[champEtape]) ||
      jour !== jourCivilStocke(avant[champDate])
    if (!change || !jour) continue
    if (jour > aujourdhui) return { error: MESSAGE_ETAPE_FUTURE[champEtape], champ: champDate }
    if (champEtape === 'recolteFaite') {
      const premiere = jourCivilStocke(premiereRecolte)
      if (premiere && jour > premiere) {
        return {
          error: `La date de récolte ne peut pas être postérieure à la première récolte enregistrée (${jourFrancais(premiere)}).`,
          champ: champDate,
        }
      }
    }
  }
  return null
}

/** Accès minimal à la base : le client Prisma ou une transaction. */
export type LecteurRecoltes = {
  recolte: {
    findFirst(args: {
      where: { cultureId: number; userId: string }
      orderBy: { date: 'asc' }
      select: { date: true }
    }): Promise<{ date: Date } | null>
  }
}

/**
 * Garde partagée par PUT /api/cultures/[id], PATCH /api/cultures/[id] et
 * l'outil assistant `update_culture`. La première récolte n'est lue que si une
 * récolte faite change, et uniquement parmi celles de l'exploitation `userId`.
 */
export async function controlerDatesEtapesFaites(
  db: LecteurRecoltes,
  args: {
    userId: string
    cultureId: number
    avant: EtatDatesEtapes
    apres: EtatDatesEtapes
    maintenant?: Date
  },
): Promise<ErreurDateEtape | null> {
  const maintenant = args.maintenant ?? new Date()
  const sansRecolte = erreurDatesEtapesFaites(args.avant, args.apres, null, maintenant)
  if (sansRecolte) return sansRecolte
  const recolteChange =
    Boolean(args.apres.recolteFaite) &&
    (Boolean(args.avant.recolteFaite) !== Boolean(args.apres.recolteFaite) ||
      jourCivilStocke(args.apres.dateRecolte) !== jourCivilStocke(args.avant.dateRecolte))
  if (!recolteChange) return null
  const premiere = await db.recolte.findFirst({
    where: { cultureId: args.cultureId, userId: args.userId },
    orderBy: { date: 'asc' },
    select: { date: true },
  })
  return erreurDatesEtapesFaites(args.avant, args.apres, premiere?.date ?? null, maintenant)
}

/**
 * Instant de référence du recalage quand une étape passe à « faite » sans date
 * fournie. Pour la récolte, la première récolte enregistrée si elle est
 * antérieure à maintenant — règle de la saisie de récolte (`recolte/creation`,
 * qui recale sur la date de la récolte saisie) — sinon le recalage au jour
 * même daterait la récolte après les récoltes déjà enregistrées, et la garde
 * `controlerDatesEtapesFaites` refuserait la case cochée.
 */
export async function instantPassageAFait(
  db: LecteurRecoltes,
  args: { userId: string; cultureId: number; champEtape: ChampEtape; maintenant?: Date },
): Promise<Date> {
  const maintenant = args.maintenant ?? new Date()
  if (args.champEtape !== 'recolteFaite') return maintenant
  const premiere = await db.recolte.findFirst({
    where: { cultureId: args.cultureId, userId: args.userId },
    orderBy: { date: 'asc' },
    select: { date: true },
  })
  return premiere && premiere.date < maintenant ? premiere.date : maintenant
}

/**
 * Contre-revue adverse (2026-11-15) : lire la culture, calculer les recalages,
 * contrôler l'état final puis écrire n'était pas atomique. Une redatation
 * validée sur `semisFait = false` écrivait sa date future après qu'un PATCH
 * concurrent eut coché le semis.
 *
 * Verrou commun à toutes les mutations des étapes et de leurs dates : PUT et
 * PATCH /api/cultures/[id], outil `update_culture`, création de récoltes
 * (`recolte/creation`, qui recale la récolte faite). Pris AVANT de lire la
 * culture, dans la transaction qui écrit. `FOR UPDATE` exclut aussi les
 * insertions de récoltes concurrentes (clé étrangère, `FOR KEY SHARE`) :
 * la première récolte lue par la garde ne change pas avant l'écriture.
 * Ordre stable (id croissant) contre les interblocages ; scopé à
 * l'exploitation. Rend les ids effectivement verrouillés.
 *
 * Contre-revue adverse 2 (2026-11-15) : participent aussi au protocole
 * l'action en masse « Marquer fait » (`bulk-fait`), le report d'étape
 * (`reporter`), l'annulation de récolte (`annuler-recolte`) et la
 * modification d'une récolte (PUT /api/recoltes/[id], qui peut avancer la
 * première récolte sans toucher à la clé étrangère). Ordre global : cultures
 * PUIS lots de récolte (`verrouillerRecolteLibre`), jamais l'inverse.
 *
 * Mode `sansCle` (`FOR NO KEY UPDATE`) pour les chemins qui attendent ensuite
 * un verrou de lot : il exclut les autres détenteurs du verrou commun mais pas
 * l'insertion d'une récolte (`FOR KEY SHARE`) — sinon une vente qui tient un
 * lot et crée son reliquat interbloquerait avec eux.
 */
export async function verrouillerCultures(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  userId: string,
  cultureIds: number[],
  mode: 'exclusif' | 'sansCle' = 'exclusif',
): Promise<number[]> {
  const ids = [...new Set(cultureIds.map(Number))].filter(Number.isInteger).sort((a, b) => a - b)
  if (ids.length === 0) return []
  const lignes = mode === 'exclusif'
    ? await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM cultures
        WHERE user_id = ${userId} AND id = ANY(${ids}::int[])
        ORDER BY id
        FOR UPDATE`
    : await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM cultures
        WHERE user_id = ${userId} AND id = ANY(${ids}::int[])
        ORDER BY id
        FOR NO KEY UPDATE`
  return lignes.map((l) => Number(l.id))
}

/** Délais des transactions verrouillées (VPS lent, lectures de référentiel). */
export const OPTIONS_TRANSACTION_CULTURE = { maxWait: 10_000, timeout: 20_000 } as const
