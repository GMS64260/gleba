/**
 * Dates d'un cycle cultural déduites d'un itinéraire technique.
 *
 * Un ITP ne porte que des numéros de semaine (1-52), sans année : un cycle
 * peut donc chevaucher deux, voire trois millésimes (semis en octobre,
 * plantation en février, récolte en janvier suivant).
 *
 * L'ancien calcul, dupliqué dans trois formulaires, comparait chaque étape à
 * la semaine de référence prise isolément. Il pouvait produire une récolte
 * ANTÉRIEURE à la plantation : semis semaine 40 → plantation semaine 5 de
 * l'année suivante, mais récolte semaine 45 laissée sur l'année de départ.
 * Deux ITP du référentiel tombaient dans ce cas.
 *
 * On construit désormais les jalons en cascade : chacun est repoussé d'une
 * année tant qu'il précède le précédent. L'ordre semis ≤ plantation ≤ récolte
 * est donc garanti par construction.
 */

/** Lundi de la semaine ISO `semaine` de l'année `annee`. */
export function semaineVersDate(annee: number, semaine: number): Date {
  const jan4 = new Date(annee, 0, 4)
  const jourSemaine = jan4.getDay() || 7
  const lundi = new Date(jan4)
  lundi.setDate(jan4.getDate() - jourSemaine + 1 + (semaine - 1) * 7)
  return lundi
}

/**
 * Mois (1-12) dans lequel tombe la semaine ISO `semaine` de l'année `annee`.
 *
 * Deux découpages coexistaient pour la même récolte : `ceil(semaine / 4.33)`
 * côté Planification, `dateRecolte.getMonth()` côté tableau de bord et
 * Calendrier. 29 cultures sur 158 tombaient dans deux mois différents — un
 * épinard récolté le 25/05 se lisait « Juin » sur un écran et « Mai » sur
 * l'autre, sans que rien ne permette de les réconcilier. L'approximation
 * dérive d'autant plus qu'on avance dans l'année (12 mois de 4,33 semaines
 * n'en font que 52 au lieu de 52,18, et aucun mois ne dure exactement cela).
 *
 * Le mois est donc celui du LUNDI de la semaine ISO : le même calendrier que
 * les dates réellement stockées sur les cultures. Ne pas réintroduire de
 * division par 4,33.
 */
export function moisDepuisSemaine(annee: number, semaine: number): number {
  return semaineVersDate(annee, semaine).getMonth() + 1
}

export type SemainesItp = {
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
  semaineImplantationDebut?: number | null
  /** Durée du cycle en jours. > 365 = culture pluriannuelle (arbre fruitier). */
  dureeCulture?: number | null
  /** Années entre la plantation et la première récolte, quand elle est connue. */
  delaiPremiereRecolteAnnees?: number | null
}

export type DatesCycle = {
  dateSemis: Date | null
  datePlantation: Date | null
  dateRecolte: Date | null
}

/** Nombre maximum de reports d'un an : un cycle ne s'étale pas au-delà. */
const REPORTS_MAX = 2

/**
 * Années à attendre entre l'implantation et la première récolte.
 *
 * Pour une culture annuelle : 0, les semaines de l'ITP suffisent. Pour un arbre
 * fruitier, les semaines ne décrivent PAS le cycle mais la SAISON de récolte :
 * « Avocatier — antilles » porte plantation S25 et récolte S26 avec une durée de
 * culture de 1 095 jours. Prendre l'écart de semaines au pied de la lettre
 * proposait une récolte d'avocats sept jours après la plantation — et la fiche
 * du même itinéraire annonçait « Cycle : 1095 jours » juste à côté. 40 ITP
 * d'outre-mer sont dans ce cas (cocotier 2 555 j, letchi 1 825 j, manguier
 * 1 460 j…).
 *
 * Le délai déclaré fait foi ; à défaut on le déduit de la durée de culture.
 */
function anneesAvantRecolte(itp: SemainesItp): number {
  if (itp.delaiPremiereRecolteAnnees != null && itp.delaiPremiereRecolteAnnees > 0) {
    return itp.delaiPremiereRecolteAnnees
  }
  if (itp.dureeCulture != null && itp.dureeCulture > 365) {
    return Math.round(itp.dureeCulture / 365)
  }
  return 0
}

/**
 * Place une étape à la semaine donnée, en la repoussant d'année en année tant
 * qu'elle précède le jalon précédent.
 */
function jalonApres(annee: number, semaine: number, precedent: Date | null): Date {
  let date = semaineVersDate(annee, semaine)
  for (let report = 0; report < REPORTS_MAX && precedent && date < precedent; report++) {
    date = semaineVersDate(annee + report + 1, semaine)
  }
  return date
}

