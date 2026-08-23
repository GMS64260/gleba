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
