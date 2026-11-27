/**
 * Chronologie du cheptel : un animal ne sort pas avant d'être entré.
 *
 * Le registre d'élevage imprimait une sortie (abattage) datée de la veille de
 * l'arrivée du lot, parce qu'aucune écriture ne comparait les deux dates
 * (équipe debug, D97). La comparaison se fait en jours civils : une date
 * d'arrivée est un jour, pas un instant.
 */
import { jourCivilStocke } from '@/lib/jour-civil'
import { ErreurElevage } from './erreurs'

type Presence = {
  dateArrivee?: Date | string | null
  dateNaissance?: Date | string | null
}

const jourFr = (jour: string) => jour.split('-').reverse().join('/')

/** Premier jour de présence connu : l'arrivée, à défaut la naissance. */
export function debutPresence(sujet: Presence): string | null {
  return jourCivilStocke(sujet.dateArrivee) ?? jourCivilStocke(sujet.dateNaissance)
}

/**
 * Message de refus si `date` précède l'entrée du sujet, sinon `null`.
 * Sans date d'entrée connue, rien n'est contrôlé : se rabattre sur la date de
 * création de la fiche interdirait toute saisie d'historique.
 */
export function motifSortieAvantEntree(
  date: Date | string,
  sujet: Presence,
  libelles: { evenement: string; sujet: string },
): string | null {
  const jour = jourCivilStocke(date)
  const entree = debutPresence(sujet)
  if (!jour || !entree || jour >= entree) return null
  const origine = jourCivilStocke(sujet.dateArrivee) ? "l'arrivée" : 'la naissance'
  return `${libelles.evenement} du ${jourFr(jour)} : cette date précède ${origine} ${libelles.sujet} (${jourFr(entree)}). Corrigez l'une des deux dates.`
}

/**
 * Message de refus si l'arrivée précède la naissance, sinon `null`.
 *
 * Un animal créé avec une arrivée la veille de sa naissance était accepté ; le
 * registre d'élevage et la dépense d'achat portaient cette date (équipe debug,
 * D220). Le jour même est accepté : un animal né sur l'exploitation y arrive
 * le jour de sa naissance.
 */
export function motifArriveeAvantNaissance(sujet: Presence): string | null {
  const naissance = jourCivilStocke(sujet.dateNaissance)
  const arrivee = jourCivilStocke(sujet.dateArrivee)
  if (!naissance || !arrivee || arrivee >= naissance) return null
  return `Arrivée du ${jourFr(arrivee)} : cette date précède la naissance de l'animal (${jourFr(naissance)}). Corrigez l'une des deux dates.`
}

/**
 * Vrai si la date envoyée désigne un autre jour que celle de la fiche.
 *
 * L'écran renvoie toujours ses deux dates, même inchangées : une fiche ancienne
 * déjà incohérente doit rester modifiable sur ses autres champs. Le formulaire
 * préremplit le jour UTC de la date stockée ; les deux lectures sont admises.
 */
export function jourChange(envoyee: Date | string | null | undefined, enBase: Date | null | undefined): boolean {
  const jour = jourCivilStocke(envoyee)
  if (!enBase) return jour !== null
  return jour !== jourCivilStocke(enBase) && jour !== enBase.toISOString().slice(0, 10)
}

/** Lève un refus 422 si l'événement précède l'entrée du sujet. */
export function refuserSortieAvantEntree(
  date: Date | string,
  sujet: Presence,
  libelles: { evenement: string; sujet: string },
): void {
  const motif = motifSortieAvantEntree(date, sujet, libelles)
  if (motif) throw new ErreurElevage(motif, 422)
}
