/**
 * Fenêtre de récolte d'une culture : une récolte DURE, elle n'a pas lieu un jour.
 *
 * Constat du 2026-08-26, mesuré en production : `cultures.fin_recolte` était NULL
 * sur les 579 cultures de la base. Aucun formulaire ne la proposait et
 * `/api/cultures` ne la connaissait pas — seul `/api/import` savait l'écrire.
 * Une culture n'avait donc qu'une DATE de récolte, alors que le référentiel
 * porte la durée : 767 des 773 ITP renseignent `dureeRecolte` (en semaines) et
 * 551 une `semaineRecolteFin`. Le verger s'en servait déjà
 * (`api/arbres/recoltes` calcule `semaineFin = semaineDebut + dureeRecolte`) ;
 * le maraîchage recevait `dureeRecolte` dans le type de l'ITP côté formulaire et
 * le jetait.
 *
 * Deux conséquences mesurées, que ce module ferme :
 *
 * 1. Un arriéré qui ne se solde jamais. 84 cultures sur 13 comptes étaient
 *    « récolte en retard », 63 jours de retard en moyenne et 142 au maximum —
 *    dont une aubergine dont l'ITP donne 18 semaines de récolte à partir de la
 *    semaine 24, affichée « 31 jours de retard » un mois après sa date de début.
 * 2. Une planche déclarée libre trop tôt. `api/cultures` prenait `dateRecolte`
 *    comme fin de cycle pour le warning de chevauchement ET pour le calcul
 *    d'occupation : une culture en récolte pendant 18 semaines libérait sa
 *    planche le lendemain de sa première date.
 *
 * `dateRecolte` reste le DÉBUT de la fenêtre — c'est le repère de planification
 * historique, celui auquel toutes les cultures existantes sont rattachées. On ne
 * le déplace pas, on lui ajoute une fin.
 */

/** Millisecondes dans une journée — les fenêtres se comptent en jours civils. */
const JOURS_PAR_SEMAINE = 7

export interface SourceFenetreItp {
  /** Semaine ISO de début de récolte au référentiel (1-52). */
  semaineRecolte?: number | null
  /** Semaine ISO de fin de fenêtre, quand la source la documente (1-52). */
  semaineRecolteFin?: number | null
  /** Durée de la période de récolte, en semaines. */
  dureeRecolte?: number | null
}

/**
 * Nombre de semaines de récolte porté par un itinéraire.
 *
 * Deux expressions coexistent au référentiel et disent la même chose : une durée
 * explicite (`dureeRecolte`) et un couple début/fin (`semaineRecolte`,
 * `semaineRecolteFin`). La durée explicite prime, parce qu'elle ne dépend pas
 * d'un passage de fin d'année ; le couple sert de repli, en tenant compte du
 * bouclage sur 52 semaines (une récolte peut commencer en S48 et finir en S6).
 */
export function semainesDeRecolte(itp: SourceFenetreItp | null | undefined): number | null {
  if (!itp) return null

  if (typeof itp.dureeRecolte === 'number' && itp.dureeRecolte > 0) {
    return itp.dureeRecolte
  }

  const debut = itp.semaineRecolte
  const fin = itp.semaineRecolteFin
  if (typeof debut === 'number' && typeof fin === 'number') {
    const ecart = ((fin - debut) % 52 + 52) % 52
    if (ecart > 0) return ecart
  }

  return null
}

/**
 * Fin de fenêtre déduite d'une date de début et d'un itinéraire.
 *
 * Rend `null` quand le référentiel ne dit rien : une fenêtre inventée serait
 * pire que pas de fenêtre du tout, puisqu'elle repousserait silencieusement une
 * échéance réelle. Le décalage se fait en JOURS CIVILS via `setDate` — un offset
 * en millisecondes qui traverse un changement d'heure dérive d'une heure, donc
 * d'un jour près de minuit (audit fuseaux #76, même règle que `report.ts`).
 */
export function finRecolteDepuisItp(
  dateRecolte: Date | null | undefined,
  itp: SourceFenetreItp | null | undefined
): Date | null {
  if (!dateRecolte) return null
  const semaines = semainesDeRecolte(itp)
  if (semaines === null) return null

  const fin = new Date(dateRecolte)
  fin.setDate(fin.getDate() + semaines * JOURS_PAR_SEMAINE)
  return fin
}

export interface CycleCulture {
  dateSemis?: Date | null
  datePlantation?: Date | null
  dateRecolte?: Date | null
  finRecolte?: Date | null
}

/**
 * Fin du cycle d'une culture, pour l'occupation de planche et la détection de
 * chevauchement.
 *
 * `finRecolte` quand elle existe, `dateRecolte` sinon. Une fenêtre plus COURTE
 * que la date de début serait une donnée incohérente : on garde alors la plus
 * tardive des deux, pour ne jamais raccourcir un cycle par accident.
 */
export function finDeCycle(culture: CycleCulture): Date | null {
  const debut = culture.dateRecolte ? new Date(culture.dateRecolte) : null
  const fin = culture.finRecolte ? new Date(culture.finRecolte) : null
  if (!debut) return fin
  if (!fin) return debut
  return fin > debut ? fin : debut
}

/**
 * Une récolte est-elle réellement en retard ?
 *
 * Tant que la fenêtre court, la culture est EN RÉCOLTE, pas en retard : c'est le
 * cœur du correctif. Le retard commence après la fin de fenêtre — et à défaut de
 * fenêtre, après la date de récolte, comme avant.
 */
export function recolteEnRetard(
  culture: CycleCulture & { recolteFaite?: boolean | null; terminee?: string | null },
  maintenant: Date
): boolean {
  if (culture.recolteFaite) return false
  if (culture.terminee) return false
  const fin = finDeCycle(culture)
  if (!fin) return false
  return fin < maintenant
}
