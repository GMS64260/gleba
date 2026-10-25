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

import { dateJourSeul, jourCivilStocke } from '@/lib/jour-civil'

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

/** Jours civils entre deux dates « jour seul » (règle `jourCivilStocke`), ou null. */
function ecartJoursCivils(avant: Date | null | undefined, apres: Date | null | undefined): number | null {
  const a = jourCivilStocke(avant ?? null)
  const b = jourCivilStocke(apres ?? null)
  if (!a || !b) return null
  return Math.round((Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`)) / 86_400_000)
}

/** Plus longue fenêtre de récolte crédible d'une culture : 52 semaines. */
const FENETRE_MAX_JOURS = 52 * JOURS_PAR_SEMAINE

/**
 * Fenêtre stockée incohérente : fin avant le début, ou plus de 52 semaines de
 * récolte. Signature du défaut du 2026-10-25 (fin héritée d'un autre
 * itinéraire, 392 jours) : elle est traitée comme absente et refaite.
 */
export function fenetreRecolteIncoherente(c: { dateRecolte?: Date | null; finRecolte?: Date | null }): boolean {
  const ecart = ecartJoursCivils(c.dateRecolte, c.finRecolte)
  return ecart !== null && (ecart < 0 || ecart > FENETRE_MAX_JOURS)
}

/**
 * Fin de fenêtre à écrire quand une culture EXISTANTE change : la fenêtre suit
 * son début. Règle unique du formulaire d'édition (fiche et PUT), du PATCH et
 * du report.
 *
 * Constat du 2026-10-25 (compte réel, scénario reconstitué depuis les dates
 * stockées) : un ail planté S3, récolté S29 2026, portait une fin au
 * 2027-08-09, soit S27 2027 + 5 semaines, la fenêtre de l'ITP « Ail d'automne
 * sec — sous abri » (plantation S44, récolte S27 de l'année suivante). Changer
 * l'ITP dans le formulaire d'édition réécrit plantation et récolte
 * (`datesDepuisItp`) sans toucher la fin, et le PUT écrivait chaque champ
 * seul : fenêtre de 392 jours, fermée un an trop tard. Seul le report faisait
 * suivre la fin.
 *
 * - Une fin que l'utilisateur a changée (autre jour que la fin stockée) fait foi.
 * - Nouvel itinéraire, culture sans fenêtre, ou fenêtre stockée incohérente
 *   (`fenetreRecolteIncoherente`, réparée au prochain enregistrement) : la
 *   fenêtre est refaite depuis la durée de récolte de l'ITP
 *   (`finRecolteDepuisItp`, règle de la création). ITP connu mais sans durée :
 *   la fin est effacée plutôt qu'héritée (rien d'inventé).
 * - Même itinéraire : la fenêtre garde sa longueur, décalée du même nombre de
 *   jours civils que son début (une durée corrigée à la main survit).
 *
 * La fin rendue est un jour seul, minuit UTC (`dateJourSeul`), pour tous les
 * appelants. Rend `undefined` quand il n'y a rien à écrire.
 */
export function finRecolteApresModification(params: {
  avant: { dateRecolte?: Date | null; finRecolte?: Date | null }
  /** Début de récolte APRÈS la modification (la valeur stockée s'il ne change pas). */
  dateRecolte: Date | null | undefined
  /** Fin envoyée avec la modification ; `undefined` = non envoyée. */
  finSoumise?: Date | string | null
  /** L'itinéraire de la culture change dans la même modification. */
  itpChange?: boolean
  /**
   * Itinéraire final, calé sur la zone du lecteur ; `null` = aucun ITP,
   * `undefined` = non lu (le report) : rien n'est alors effacé.
   */
  itp?: SourceFenetreItp | null
}): Date | null | undefined {
  const { avant, dateRecolte, finSoumise, itpChange = false } = params
  const itpConnu = params.itp !== undefined
  if (finSoumise !== undefined && jourCivilStocke(finSoumise) !== jourCivilStocke(avant.finRecolte ?? null)) {
    return undefined
  }
  if (!dateRecolte) return undefined

  const ecart = ecartJoursCivils(avant.dateRecolte, dateRecolte)
  const incoherente = fenetreRecolteIncoherente(avant)
  if (ecart === 0 && !itpChange && !incoherente) return undefined

  if (itpChange || incoherente || ecart === null || !avant.finRecolte) {
    const derivee = finRecolteDepuisItp(dateRecolte, params.itp ?? null)
    if (derivee) return dateJourSeul(derivee)
    if (itpConnu && (itpChange || incoherente) && avant.finRecolte) return null
  }
  if (avant.finRecolte && ecart) {
    const fin = new Date(avant.finRecolte)
    fin.setDate(fin.getDate() + ecart)
    return dateJourSeul(fin)
  }
  return undefined
}

export interface CycleCulture {
  dateSemis?: Date | null
  datePlantation?: Date | null
  dateRecolte?: Date | null
  finRecolte?: Date | null
  /** Une culture close ne compte plus, vivace ou pas. */
  terminee?: string | Date | null
  /**
   * `espece.vivace` : la plante reste en place après sa fenêtre de récolte
   * (fraisier, asperge, artichaut, rhubarbe…). Absent = annuelle.
   */
  espece?: { vivace?: boolean | null; [autre: string]: unknown } | null
}

/**
 * Une vivace non terminée occupe sa planche SANS fin de cycle : sa fenêtre de
 * récolte se referme, la plante reste. Constaté le 2026-08-25 sur un compte
 * réel (fraisiers plantés en 2023 traités comme libérant leur planche six
 * semaines après la première récolte) — corrigé sur le plan le 2026-09-02, et
 * ici pour l'occupation et les chevauchements.
 */
export function estVivaceEnPlace(culture: CycleCulture): boolean {
  return culture.espece?.vivace === true && !culture.terminee
}

/**
 * Une culture en place chevauche-t-elle la période [debut, fin] demandée sur la
 * même planche ?
 *
 * - Vivace non terminée : oui dès que la période commence après sa mise en
 *   place — elle n'a pas de fin.
 * - Annuelle : chevauchement d'intervalles avec `finDeCycle`.
 * - `null` quand les dates ne permettent pas de conclure (pas de début, ou pas
 *   de fin pour une annuelle) : l'appelant décide de la prudence à tenir.
 */
export function chevauchePeriode(
  culture: CycleCulture,
  debut: Date,
  fin: Date
): boolean | null {
  const cDebut = culture.dateSemis ?? culture.datePlantation
  if (!cDebut) return null
  const debutCulture = new Date(cDebut)
  if (estVivaceEnPlace(culture)) return debutCulture < fin
  const finCulture = finDeCycle(culture)
  if (!finCulture) return null
  return debut < finCulture && debutCulture < fin
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