/**
 * Semaine de début de cycle exploitable.
 *
 * 173 ITP du référentiel (mesclun INRAE et assimilés) ne portent ni semaine de
 * semis ni semaine de plantation : seule leur fenêtre d'implantation situe le
 * début du cycle. Sans elle, la récolte était posée en absolu et pouvait
 * précéder le semis saisi par l'utilisateur (QA cmsfxvbab : Pourpier semé le
 * 05/08/2026, récolte proposée au 20/04/2026, création refusée par l'API).
 *
 * Ces ITP décrivent un semis direct (aucune durée de pépinière renseignée) :
 * l'implantation vaut donc semis. Si l'ITP porte une semaine de plantation, on
 * n'invente pas de semis — le jalon plantation suffit à ancrer la récolte.
 */
export function semaineSemisEffective(itp: SemainesItp): number | null {
  if (itp.semaineSemis) return itp.semaineSemis
  if (itp.semainePlantation) return null
  return itp.semaineImplantationDebut ?? null
}

/**
 * Durée du cycle cultural en jours, de l'ancrage (plantation, sinon semis
 * effectif) à la récolte, d'après les semaines de l'ITP. Modulo l'année : une
 * récolte en janvier pour un semis d'août vaut 21 semaines, pas −31. À défaut
 * de semaines exploitables, la durée de culture brute de l'ITP fait foi.
 *
 * Friction 2026-08-14 : la date de récolte ne suivait pas la date de début
 * saisie (ail planté le 05/03, récolte laissée au 11/07 de l'année suivante,
 * héritée de l'ancrage ITP semaine 40). Cette durée est la référence unique
 * des trois formulaires ET de la reprise de données — ne pas la recopier.
 */
/**
 * Écart, en jours, entre l'ancrage du cycle et la semaine de récolte, modulo
 * l'année (une récolte en janvier pour une plantation d'août vaut 21 semaines,
 * pas −31).
 */
function ecartAncrageRecolteJours(itp: SemainesItp): number | null {
  const ancrage = itp.semainePlantation ?? semaineSemisEffective(itp)
  if (!itp.semaineRecolte || !ancrage) return null
  return ((((itp.semaineRecolte - ancrage) % 52) + 52) % 52) * 7
}

export function dureeCycleItpJours(itp: SemainesItp): number | null {
  // Pluriannuel : N années PLUS la position de la récolte dans l'année. Rendre
  // la seule durée déclarée (1 095 j pour l'avocatier) désaccordait ce helper de
  // `datesDepuisItp`, qui pose la récolte à sa semaine N années plus tard : sur
  // « Ananas — antilles » (600 j déclarés, S24 → S26, donc 2 ans), la création
  // d'une culture et le recalage après édition de la date de plantation ne
  // donnaient pas la même récolte. Une seule arithmétique pour les deux.
  const annees = anneesAvantRecolte(itp)
  const ancrage = itp.semainePlantation ?? semaineSemisEffective(itp)
  if (annees > 0) {
    // Écart SIGNÉ ici : le passage d'année est déjà porté par `annees`. Le
    // cocotier (plantation S46, récolte S44, 7 ans) récolte deux semaines AVANT
    // sa semaine de plantation, sept ans plus tard — ajouter 50 semaines de
    // modulo par-dessus les 7 ans le décalait d'un an entier.
    const decalageSemaines =
      itp.semaineRecolte != null && ancrage != null ? itp.semaineRecolte - ancrage : 0
    return annees * 365 + decalageSemaines * 7
  }

  const ecart = ecartAncrageRecolteJours(itp)
  if (ecart && ecart > 0) return ecart
  if (itp.dureeCulture && itp.dureeCulture > 0) return itp.dureeCulture
  return null
}

/**
 * Récolte recalée sur le début réel du cycle (plantation, sinon semis), en
 * préservant la durée du cycle ITP. Null si l'ITP ne permet aucun calcul.
 */
export function recolteApresDebut(debut: Date, itp: SemainesItp): Date | null {
  const duree = dureeCycleItpJours(itp)
  if (!duree) return null
  const recolte = new Date(debut)
  recolte.setDate(recolte.getDate() + duree)
  return recolte
}

/**
 * Dates de semis, plantation et récolte pour une saison donnée.
 * Les étapes absentes de l'ITP restent nulles et ne décalent rien.
 */
export function datesDepuisItp(annee: number, itp: SemainesItp): DatesCycle {
  const semaineSemis = semaineSemisEffective(itp)
  const dateSemis = semaineSemis ? semaineVersDate(annee, semaineSemis) : null

  const datePlantation = itp.semainePlantation
    ? jalonApres(annee, itp.semainePlantation, dateSemis)
    : null

  // Pluriannuel : la récolte tombe à sa semaine, mais N années plus tard.
  const ancre = datePlantation ?? dateSemis
  const anneeRecolte = annee + anneesAvantRecolte(itp)
  const dateRecolte = itp.semaineRecolte
    ? jalonApres(anneeRecolte, itp.semaineRecolte, ancre)
    : null

  return { dateSemis, datePlantation, dateRecolte }
}
