/**
 * Jour d'un soin et date retenue pour un jour saisi — règle unique, PURE,
 * partagée par le dialogue « Modifier le soin » (préremplissage et renvoi du
 * champ Date), `PATCH /api/elevage/soins` et l'assistant (`update_soin`, via
 * `mettreAJourProtocoleSoin`).
 *
 * Ticket cmvnp6s3z (QA 2026-10-25) : 1re injection datée 24/09 08:00 (Paris),
 * puis intervalle seul 48 h → 24 h depuis « Modifier le soin » : la date réelle
 * devenait 24/09 02:00. Le champ Date, prérempli par `split('T')[0]`, renvoyait
 * « 2026-09-24 », lu minuit UTC : la route y voyait une nouvelle date du soin
 * (06:00 UTC → 00:00 UTC) et les injections faites suivaient ce calendrier.
 *
 * Deux conventions de stockage coexistent :
 *  - date SANS HEURE : saisie au jour seul lue minuit UTC (POST soins) ;
 *  - date AVEC HEURE : heure réelle de la 1re injection, posée par « Faite » ou
 *    « Dater » (`daterInjection` déplace la date du soin dessus).
 */

import { jourLocalISO } from "@/lib/accueil/classement"

/** Saisie au jour seul : décidé par le FORMAT, jamais par « minuit UTC pile ». */
export const JOUR_SEUL = /^\d{4}-\d{2}-\d{2}$/

const MS_JOUR = 86_400_000

function sansHeure(date: Date): boolean {
  return date.getTime() % MS_JOUR === 0
}

/**
 * Jour civil d'un soin (« AAAA-MM-JJ ») : jour local (fuseau du serveur,
 * Europe/Paris en production, ou du navigateur) d'une date avec heure ; jour
 * saisi d'une date sans heure (minuit UTC, qui tombe la veille à l'ouest
 * d'UTC). Une injection datée 24/09 00:30 Paris (stockée 23/09 22:30 UTC)
 * est du 24/09, pas du 23/09 comme le disait `split('T')[0]`.
 */
export function jourSoin(date: Date): string {
  return sansHeure(date) ? date.toISOString().slice(0, 10) : jourLocalISO(date)
}

/**
 * Date du soin retenue pour une saisie.
 *  - Saisie horodatée (ISO complet, même à 00:00:00Z, ou objet Date) : telle quelle.
 *  - Jour seul égal au jour du soin stocké : date stockée inchangée (heure réelle gardée).
 *  - Jour seul différent : ce jour à la même heure MURALE locale que la date
 *    stockée ; minuit UTC de ce jour si la date stockée n'a pas d'heure.
 * Jour inexistant (« 2026-02-31 ») : date invalide.
 */
export function dateSoinRetenue(stockee: Date, saisie: string | Date): Date {
  if (typeof saisie !== "string" || !JOUR_SEUL.test(saisie.trim())) return new Date(saisie)
  const jour = saisie.trim()
  if (jour === jourSoin(stockee)) return new Date(stockee)
  if (sansHeure(stockee)) {
    const minuitUtc = new Date(`${jour}T00:00:00.000Z`)
    return minuitUtc.toISOString().slice(0, 10) === jour ? minuitUtc : new Date(Number.NaN)
  }
  const [annee, mois, jourMois] = jour.split("-").map(Number)
  const retenue = new Date(
    annee, mois - 1, jourMois,
    stockee.getHours(), stockee.getMinutes(), stockee.getSeconds(), stockee.getMilliseconds(),
  )
  return jourLocalISO(retenue) === jour ? retenue : new Date(Number.NaN)
}

/**
 * Valeur à renvoyer pour un champ Date du dialogue « Modifier le soin » : la
 * date stockée intacte si le jour n'a pas été touché (aucun décalage, même si
 * le fuseau du navigateur diffère de celui du serveur), sinon le jour saisi.
 */
export function dateSoinARenvoyer(jourSaisi: string, stockee: string | null | undefined): string {
  if (stockee && jourSaisi === jourSoin(new Date(stockee))) return stockee
  return jourSaisi
}
