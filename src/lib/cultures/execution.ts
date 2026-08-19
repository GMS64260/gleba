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
 */

/** Champ de date porté par chaque jalon d'avancement. */
export const CHAMP_DATE_ETAPE = {
  semisFait: 'dateSemis',
  plantationFaite: 'datePlantation',
  recolteFaite: 'dateRecolte',
} as const

export type ChampEtape = keyof typeof CHAMP_DATE_ETAPE
export type ChampDateEtape = (typeof CHAMP_DATE_ETAPE)[ChampEtape]

/** Numéro de journée civile LOCALE (le conteneur tourne en Europe/Paris). */
function jourCivilLocal(date: Date): number {
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
